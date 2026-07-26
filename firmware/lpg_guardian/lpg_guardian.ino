#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>
#include <WiFiManager.h>
#include <Wire.h>
#include <HX711.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <math.h>
#include <time.h>
#include "device_secrets.h"

// Struct definitions must come before any function that uses them, and
// before Arduino's auto-generated function prototypes get inserted (which
// happens right after this initial block). Keep these at the very top.
//
// NOTE: mq2Ppm / mq2Calibrated are new fields used only for the OLED and for
// local alarm decisions. sendTelemetry() only reads the fields it already
// referenced before (weight, mq2Raw, mq2Ready, gasLeakDetected, hx711Ok), so
// the JSON payload sent to the backend is byte-for-byte unchanged.
struct SensorSnapshot {
  bool weightValid;
  float currentGrossWeight;
  int mq2Raw;
  bool mq2Ready;
  bool gasLeakDetected;
  bool hx711Detected;
  bool tareConfigured;
  float mq2Ppm;
  bool mq2Calibrated;
};

struct NetSnapshot {
  bool backendReady;
  bool deviceConnected;
  String pairingStatus;
  String pairingCode;
};

// -----------------------------------------------------------------------------
// Architecture note
// -----------------------------------------------------------------------------
// Core 1 (the default Arduino loop task) owns: buttons, load cell / MQ-2
// reading, the local alarm (LED + buzzer), and the OLED. Nothing on Core 1
// ever calls WiFi/HTTP functions, so it can never freeze waiting on the
// network, no matter how slow or broken a TLS handshake or HTTP response is.
//
// Core 0 runs a dedicated FreeRTOS task (networkTask) that owns: backend
// health checks, pairing, and telemetry. It is the only place WiFiClientSecure
// / HTTPClient are used.
//
// The two cores share a small set of variables, all accessed through the
// getters/setters below, which take `stateMutex` for the duration of the
// read/write. Core 1 never calls oled/Wire functions from within those
// getters/setters (it reads shared network status, then renders afterward),
// and Core 0 never touches Wire/OLED at all - only Core 1 renders.
//
// Everything from "Networking (Core 0 only)" onward in this file is
// unchanged from the working version: Wi-Fi, TLS, pairing, telemetry, JSON
// payload shape, and the network task loop are untouched. All edits in this
// revision are confined to the sensor/alarm/OLED subsystem above that
// boundary.

// -----------------------------------------------------------------------------
// Project configuration
// -----------------------------------------------------------------------------

const char* API_BASE_URL = "https://slms-9k6l.onrender.com/api/v1";

// Google Trust Services GTS Root R4. This is the trust anchor for the current
// onrender.com certificate chain, not the short-lived onrender.com leaf cert.
const char* ROOT_CA_CERT = R"CERT(
-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPlwGjvYxqccpBQUjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzuhXyi
QHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/lxKvR
HYqjQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNpADBmAjEA6ED/g94D
9J+uHXqnLrmvT/aDHQ4thQEd0dlq7A/Cr8deVl5c1RxYIigL9zC2L7F8AjEA8GE8
p/SgguMh1YQdc4acLa/KNJvxn7kjNuK8YAOdgLOaVsjh4rsUecrNIdSUtUlD
-----END CERTIFICATE-----
)CERT";

// Hardware pins. Buttons use INPUT_PULLUP and must connect the GPIO to GND.
const uint8_t PIN_HX711_DT = 4;
const uint8_t PIN_HX711_SCK = 5;
const uint8_t PIN_OLED_SDA = 8;
const uint8_t PIN_OLED_SCL = 9;
const uint8_t PIN_MQ2_AOUT = 1;
const uint8_t PIN_LED_GREEN = 18;
const uint8_t PIN_LED_RED = 17;
const uint8_t PIN_BUZZER = 16;
const uint8_t PIN_BUTTON_RESET_WIFI = 10;
const uint8_t PIN_BUTTON_TARE = 11;

// Set to true if PIN_BUZZER drives a passive (no internal oscillator)
// buzzer. Active buzzers (the common cheap 5V/3V modules with a black
// epoxy blob and a piercing single-tone beep out of the box) should stay
// with false / digitalWrite.
const bool BUZZER_IS_PASSIVE = false;
const unsigned int BUZZER_TONE_HZ = 2700; // only used if BUZZER_IS_PASSIVE

const float LOADCELL_CALIBRATION_FACTOR = -110641.0f;
const unsigned long MQ2_WARMUP_MS = 60000UL;

const unsigned long SENSOR_INTERVAL_MS = 200UL;
const unsigned long OLED_INTERVAL_MS = 500UL;
const unsigned long TELEMETRY_INTERVAL_MS = 5000UL;
const unsigned long WIFI_RECHECK_MS = 5000UL;
const unsigned long BACKEND_RECHECK_MS = 10000UL;
const unsigned long PAIRING_RECHECK_MS = 3000UL;
const unsigned long PAIRING_REVALIDATE_MS = 60000UL;
const unsigned long BUTTON_DEBOUNCE_MS = 50UL;
const unsigned long ALARM_FLASH_MS = 300UL;
const unsigned long NETWORK_TASK_TICK_MS = 50UL;

const uint8_t WEIGHT_FILTER_SIZE = 10;
const float WEIGHT_SPIKE_THRESHOLD_KG = 0.5f;
const uint8_t MAX_CONSECUTIVE_WEIGHT_FAILURES = 10;

// A single reading that jumps more than WEIGHT_SPIKE_THRESHOLD_KG from the
// current median is treated as a *candidate* step change, not automatically
// rejected as noise. If WEIGHT_STEP_CONFIRM_SAMPLES consecutive candidates
// agree with each other (within WEIGHT_STEP_AGREEMENT_KG), it's accepted as
// a genuine weight change and the filter re-baselines to it immediately.
// Electrical noise essentially never repeats itself consistently for this
// many cycles in a row, so this distinguishes "someone put a cylinder on
// the platform" from "one bad ADC sample" without needing to know in
// advance which one it is.
const uint8_t WEIGHT_STEP_CONFIRM_SAMPLES = 3;
const float WEIGHT_STEP_AGREEMENT_KG = 0.3f;

// How many HX711 conversions get_units() averages per call. Higher = quieter
// raw sample, at ~100ms/conversion of extra time - worth it for resolving
// small weights (e.g. a phone, ~150-250g) against sensor noise.
const uint8_t HX711_SAMPLES_PER_READING = 10;

// Second-stage exponential smoothing applied after the median filter, to
// damp residual per-sample noise the median alone doesn't remove. 0.2
// settles a step change to within ~1% in about 4s at the current 200ms
// sensor interval.
const float WEIGHT_EMA_ALPHA = 0.2f;

// A reading closer to zero than this gets clamped to exactly 0.0kg, so an
// empty, perfectly-tared platform doesn't display tiny negative noise like
// "-0.01kg". IMPORTANT: this value must stay well below the smallest real
// item you intend to measure, or a small item can get swallowed into "0" by
// this clamp if the tare offset has drifted even slightly since the last
// tare. 20g gives headroom below a ~150g+ phone while still hiding sensor
// noise on an empty platform. If you still see 0.00kg with a known weight
// on the platform, re-tare (empty platform, press GPIO 11) immediately
// before testing - the fix here can't compensate for a stale/drifted tare.
const float WEIGHT_ZERO_CLAMP_KG = 0.02f;

// -----------------------------------------------------------------------------
// MQ-2 calibration and ppm estimation
// -----------------------------------------------------------------------------
const float MQ2_RL_KOHM = 5.0f;
const float MQ2_SUPPLY_VOLTS = 5.0f;
const float MQ2_ADC_VREF = 3.3f;
const int MQ2_ADC_MAX = 4095;
const float MQ2_CLEAN_AIR_RATIO = 9.83f;
const float MQ2_LPG_CURVE_M = -0.47f;
const float MQ2_LPG_CURVE_B = 1.44f;
const uint8_t MQ2_CALIBRATION_SAMPLES = 50;
const unsigned long MQ2_CALIBRATION_SAMPLE_INTERVAL_MS = 100UL;
const float MQ2_LEAK_PPM_THRESHOLD = 1000.0f;
const float MQ2_CLEAR_PPM_THRESHOLD = 700.0f;

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDRESS 0x3C

Adafruit_SSD1306 oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
HX711 scale;
Preferences preferences;

String deviceId;
String setupAccessPointName;
String lastOledContent;

// ---- Core 1 owned (sensors/alarm). Written only on Core 1. Read by Core 0
//      only through getSensorSnapshot(), which takes the mutex. ----
bool oledAvailable = false;
bool hx711Detected = false;
bool tareConfigured = false;
bool weightValid = false;
bool mq2Ready = false;
bool gasLeakDetected = false;
bool alarmFlashState = false;

float currentGrossWeight = 0.0f;
int mq2Raw = 0;
long savedTareOffset = 0;

float weightSamples[WEIGHT_FILTER_SIZE] = {0.0f};
uint8_t weightSampleIndex = 0;
uint8_t weightSampleCount = 0;
uint8_t consecutiveWeightFailures = 0;

// Second-stage smoothing applied on top of the median filter.
float weightEmaValue = 0.0f;
bool weightEmaInitialized = false;

// Tracks a potential genuine weight change while it's still being
// confirmed (see WEIGHT_STEP_CONFIRM_SAMPLES above). Reset whenever a
// reading lands back within the spike threshold of the current median.
float weightStepCandidateValue = 0.0f;
uint8_t weightStepCandidateCount = 0;

// MQ-2 calibration state (Core 1 only).
bool mq2Calibrated = false;
bool mq2CalibrationInProgress = false;
float mq2R0 = 0.0f;
bool mq2CalibrationPendingSave = false;
float mq2PendingR0 = 0.0f;
float mq2Ppm = 0.0f;
uint16_t mq2CalibrationSampleCount = 0;
unsigned long mq2CalibrationSum = 0;
unsigned long lastMq2CalibrationSampleAt = 0;

unsigned long bootStartedAt = 0;
unsigned long lastSensorAt = 0;
unsigned long lastOledAt = 0;
unsigned long lastAlarmFlashAt = 0;

// ---- Core 0 owned (networking/pairing). Written only on Core 0, through the
//      setters below. Read by Core 1 only through getNetSnapshot(). ----
bool backendReady = false;
bool deviceConnected = false;
String pairingStatus = "pairing";
String pairingCode;

uint32_t bootSessionId = 0;
uint32_t messageSequence = 0;
bool lastReportedLeakState = false;

struct DebouncedButton {
  uint8_t pin;
  bool stableState;
  bool lastRawState;
  unsigned long changedAt;
};

DebouncedButton resetWifiButton = {PIN_BUTTON_RESET_WIFI, HIGH, HIGH, 0};
DebouncedButton tareButton = {PIN_BUTTON_TARE, HIGH, HIGH, 0};

SemaphoreHandle_t stateMutex;

// -----------------------------------------------------------------------------
// Forward declarations
// -----------------------------------------------------------------------------

void renderOled(const String& line1, const String& line2 = "",
                const String& line3 = "", const String& line4 = "");
void updateOled();
void readSensors();
void updateAlarm();
void handleButtons();
void performTare();
void resetWifiConfiguration();
void connectWifiBlocking();
bool synchronizeClockBlocking(unsigned long timeoutMs);
bool checkBackendHealth();
bool refreshPairingState(bool bootstrap);
void networkTask(void* parameter);
bool sendTelemetry();
String makeMessageId();
void loadMq2Calibration();
void beginMq2Calibration();
bool stepMq2Calibration(int rawSample);
void persistMq2CalibrationIfPending();
float computeMq2Ppm(int rawSample);
void driveAlarmOutputs(bool greenOn, bool redOn, bool buzzerOn);

// -----------------------------------------------------------------------------
// Shared-state accessors (mutex protected)
// -----------------------------------------------------------------------------

void publishSensorState(bool wValid, float weight, int rawGas, bool gasReady,
                         bool leak, bool hxOk, bool tared, float ppm,
                         bool calibrated) {
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  weightValid = wValid;
  currentGrossWeight = weight;
  mq2Raw = rawGas;
  mq2Ready = gasReady;
  gasLeakDetected = leak;
  hx711Detected = hxOk;
  tareConfigured = tared;
  mq2Ppm = ppm;
  mq2Calibrated = calibrated;
  xSemaphoreGive(stateMutex);
}

SensorSnapshot getSensorSnapshot() {
  SensorSnapshot s;
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  s.weightValid = weightValid;
  s.currentGrossWeight = currentGrossWeight;
  s.mq2Raw = mq2Raw;
  s.mq2Ready = mq2Ready;
  s.gasLeakDetected = gasLeakDetected;
  s.hx711Detected = hx711Detected;
  s.tareConfigured = tareConfigured;
  s.mq2Ppm = mq2Ppm;
  s.mq2Calibrated = mq2Calibrated;
  xSemaphoreGive(stateMutex);
  return s;
}

void setBackendReady(bool v) {
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  backendReady = v;
  xSemaphoreGive(stateMutex);
}

void setPairingState(bool connected, const String& status, const String& code) {
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  deviceConnected = connected;
  pairingStatus = status;
  pairingCode = code;
  xSemaphoreGive(stateMutex);
}

NetSnapshot getNetSnapshot() {
  NetSnapshot n;
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  n.backendReady = backendReady;
  n.deviceConnected = deviceConnected;
  n.pairingStatus = pairingStatus;
  n.pairingCode = pairingCode;
  xSemaphoreGive(stateMutex);
  return n;
}

// -----------------------------------------------------------------------------
// Setup and main loop (Core 1)
// -----------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(100);
  bootStartedAt = millis();
  bootSessionId = esp_random();
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  Serial.println("Testing RED LED + BUZZER directly...");
  driveAlarmOutputs(false, true, true);
  delay(5000);
  driveAlarmOutputs(false, false, false);
  Serial.println("Test done.");
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_MQ2_AOUT, INPUT);
  pinMode(PIN_BUTTON_RESET_WIFI, INPUT_PULLUP);
  pinMode(PIN_BUTTON_TARE, INPUT_PULLUP);

  driveAlarmOutputs(false, false, false);

  stateMutex = xSemaphoreCreateMutex();

  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  oledAvailable = oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);
  if (oledAvailable) {
    oled.setTextSize(1);
    oled.setTextColor(SSD1306_WHITE);
  } else {
    Serial.println("OLED not detected; monitoring will continue without it.");
  }

  renderOled("LPG GUARDIAN", "Starting device", "Please wait");

  uint64_t chipId = ESP.getEfuseMac();
  char idBuffer[20];
  snprintf(idBuffer, sizeof(idBuffer), "LPG-%04X%08X",
           static_cast<uint16_t>(chipId >> 32),
           static_cast<uint32_t>(chipId));
  deviceId = String(idBuffer);
  setupAccessPointName = "LPG-Guardian-" + deviceId.substring(deviceId.length() - 4);

  Serial.print("Device ID: ");
  Serial.println(deviceId);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_MQ2_AOUT, ADC_11db);

  loadMq2Calibration();

  scale.begin(PIN_HX711_DT, PIN_HX711_SCK);
  bool hxOk = false;
  bool tared = false;
  if (scale.wait_ready_timeout(1000)) {
    hxOk = true;
    scale.set_scale(LOADCELL_CALIBRATION_FACTOR);

    preferences.begin("lpg-device", true);
    tared = preferences.isKey("tare_offset");
    if (tared) {
      savedTareOffset = preferences.getLong("tare_offset", 0);
      scale.set_offset(savedTareOffset);
      Serial.print("Loaded tare offset: ");
      Serial.println(savedTareOffset);
    }
    preferences.end();

    // Diagnostic only - prints the exact scale/offset pair this boot is
    // using, in the same units/format as your standalone test sketch
    // (scale.set_scale(...) / scale.set_offset(...)), so you can directly
    // compare them side by side if a known weight still reads wrong.
    Serial.printf("HX711 calibration in use: scale=%.1f offset=%ld\n",
                  LOADCELL_CALIBRATION_FACTOR, savedTareOffset);
  }
  publishSensorState(false, 0.0f, 0, false, false, hxOk, tared, 0.0f, mq2Calibrated);

  if (!tared) {
    Serial.println("No saved tare. Empty the platform and press the TARE button on GPIO 11.");
  }
  if (!mq2Calibrated) {
    Serial.println("No saved MQ-2 R0. Ensure clean air around the sensor - "
                    "automatic calibration will run once warm-up completes.");
  }

  connectWifiBlocking();
  synchronizeClockBlocking(30000UL);

  xTaskCreatePinnedToCore(
      networkTask,
      "NetworkTask",
      10240,
      NULL,
      1,
      NULL,
      0  // Core 0
  );

  Serial.println("Device setup complete. Network task started on core 0.");
}

void loop() {
  unsigned long now = millis();

  handleButtons();

  if (now - lastSensorAt >= SENSOR_INTERVAL_MS) {
    lastSensorAt = now;
    readSensors();
    updateAlarm();
    persistMq2CalibrationIfPending();
  }

  if (now - lastOledAt >= OLED_INTERVAL_MS) {
    lastOledAt = now;
    updateOled();
  }

  delay(2);
}

// -----------------------------------------------------------------------------
// Buttons and tare (Core 1)
// -----------------------------------------------------------------------------

bool buttonPressedOnce(DebouncedButton& button) {
  bool rawState = digitalRead(button.pin);
  unsigned long now = millis();

  if (rawState != button.lastRawState) {
    button.lastRawState = rawState;
    button.changedAt = now;
  }

  if (now - button.changedAt >= BUTTON_DEBOUNCE_MS && rawState != button.stableState) {
    button.stableState = rawState;
    return button.stableState == LOW;
  }

  return false;
}

void handleButtons() {
  if (buttonPressedOnce(resetWifiButton)) {
    resetWifiConfiguration();
    return;
  }

  if (buttonPressedOnce(tareButton)) {
    performTare();
  }
}

void resetWifiConfiguration() {
  renderOled("RESETTING WI-FI", "Erasing settings", "Restarting...");
  Serial.println("Wi-Fi reset button pressed.");

  WiFiManager manager;
  manager.resetSettings();
  delay(1000);
  ESP.restart();
}

void performTare() {
  Serial.println("Tare button pressed. The platform must be completely empty.");

  for (int seconds = 5; seconds > 0; --seconds) {
    renderOled("TARE SETUP", "REMOVE CYLINDER", "Platform empty",
               "Starting in " + String(seconds));
    delay(1000);
  }

  renderOled("TARE SETUP", "Do not touch", "Reading offset...");

  if (!scale.wait_ready_timeout(2000)) {
    publishSensorState(false, currentGrossWeight, mq2Raw, mq2Ready,
                        gasLeakDetected, false, false, mq2Ppm, mq2Calibrated);
    renderOled("TARE FAILED", "HX711 not ready", "Check wiring");
    delay(2000);
    return;
  }

  scale.set_scale(LOADCELL_CALIBRATION_FACTOR);
  scale.tare(20);
  savedTareOffset = scale.get_offset();

  preferences.begin("lpg-device", false);
  size_t bytesWritten = preferences.putLong("tare_offset", savedTareOffset);
  preferences.end();

  if (bytesWritten == 0) {
    publishSensorState(false, currentGrossWeight, mq2Raw, mq2Ready,
                        gasLeakDetected, true, false, mq2Ppm, mq2Calibrated);
    renderOled("TARE FAILED", "Could not save", "Try again");
    delay(2000);
    return;
  }

  scale.set_offset(savedTareOffset);
  weightSampleIndex = 0;
  weightSampleCount = 0;
  consecutiveWeightFailures = 0;
  memset(weightSamples, 0, sizeof(weightSamples));
  weightEmaInitialized = false;
  weightStepCandidateCount = 0;

  publishSensorState(false, 0.0f, mq2Raw, mq2Ready, gasLeakDetected, true, true,
                      mq2Ppm, mq2Calibrated);

  Serial.print("Tare saved: ");
  Serial.println(savedTareOffset);
  Serial.printf("HX711 calibration in use: scale=%.1f offset=%ld\n",
                LOADCELL_CALIBRATION_FACTOR, savedTareOffset);
  renderOled("TARE COMPLETE", "Offset saved", "Place cylinder");
  delay(2000);
}

// -----------------------------------------------------------------------------
// MQ-2 calibration and ppm estimation (Core 1)
// -----------------------------------------------------------------------------

void loadMq2Calibration() {
  preferences.begin("lpg-device", true);
  mq2Calibrated = preferences.isKey("mq2_r0");
  if (mq2Calibrated) {
    mq2R0 = preferences.getFloat("mq2_r0", 0.0f);
    if (mq2R0 <= 0.0f) {
      mq2Calibrated = false;
    } else {
      Serial.printf("Loaded MQ-2 R0: %.2f kOhm\n", mq2R0);
    }
  }
}

float rawToRs(int rawSample) {
  float vOut = (static_cast<float>(rawSample) / MQ2_ADC_MAX) * MQ2_ADC_VREF;
  if (vOut < 0.01f) {
    vOut = 0.01f;
  }
  return ((MQ2_SUPPLY_VOLTS - vOut) / vOut) * MQ2_RL_KOHM;
}

void beginMq2Calibration() {
  mq2CalibrationInProgress = true;
  mq2CalibrationSampleCount = 0;
  mq2CalibrationSum = 0;
  lastMq2CalibrationSampleAt = 0;
  Serial.println("MQ-2: starting clean-air calibration. Do not expose sensor to gas.");
}

bool stepMq2Calibration(int rawSample) {
  unsigned long now = millis();
  if (now - lastMq2CalibrationSampleAt < MQ2_CALIBRATION_SAMPLE_INTERVAL_MS) {
    return false;
  }
  lastMq2CalibrationSampleAt = now;

  mq2CalibrationSum += rawSample;
  ++mq2CalibrationSampleCount;

  if (mq2CalibrationSampleCount < MQ2_CALIBRATION_SAMPLES) {
    return false;
  }

  float averageRaw = static_cast<float>(mq2CalibrationSum) / mq2CalibrationSampleCount;
  float rsCleanAir = rawToRs(static_cast<int>(averageRaw));
  float r0 = rsCleanAir / MQ2_CLEAN_AIR_RATIO;

  mq2CalibrationInProgress = false;

  if (r0 <= 0.0f) {
    Serial.println("MQ-2: calibration produced an invalid R0. Will retry.");
    return false;
  }

  mq2R0 = r0;
  mq2Calibrated = true;
  mq2PendingR0 = r0;
  mq2CalibrationPendingSave = true;
  Serial.printf("MQ-2: calibration complete. R0 = %.2f kOhm (avg raw %.1f).\n",
                mq2R0, averageRaw);
  return true;
}

void persistMq2CalibrationIfPending() {
  if (!mq2CalibrationPendingSave) {
    return;
  }

  preferences.begin("lpg-device", false);
  size_t bytesWritten = preferences.putFloat("mq2_r0", mq2PendingR0);
  preferences.end();

  mq2CalibrationPendingSave = false;

  if (bytesWritten == 0) {
    Serial.println("MQ-2: calibration save to flash failed; will retry after next reboot.");
    return;
  }

  Serial.printf("MQ-2: calibration saved to flash. R0 = %.2f kOhm\n", mq2PendingR0);
}

float computeMq2Ppm(int rawSample) {
  if (!mq2Calibrated || mq2R0 <= 0.0f) {
    return 0.0f;
  }
  float rs = rawToRs(rawSample);
  float ratio = rs / mq2R0;
  if (ratio <= 0.0f) {
    return 0.0f;
  }
  float exponent = (log10f(ratio) - MQ2_LPG_CURVE_B) / MQ2_LPG_CURVE_M;
  return powf(10.0f, exponent);
}

// -----------------------------------------------------------------------------
// Sensors and local alarm (Core 1)
// -----------------------------------------------------------------------------

float medianOfWeightSamples(uint8_t count) {
  float sorted[WEIGHT_FILTER_SIZE];
  memcpy(sorted, weightSamples, sizeof(float) * count);
  for (uint8_t i = 1; i < count; ++i) {
    float key = sorted[i];
    int8_t j = i - 1;
    while (j >= 0 && sorted[j] > key) {
      sorted[j + 1] = sorted[j];
      --j;
    }
    sorted[j + 1] = key;
  }
  return sorted[count / 2];
}

void readSensors() {
  long mq2Total = 0;
  for (uint8_t i = 0; i < 8; ++i) {
    mq2Total += analogRead(PIN_MQ2_AOUT);
    delayMicroseconds(100);
  }
  int rawGas = static_cast<int>(mq2Total / 8);
  bool warmedUp = millis() - bootStartedAt >= MQ2_WARMUP_MS;

  if (warmedUp && !mq2Calibrated && !mq2CalibrationInProgress) {
    beginMq2Calibration();
  }
  if (mq2CalibrationInProgress) {
    stepMq2Calibration(rawGas);
  }

  bool gasReady = warmedUp && mq2Calibrated;
  float ppm = mq2Calibrated ? computeMq2Ppm(rawGas) : 0.0f;

  bool leak = gasLeakDetected;
  if (!gasReady) {
    leak = false;
  } else if (!leak && ppm >= MQ2_LEAK_PPM_THRESHOLD) {
    leak = true;
  } else if (leak && ppm <= MQ2_CLEAR_PPM_THRESHOLD) {
    leak = false;
  }

  // ---- Weight measurement (HX711) ----
  bool hxOk = hx711Detected;
  bool tared = tareConfigured;
  bool wValid = weightValid;
  float weight = currentGrossWeight;

  bool readingFailed = false;
  float measuredWeight = 0.0f;

  if (!scale.wait_ready_timeout(200)) {
    Serial.println("HX711: not ready this cycle.");
    readingFailed = true;
  } else {
    if (!hxOk) {
      hxOk = true;
      scale.set_scale(LOADCELL_CALIBRATION_FACTOR);
      if (tared) {
        scale.set_offset(savedTareOffset);
      }
      weightEmaInitialized = false;
      weightStepCandidateCount = 0;
      Serial.println("HX711: responded again, calibration/tare reapplied.");
    }

    if (!tared) {
      publishSensorState(false, weight, rawGas, gasReady, leak, hxOk, tared,
                          ppm, mq2Calibrated);
      return;
    }

    measuredWeight = scale.get_units(HX711_SAMPLES_PER_READING);
    Serial.printf("HX711: raw reading %.3f kg (calibration factor %.2f)\n",
                  measuredWeight, LOADCELL_CALIBRATION_FACTOR);

    if (!isfinite(measuredWeight) || measuredWeight < -0.15f || measuredWeight > 20.0f) {
      Serial.println("HX711: reading out of sane range, discarding.");
      readingFailed = true;
    } else {
      // Clamp only genuinely-near-zero noise, not small real items - see
      // WEIGHT_ZERO_CLAMP_KG's comment above for why this threshold matters.
      if (fabsf(measuredWeight) < WEIGHT_ZERO_CLAMP_KG) {
        measuredWeight = 0.0f;
      }

      if (weightSampleCount >= 1) {
        float currentMedian = medianOfWeightSamples(weightSampleCount);
        if (fabsf(measuredWeight - currentMedian) > WEIGHT_SPIKE_THRESHOLD_KG) {
          // This reading disagrees with the current median. That could be a
          // single noisy sample, or it could be the start of a genuine
          // weight change (something placed on/removed from the platform).
          // Track whether consecutive deviating readings agree with each
          // other - noise doesn't repeat itself consistently, a real
          // change does.
          bool agreesWithCandidate = weightStepCandidateCount > 0 &&
              fabsf(measuredWeight - weightStepCandidateValue) <= WEIGHT_STEP_AGREEMENT_KG;
          weightStepCandidateValue = measuredWeight;
          weightStepCandidateCount = agreesWithCandidate ? weightStepCandidateCount + 1 : 1;

          if (weightStepCandidateCount >= WEIGHT_STEP_CONFIRM_SAMPLES) {
            // Confirmed: enough consecutive, mutually-agreeing deviating
            // samples to treat this as a real weight change rather than
            // noise. Re-baseline the filter to it immediately instead of
            // continuing to reject readings against a median that no
            // longer reflects what's actually on the platform.
            Serial.printf("HX711: confirmed weight change to %.3f kg after %u agreeing samples.\n",
                          measuredWeight, weightStepCandidateCount);
            weightSampleIndex = 0;
            weightSampleCount = 0;
            memset(weightSamples, 0, sizeof(weightSamples));
            weightStepCandidateCount = 0;
            // Falls through to the normal accept path below.
          } else {
            Serial.printf("HX711: deviating sample (%.3f kg vs median %.3f kg), "
                          "step-candidate %u/%u.\n",
                          measuredWeight, currentMedian, weightStepCandidateCount,
                          WEIGHT_STEP_CONFIRM_SAMPLES);
            readingFailed = true;
          }
        } else {
          // Reading agrees with the current median - not a deviation, so
          // any in-progress (and apparently spurious) step candidate is
          // stale. Clear it rather than letting an old candidate value
          // combine with future unrelated deviations.
          weightStepCandidateCount = 0;
        }
      }
    }
  }

  if (readingFailed) {
    ++consecutiveWeightFailures;
    Serial.printf("HX711: consecutive failed readings = %u/%u\n",
                  consecutiveWeightFailures, MAX_CONSECUTIVE_WEIGHT_FAILURES);

    if (consecutiveWeightFailures >= MAX_CONSECUTIVE_WEIGHT_FAILURES) {
      hxOk = false;
      wValid = false;
      Serial.println("HX711: sensor considered failed after repeated bad readings.");
    }

    publishSensorState(wValid, weight, rawGas, gasReady, leak, hxOk, tared,
                        ppm, mq2Calibrated);
    return;
  }

  consecutiveWeightFailures = 0;

  weightSamples[weightSampleIndex] = measuredWeight;
  weightSampleIndex = (weightSampleIndex + 1) % WEIGHT_FILTER_SIZE;
  if (weightSampleCount < WEIGHT_FILTER_SIZE) {
    ++weightSampleCount;
  }

  weight = medianOfWeightSamples(weightSampleCount);
  // Valid from the very first accepted sample - no more "WEIGHT WAITING"
  // while the filter fills. The median of 1 sample is just that sample, so
  // this displays immediately and gets progressively smoother as
  // weightSampleCount grows toward WEIGHT_FILTER_SIZE.
  wValid = weightSampleCount >= 1;

  if (wValid) {
    if (!weightEmaInitialized) {
      weightEmaValue = weight;
      weightEmaInitialized = true;
    } else {
      weightEmaValue = WEIGHT_EMA_ALPHA * weight + (1.0f - WEIGHT_EMA_ALPHA) * weightEmaValue;
    }
    weight = weightEmaValue;
  }

  Serial.printf("HX711: median %.3f kg, smoothed %.3f kg, valid=%d, samples=%u/%u\n",
                medianOfWeightSamples(weightSampleCount), weight, wValid, weightSampleCount,
                WEIGHT_FILTER_SIZE);
  Serial.printf("MQ-2: raw=%d ppm=%.1f calibrated=%d leak=%d\n",
                rawGas, ppm, mq2Calibrated, leak);

  publishSensorState(wValid, weight, rawGas, gasReady, leak, hxOk, tared,
                      ppm, mq2Calibrated);
}

void driveAlarmOutputs(bool greenOn, bool redOn, bool buzzerOn) {
  digitalWrite(PIN_LED_GREEN, greenOn ? HIGH : LOW);
  digitalWrite(PIN_LED_RED, redOn ? HIGH : LOW);

  if (BUZZER_IS_PASSIVE) {
    if (buzzerOn) {
      tone(PIN_BUZZER, BUZZER_TONE_HZ);
    } else {
      noTone(PIN_BUZZER);
    }
  } else {
    digitalWrite(PIN_BUZZER, buzzerOn ? HIGH : LOW);
  }
}

void updateAlarm() {
  Serial.printf("ALARM CHECK: mq2Ready=%d gasLeakDetected=%d mq2Raw=%d mq2Ppm=%.1f\n",
                mq2Ready, gasLeakDetected, mq2Raw, mq2Ppm);

  if (!mq2Ready) {
    driveAlarmOutputs(false, true, false);
    return;
  }

  if (!gasLeakDetected) {
    driveAlarmOutputs(true, false, false);
    alarmFlashState = false;
    return;
  }

  if (millis() - lastAlarmFlashAt >= ALARM_FLASH_MS) {
    lastAlarmFlashAt = millis();
    alarmFlashState = !alarmFlashState;
  }
  driveAlarmOutputs(false, alarmFlashState, alarmFlashState);
}

// -----------------------------------------------------------------------------
// OLED (Core 1 only - never called from networkTask)
// -----------------------------------------------------------------------------

void renderOled(const String& line1, const String& line2,
                const String& line3, const String& line4) {
  if (!oledAvailable) {
    return;
  }

  String content = line1 + "|" + line2 + "|" + line3 + "|" + line4;
  if (content == lastOledContent) {
    return;
  }
  lastOledContent = content;

  oled.clearDisplay();
  oled.setCursor(0, 0);
  oled.println(line1);
  oled.println("---------------------");
  oled.println(line2);
  oled.println(line3);
  oled.println(line4);
  oled.display();
}

// Root cause of "OLED stops showing weight": the previous version of this
// function had a chain of early returns - Wi-Fi screen, then backend
// screen, then pairing screen - each of which returned before the function
// ever reached the lines that render the weight. So any time the device was
// mid-pairing or waiting on the backend, the weight could never be shown,
// even though it was sitting right there, valid, in currentGrossWeight the
// whole time.
//
// Fixed structure: weight is computed first and is always line 1 (the only
// exception is "no tare yet", where there's genuinely no meaningful weight
// to show). Every other piece of state - leak/safe, MQ-2, network/pairing -
// is folded into lines 2-4 as a status summary instead of taking over the
// whole screen.
void updateOled() {
  NetSnapshot net = getNetSnapshot();
  bool wifiUp = WiFi.status() == WL_CONNECTED;

  if (!tareConfigured) {
    String netLine = wifiUp ? (net.backendReady ? "BACKEND ONLINE" : "BACKEND WAIT")
                             : "WI-FI OFFLINE";
    renderOled("TARE REQUIRED", "Remove cylinder", "Press GPIO 11", netLine);
    return;
  }

  // wValid now flips true on the very first accepted sample (see
  // readSensors()), so the only time there's genuinely nothing meaningful
  // to show is a real HX711 fault - the platform being tared with no
  // reading yet, or the sensor having failed outright. Every other case
  // shows the live, continuously-refreshing weight.
  String weightLine = hx711Detected
                          ? "Gross: " + String(currentGrossWeight, 2) + "kg"
                          : "HX711 FAULT";

  String statusLine;
  if (mq2Ready && gasLeakDetected) {
    statusLine = "*** GAS LEAK ***";
  } else if (!mq2Ready) {
    if (millis() - bootStartedAt < MQ2_WARMUP_MS) {
      unsigned long remaining = (MQ2_WARMUP_MS - (millis() - bootStartedAt)) / 1000UL;
      statusLine = "MQ-2 WARM " + String(remaining) + "s";
    } else if (mq2CalibrationInProgress) {
      statusLine = "MQ-2 CALIBRATING";
    } else {
      statusLine = "MQ-2 NOT READY";
    }
  } else {
    statusLine = "STATUS: SAFE";
  }

  String mq2Line = mq2Calibrated
                        ? ("PPM:" + String(mq2Ppm, 0) + " Raw:" + String(mq2Raw))
                        : ("Raw: " + String(mq2Raw));

  String netLine;
  if (!wifiUp) {
    netLine = "WI-FI OFFLINE";
  } else if (!net.backendReady) {
    netLine = "BACKEND WAIT";
  } else if (!net.deviceConnected) {
    if (net.pairingStatus == "pairing" && net.pairingCode.length() == 6) {
      netLine = "Pair: " + net.pairingCode;
    } else if (net.pairingStatus == "claimed") {
      netLine = "Paired, no data";
    } else {
      netLine = "Pairing...";
    }
  } else {
    netLine = "BACKEND ONLINE";
  }

  renderOled(weightLine, statusLine, mq2Line, netLine);
}

// -----------------------------------------------------------------------------
// Blocking initial connectivity (Core 1, setup() only - runs before the
// network task is created, so no concurrency concern here)
// -----------------------------------------------------------------------------

void connectWifiBlocking() {
  renderOled("WI-FI SETUP", "Connect phone to", setupAccessPointName,
             "Password: admin123");

  WiFiManager manager;
  manager.setConnectTimeout(20);
  bool connected = manager.autoConnect(setupAccessPointName.c_str(), "admin123");
  if (!connected) {
    ESP.restart();
  }

  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  renderOled("WI-FI CONNECTED", WiFi.SSID(), WiFi.localIP().toString(), "Checking backend");
}

bool synchronizeClockBlocking(unsigned long timeoutMs) {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  unsigned long startedAt = millis();
  time_t now = time(nullptr);

  while (now < 1700000000 && millis() - startedAt < timeoutMs) {
    renderOled("SETTING CLOCK", "Required for HTTPS", "Please wait...");
    delay(250);
    now = time(nullptr);
  }

  bool ready = now >= 1700000000;
  Serial.println(ready ? "Clock synchronized." : "Clock synchronization timed out.");
  return ready;
}

// -----------------------------------------------------------------------------
// Networking (Core 0 only - all functions below this point run exclusively
// inside networkTask or functions it calls. Never call renderOled from here.)
//
// UNCHANGED FROM THE WORKING VERSION. Wi-Fi, TLS, pairing, telemetry, and the
// JSON payload shape are exactly as they were - nothing below this line was
// modified.
// -----------------------------------------------------------------------------

bool checkBackendHealth() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  WiFiClientSecure client;
  client.setCACert(ROOT_CA_CERT);
  HTTPClient http;
  http.setConnectTimeout(8000);
  http.setTimeout(8000);

  String url = String(API_BASE_URL) + "/health/";
  if (!http.begin(client, url)) {
    return false;
  }

  int status = http.GET();
  http.end();
  Serial.printf("Backend health response: %d\n", status);
  return status >= 200 && status < 300;
}

bool refreshPairingState(bool bootstrap) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  WiFiClientSecure client;
  client.setCACert(ROOT_CA_CERT);
  HTTPClient http;
  http.setConnectTimeout(8000);
  http.setTimeout(8000);

  String endpoint = bootstrap ? "/device/bootstrap/" : "/device/config/";
  if (!http.begin(client, String(API_BASE_URL) + endpoint)) {
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-ID", deviceId);
  http.addHeader("X-Device-Secret", DEVICE_SECRET);
  int status = bootstrap ? http.POST("{}") : http.GET();
  String responseBody = http.getString();
  http.end();

  Serial.printf("Pairing response: %d\n", status);
  if (responseBody.length() > 0) {
    Serial.print("Pairing body: ");
    Serial.println(responseBody);
  }
  if (status < 200 || status >= 300) {
    return false;
  }

  JsonDocument response;
  if (deserializeJson(response, responseBody)) {
    Serial.println("Invalid pairing response from backend.");
    return false;
  }

  NetSnapshot current = getNetSnapshot();
  String newStatus = response["status"] | "pairing";
  String newCode = current.pairingCode;
  if (response["pairing_code_expired"] | false) {
    newCode = "";
  }
  if (response["pairing_code"].is<const char*>()) {
    newCode = response["pairing_code"].as<String>();
  }
  bool connected = newStatus == "connected";

  setPairingState(connected, newStatus, newCode);
  return true;
}

bool sendTelemetry() {
  SensorSnapshot s = getSensorSnapshot();

  WiFiClientSecure client;
  client.setCACert(ROOT_CA_CERT);

  HTTPClient http;
  http.setConnectTimeout(10000);
  http.setTimeout(10000);

  String url = String(API_BASE_URL) + "/device/telemetry/";
  if (!http.begin(client, url)) {
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-ID", deviceId);
  http.addHeader("X-Device-Secret", DEVICE_SECRET);

  JsonDocument payload;
  payload["message_id"] = makeMessageId();
  if (s.weightValid) {
    payload["weight"] = roundf(s.currentGrossWeight * 1000.0f) / 1000.0f;
  } else {
    payload["weight"] = nullptr;
  }
  payload["mq2_raw"] = s.mq2Raw;
  payload["mq2_ready"] = s.mq2Ready;
  payload["gas_leak_detected"] = s.mq2Ready ? s.gasLeakDetected : false;
  payload["hx711_ok"] = s.hx711Detected && s.tareConfigured && s.weightValid;

  String body;
  serializeJson(payload, body);

  int status = http.POST(body);

  if (status > 0) {
    WiFiClient* stream = http.getStreamPtr();
    unsigned long streamStart = millis();
    while (http.connected() && (millis() - streamStart < 3000)) {
      while (stream->available()) {
        stream->read();
      }
      if (!stream->available() && !http.connected()) break;
      delay(1);
    }
  }

  http.end();

  Serial.printf("Telemetry response: %d\n", status);

  if (status >= 200 && status < 300) {
    lastReportedLeakState = s.gasLeakDetected;
    return true;
  }

  if (status == 401 || status == 403 || status == 404) {
    setBackendReady(false);
  }
  return false;
}

// -----------------------------------------------------------------------------
// Network task (Core 0)
// -----------------------------------------------------------------------------

void networkTask(void* parameter) {
  unsigned long lastWifiCheckAt = 0;
  unsigned long lastBackendCheckAt = 0;
  unsigned long lastPairingCheckAt = 0;
  unsigned long lastTelemetryAt = 0;

  for (;;) {
    unsigned long now = millis();

    if (WiFi.status() != WL_CONNECTED) {
      setBackendReady(false);
      if (now - lastWifiCheckAt >= WIFI_RECHECK_MS) {
        lastWifiCheckAt = now;
        WiFi.reconnect();
      }
      vTaskDelay(pdMS_TO_TICKS(NETWORK_TASK_TICK_MS));
      continue;
    }

    NetSnapshot net = getNetSnapshot();

    if (!net.backendReady) {
      if (now - lastBackendCheckAt >= BACKEND_RECHECK_MS) {
        lastBackendCheckAt = now;
        bool ok = checkBackendHealth();
        setBackendReady(ok);
      }
      vTaskDelay(pdMS_TO_TICKS(NETWORK_TASK_TICK_MS));
      continue;
    }

    if (!net.deviceConnected) {
      if (now - lastPairingCheckAt >= PAIRING_RECHECK_MS) {
        lastPairingCheckAt = now;
        bool needsCode = net.pairingStatus == "pairing" && net.pairingCode.length() != 6;
        refreshPairingState(needsCode);
      }
      vTaskDelay(pdMS_TO_TICKS(NETWORK_TASK_TICK_MS));
      continue;
    }

    if (now - lastPairingCheckAt >= PAIRING_REVALIDATE_MS) {
      lastPairingCheckAt = now;
      refreshPairingState(false);
    }

    SensorSnapshot s = getSensorSnapshot();
    bool leakChanged = s.mq2Ready && s.gasLeakDetected != lastReportedLeakState;
    bool intervalElapsed = now - lastTelemetryAt >= TELEMETRY_INTERVAL_MS;

    if (leakChanged || intervalElapsed) {
      if (sendTelemetry()) {
        lastTelemetryAt = millis();
      }
    }

    vTaskDelay(pdMS_TO_TICKS(NETWORK_TASK_TICK_MS));
  }
}

String makeMessageId() {
  ++messageSequence;
  char buffer[64];
  snprintf(buffer, sizeof(buffer), "%s-%08lX-%08lX", deviceId.c_str(),
           static_cast<unsigned long>(bootSessionId),
           static_cast<unsigned long>(messageSequence));
  return String(buffer);
}
