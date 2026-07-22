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
#include <time.h>
#include "device_secrets.h"

// Struct definitions must come before any function that uses them, and
// before Arduino's auto-generated function prototypes get inserted (which
// happens right after this initial block). Keep these at the very top.
struct SensorSnapshot {
  bool weightValid;
  float currentGrossWeight;
  int mq2Raw;
  bool mq2Ready;
  bool gasLeakDetected;
  bool hx711Detected;
  bool tareConfigured;
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

const float LOADCELL_CALIBRATION_FACTOR = -110641.0f;
const int MQ2_LEAK_THRESHOLD = 100;
const int MQ2_CLEAR_THRESHOLD = 50;
const unsigned long MQ2_WARMUP_MS = 60000UL;

const unsigned long SENSOR_INTERVAL_MS = 200UL;
const unsigned long OLED_INTERVAL_MS = 500UL;
const unsigned long TELEMETRY_INTERVAL_MS = 5000UL;
const unsigned long WIFI_RECHECK_MS = 5000UL;
const unsigned long BACKEND_RECHECK_MS = 10000UL;
const unsigned long PAIRING_RECHECK_MS = 3000UL;
// Once fully connected, re-verify pairing far less often than during initial
// setup - every re-check pays a full TLS handshake, and there's no need to
// pay that cost every few seconds once the device is up and running.
const unsigned long PAIRING_REVALIDATE_MS = 60000UL;
const unsigned long BUTTON_DEBOUNCE_MS = 50UL;
const unsigned long ALARM_FLASH_MS = 300UL;
const unsigned long NETWORK_TASK_TICK_MS = 50UL;

const uint8_t WEIGHT_FILTER_SIZE = 10;
const uint8_t MIN_VALID_WEIGHT_SAMPLES = 5;

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

// -----------------------------------------------------------------------------
// Shared-state accessors (mutex protected)
// -----------------------------------------------------------------------------

// Called from Core 1 only, at the end of readSensors()/performTare().
void publishSensorState(bool wValid, float weight, int rawGas, bool gasReady,
                         bool leak, bool hxOk, bool tared) {
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  weightValid = wValid;
  currentGrossWeight = weight;
  mq2Raw = rawGas;
  mq2Ready = gasReady;
  gasLeakDetected = leak;
  hx711Detected = hxOk;
  tareConfigured = tared;
  xSemaphoreGive(stateMutex);
}

// Called from Core 0 only (sendTelemetry payload building).
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
  xSemaphoreGive(stateMutex);
  return s;
}

// Called from Core 0 only.
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

// Called from Core 1 only (updateOled) and Core 0 (networkTask's own loop
// condition checks).
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
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_BUZZER, HIGH);
  delay(5000);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_BUZZER, LOW);
  Serial.println("Test done.");
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_MQ2_AOUT, INPUT);
  pinMode(PIN_BUTTON_RESET_WIFI, INPUT_PULLUP);
  pinMode(PIN_BUTTON_TARE, INPUT_PULLUP);

  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_BUZZER, LOW);

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
  }
  publishSensorState(false, 0.0f, 0, false, false, hxOk, tared);

  if (!tared) {
    Serial.println("No saved tare. Empty the platform and press the TARE button on GPIO 11.");
  }

  // Still intentionally blocking: nothing runs (not even the sensor loop)
  // until household Wi-Fi is configured. This happens before the network
  // task is created, so there's no concurrency concern here yet.
  connectWifiBlocking();

  // TLS certificate validation needs a valid clock. Also still single
  // threaded at this point.
  synchronizeClockBlocking(30000UL);

  // From here on, Core 1 (this task, via loop()) only ever touches sensors,
  // the alarm, buttons, and the OLED. All backend/pairing/telemetry work
  // happens on Core 0 and can never block this core again.
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
                        gasLeakDetected, false, false);
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
                        gasLeakDetected, true, false);
    renderOled("TARE FAILED", "Could not save", "Try again");
    delay(2000);
    return;
  }

  scale.set_offset(savedTareOffset);
  weightSampleIndex = 0;
  weightSampleCount = 0;
  memset(weightSamples, 0, sizeof(weightSamples));

  publishSensorState(false, 0.0f, mq2Raw, mq2Ready, gasLeakDetected, true, true);

  Serial.print("Tare saved: ");
  Serial.println(savedTareOffset);
  renderOled("TARE COMPLETE", "Offset saved", "Place cylinder");
  delay(2000);
}

// -----------------------------------------------------------------------------
// Sensors and local alarm (Core 1)
// -----------------------------------------------------------------------------

void readSensors() {
  long mq2Total = 0;
  for (uint8_t i = 0; i < 8; ++i) {
    mq2Total += analogRead(PIN_MQ2_AOUT);
    delayMicroseconds(100);
  }
  int rawGas = static_cast<int>(mq2Total / 8);
  bool gasReady = millis() - bootStartedAt >= MQ2_WARMUP_MS;

  bool leak = gasLeakDetected;
  if (!gasReady) {
    leak = false;
  } else if (!leak && rawGas >= MQ2_LEAK_THRESHOLD) {
    leak = true;
  } else if (leak && rawGas <= MQ2_CLEAR_THRESHOLD) {
    leak = false;
  }

  bool hxOk = hx711Detected;
  bool tared = tareConfigured;
  bool wValid = weightValid;
  float weight = currentGrossWeight;

  if (!scale.wait_ready_timeout(200)) {
    hxOk = false;
    wValid = false;
    publishSensorState(wValid, weight, rawGas, gasReady, leak, hxOk, tared);
    return;
  }

  if (!hxOk) {
    // A recovered HX711 must have calibration and tare reapplied before use.
    hxOk = true;
    scale.set_scale(LOADCELL_CALIBRATION_FACTOR);
    if (tared) {
      scale.set_offset(savedTareOffset);
    }
  }

  if (!tared) {
    wValid = false;
    publishSensorState(wValid, weight, rawGas, gasReady, leak, hxOk, tared);
    return;
  }

  float measuredWeight = scale.get_units(5);
  if (!isfinite(measuredWeight) || measuredWeight < -0.15f || measuredWeight > 20.0f) {
    wValid = false;
    publishSensorState(wValid, weight, rawGas, gasReady, leak, hxOk, tared);
    return;
  }

  if (measuredWeight < 0.05f) {
    measuredWeight = 0.0f;
  }

  weightSamples[weightSampleIndex] = measuredWeight;
  weightSampleIndex = (weightSampleIndex + 1) % WEIGHT_FILTER_SIZE;
  if (weightSampleCount < WEIGHT_FILTER_SIZE) {
    ++weightSampleCount;
  }

  float total = 0.0f;
  for (uint8_t i = 0; i < weightSampleCount; ++i) {
    total += weightSamples[i];
  }

  weight = total / weightSampleCount;
  wValid = weightSampleCount >= MIN_VALID_WEIGHT_SAMPLES;

  publishSensorState(wValid, weight, rawGas, gasReady, leak, hxOk, tared);
}

void updateAlarm() {
  Serial.printf("ALARM CHECK: mq2Ready=%d gasLeakDetected=%d mq2Raw=%d\n",
                mq2Ready, gasLeakDetected, mq2Raw);
  // These were just written by readSensors() on this same core, moments ago -
  // safe to read directly without the mutex.
  if (!mq2Ready) {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
    digitalWrite(PIN_BUZZER, LOW);
    return;
  }

  if (!gasLeakDetected) {
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_BUZZER, LOW);
    alarmFlashState = false;
    return;
  }

  digitalWrite(PIN_LED_GREEN, LOW);
  if (millis() - lastAlarmFlashAt >= ALARM_FLASH_MS) {
    lastAlarmFlashAt = millis();
    alarmFlashState = !alarmFlashState;
    digitalWrite(PIN_LED_RED, alarmFlashState ? HIGH : LOW);
    digitalWrite(PIN_BUZZER, alarmFlashState ? HIGH : LOW);
  }
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

void updateOled() {
  NetSnapshot net = getNetSnapshot();
  bool wifiUp = WiFi.status() == WL_CONNECTED;

  String networkState = wifiUp
                            ? (net.backendReady ? "BACKEND ONLINE" : "BACKEND WAIT")
                            : "WI-FI OFFLINE";

  if (!tareConfigured) {
    renderOled("TARE REQUIRED", "Remove cylinder", "Press GPIO 11", networkState);
    return;
  }

  if (!wifiUp) {
    renderOled("WI-FI OFFLINE", "Reconnecting...", "", networkState);
    return;
  }

  if (!net.backendReady) {
    renderOled("BACKEND CHECK", "Wi-Fi connected", "Waiting for API", "Retrying...");
    return;
  }

  if (!net.deviceConnected) {
    if (net.pairingStatus == "pairing" && net.pairingCode.length() == 6) {
      renderOled("PAIR DEVICE", "Code: " + net.pairingCode,
                 "Enter on dashboard", "Waiting for user");
    } else if (net.pairingStatus == "claimed") {
      renderOled("DEVICE PAIRED", "Household linked",
                 "Connect cylinder", "On dashboard");
    } else {
      renderOled("PAIRING...", "Contacting backend", "Please wait", "");
    }
    return;
  }

  if (!mq2Ready) {
    unsigned long remaining = (MQ2_WARMUP_MS - (millis() - bootStartedAt)) / 1000UL;
    renderOled(weightValid ? "Gross: " + String(currentGrossWeight, 2) + "kg" : "WEIGHT WAITING",
               "MQ-2 WARMING", String(remaining) + " seconds", networkState);
    return;
  }

  if (gasLeakDetected) {
    renderOled("*** GAS LEAK ***",
               weightValid ? "Gross: " + String(currentGrossWeight, 2) + "kg" : "Weight unavailable",
               "MQ-2: " + String(mq2Raw), networkState);
    return;
  }

  renderOled(weightValid ? "Gross: " + String(currentGrossWeight, 2) + "kg" : "WEIGHT WAITING",
             "STATUS: SAFE", "MQ-2: " + String(mq2Raw), networkState);
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

  // Drain and discard the body ourselves rather than calling getString() -
  // its chunked-transfer parser is unreliable through the Cloudflare/Render
  // proxy path and can hang. We only need the status code.
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

    // Fully connected: periodically re-verify pairing hasn't been revoked,
    // and send telemetry on schedule or immediately on a leak-state change.
    if (now - lastPairingCheckAt >= PAIRING_REVALIDATE_MS) {
      lastPairingCheckAt = now;
      refreshPairingState(false);
      // If that just flipped deviceConnected to false, the next loop
      // iteration will drop back into the pairing branch above.
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
