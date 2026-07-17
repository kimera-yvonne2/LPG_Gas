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

// -----------------------------------------------------------------------------
// Project configuration
// -----------------------------------------------------------------------------

// Replace these two values before testing backend communication.
const char* API_BASE_URL = "https://slms-9k6l.onrender.com/api/v1";
const char* DEVICE_SECRET = "REPLACE_WITH_A_UNIQUE_DEVICE_SECRET";

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
const int MQ2_LEAK_THRESHOLD = 1500;
const int MQ2_CLEAR_THRESHOLD = 1350;
const unsigned long MQ2_WARMUP_MS = 60000UL;

const unsigned long SENSOR_INTERVAL_MS = 200UL;
const unsigned long OLED_INTERVAL_MS = 500UL;
const unsigned long TELEMETRY_INTERVAL_MS = 30000UL;
const unsigned long WIFI_RECHECK_MS = 5000UL;
const unsigned long BACKEND_RECHECK_MS = 10000UL;
const unsigned long BUTTON_DEBOUNCE_MS = 50UL;
const unsigned long ALARM_FLASH_MS = 300UL;
const unsigned long BACKOFF_BASE_MS = 2000UL;
const unsigned long BACKOFF_MAX_MS = 300000UL;

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

bool oledAvailable = false;
bool hx711Detected = false;
bool tareConfigured = false;
bool weightValid = false;
bool mq2Ready = false;
bool gasLeakDetected = false;
bool backendReady = false;
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
unsigned long lastTelemetryAt = 0;
unsigned long lastWifiCheckAt = 0;
unsigned long lastBackendCheckAt = 0;
unsigned long lastAlarmFlashAt = 0;
unsigned long lastPostFailureAt = 0;
unsigned long telemetryBackoffMs = 0;

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
void waitForBackendBlocking();
void processCommunications();
bool sendTelemetry();
String makeMessageId();

// -----------------------------------------------------------------------------
// Setup and main loop
// -----------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(100);
  bootStartedAt = millis();
  bootSessionId = esp_random();

  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_MQ2_AOUT, INPUT);
  pinMode(PIN_BUTTON_RESET_WIFI, INPUT_PULLUP);
  pinMode(PIN_BUTTON_TARE, INPUT_PULLUP);

  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_BUZZER, LOW);

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
  if (scale.wait_ready_timeout(1000)) {
    hx711Detected = true;
    scale.set_scale(LOADCELL_CALIBRATION_FACTOR);

    preferences.begin("lpg-device", true);
    tareConfigured = preferences.isKey("tare_offset");
    if (tareConfigured) {
      savedTareOffset = preferences.getLong("tare_offset", 0);
      scale.set_offset(savedTareOffset);
      Serial.print("Loaded tare offset: ");
      Serial.println(savedTareOffset);
    }
    preferences.end();
  }

  if (!tareConfigured) {
    Serial.println("No saved tare. Empty the platform and press the TARE button on GPIO 11.");
  }

  // This is intentionally blocking for this project: no telemetry or normal
  // application operation starts until household Wi-Fi has been configured.
  connectWifiBlocking();

  // TLS certificate validation needs a valid clock.
  synchronizeClockBlocking(30000UL);

  // Also intentionally blocking: the device does not become operationally
  // online until Django's health endpoint answers successfully. Local sensing
  // and the alarm are serviced while waiting for the backend.
  waitForBackendBlocking();

  Serial.println("Device setup complete.");
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

  processCommunications();
  delay(2);
}

// -----------------------------------------------------------------------------
// Buttons and tare
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
    hx711Detected = false;
    tareConfigured = false;
    weightValid = false;
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
    tareConfigured = false;
    weightValid = false;
    renderOled("TARE FAILED", "Could not save", "Try again");
    delay(2000);
    return;
  }

  scale.set_offset(savedTareOffset);
  hx711Detected = true;
  tareConfigured = true;
  weightValid = false;
  weightSampleIndex = 0;
  weightSampleCount = 0;
  memset(weightSamples, 0, sizeof(weightSamples));

  Serial.print("Tare saved: ");
  Serial.println(savedTareOffset);
  renderOled("TARE COMPLETE", "Offset saved", "Place cylinder");
  delay(2000);
}

// -----------------------------------------------------------------------------
// Sensors and local alarm
// -----------------------------------------------------------------------------

void readSensors() {
  long mq2Total = 0;
  for (uint8_t i = 0; i < 8; ++i) {
    mq2Total += analogRead(PIN_MQ2_AOUT);
    delayMicroseconds(100);
  }
  mq2Raw = static_cast<int>(mq2Total / 8);
  mq2Ready = millis() - bootStartedAt >= MQ2_WARMUP_MS;

  if (!mq2Ready) {
    gasLeakDetected = false;
  } else if (!gasLeakDetected && mq2Raw >= MQ2_LEAK_THRESHOLD) {
    gasLeakDetected = true;
  } else if (gasLeakDetected && mq2Raw <= MQ2_CLEAR_THRESHOLD) {
    gasLeakDetected = false;
  }

  if (!scale.wait_ready_timeout(80)) {
    hx711Detected = false;
    weightValid = false;
    return;
  }

  if (!hx711Detected) {
    // A recovered HX711 must have calibration and tare reapplied before use.
    hx711Detected = true;
    scale.set_scale(LOADCELL_CALIBRATION_FACTOR);
    if (tareConfigured) {
      scale.set_offset(savedTareOffset);
    }
  }

  if (!tareConfigured) {
    weightValid = false;
    return;
  }

  float measuredWeight = scale.get_units(1);
  if (!isfinite(measuredWeight) || measuredWeight < -0.15f || measuredWeight > 20.0f) {
    weightValid = false;
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

  currentGrossWeight = total / weightSampleCount;
  weightValid = weightSampleCount >= MIN_VALID_WEIGHT_SAMPLES;
}

void updateAlarm() {
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
// OLED
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
  String networkState = WiFi.status() == WL_CONNECTED
                            ? (backendReady ? "BACKEND ONLINE" : "BACKEND WAIT")
                            : "WI-FI OFFLINE";

  if (!tareConfigured) {
    renderOled("TARE REQUIRED", "Remove cylinder", "Press GPIO 11", networkState);
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
// Blocking initial connectivity and backend health
// -----------------------------------------------------------------------------

void connectWifiBlocking() {
  renderOled("WI-FI SETUP", "Connect phone to", setupAccessPointName,
             "Password: admin123");

  WiFiManager manager;
  manager.setConnectTimeout(20);
  // No config-portal timeout: remain in setup until valid Wi-Fi is supplied.
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

bool checkBackendHealth() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  WiFiClientSecure client;
  client.setCACert(ROOT_CA_CERT);
  HTTPClient http;
  http.setConnectTimeout(5000);
  http.setTimeout(5000);

  String url = String(API_BASE_URL) + "/health/";
  if (!http.begin(client, url)) {
    return false;
  }

  int status = http.GET();
  http.end();
  Serial.printf("Backend health response: %d\n", status);
  return status >= 200 && status < 300;
}

void waitForBackendBlocking() {
  while (!backendReady) {
    if (WiFi.status() != WL_CONNECTED) {
      connectWifiBlocking();
      synchronizeClockBlocking(30000UL);
    }

    renderOled("BACKEND CHECK", "Wi-Fi connected", "Waiting for API", "Retrying...");
    backendReady = checkBackendHealth();
    if (backendReady) {
      renderOled("BACKEND ONLINE", "Connection ready", "Device: " + deviceId.substring(deviceId.length() - 6));
      break;
    }

    // Keep local monitoring and both buttons operational while Django wakes up.
    unsigned long retryStartedAt = millis();
    while (millis() - retryStartedAt < BACKEND_RECHECK_MS) {
      handleButtons();
      if (millis() - lastSensorAt >= SENSOR_INTERVAL_MS) {
        lastSensorAt = millis();
        readSensors();
        updateAlarm();
      }
      delay(5);
    }
  }
}

// -----------------------------------------------------------------------------
// Runtime communications and telemetry
// -----------------------------------------------------------------------------

void processCommunications() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    backendReady = false;
    if (now - lastWifiCheckAt >= WIFI_RECHECK_MS) {
      lastWifiCheckAt = now;
      WiFi.reconnect();
    }
    return;  // Never attempt telemetry while offline.
  }

  if (!backendReady) {
    if (now - lastBackendCheckAt >= BACKEND_RECHECK_MS) {
      lastBackendCheckAt = now;
      backendReady = checkBackendHealth();
    }
    return;  // Never attempt telemetry until health verification passes.
  }

  bool leakChanged = mq2Ready && gasLeakDetected != lastReportedLeakState;
  bool normalIntervalElapsed = now - lastTelemetryAt >= TELEMETRY_INTERVAL_MS;
  bool backoffElapsed = telemetryBackoffMs == 0 || now - lastPostFailureAt >= telemetryBackoffMs;

  if ((leakChanged || normalIntervalElapsed) && backoffElapsed) {
    sendTelemetry();
  }
}

bool sendTelemetry() {
  WiFiClientSecure client;
  client.setCACert(ROOT_CA_CERT);

  HTTPClient http;
  http.setConnectTimeout(5000);
  http.setTimeout(5000);

  String url = String(API_BASE_URL) + "/device/telemetry/";
  if (!http.begin(client, url)) {
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-ID", deviceId);
  http.addHeader("X-Device-Secret", DEVICE_SECRET);

  JsonDocument payload;
  payload["message_id"] = makeMessageId();
  if (weightValid) {
    payload["weight"] = currentGrossWeight;
  } else {
    payload["weight"] = nullptr;
  }
  payload["mq2_raw"] = mq2Raw;
  payload["mq2_ready"] = mq2Ready;
  payload["gas_leak_detected"] = mq2Ready ? gasLeakDetected : false;
  payload["hx711_ok"] = hx711Detected && tareConfigured && weightValid;

  String body;
  serializeJson(payload, body);
  int status = http.POST(body);
  String responseBody = http.getString();
  http.end();

  Serial.printf("Telemetry response: %d\n", status);
  if (responseBody.length() > 0) {
    Serial.println(responseBody);
  }

  if (status >= 200 && status < 300) {
    lastTelemetryAt = millis();
    lastReportedLeakState = gasLeakDetected;
    telemetryBackoffMs = 0;
    return true;
  }

  lastPostFailureAt = millis();
  telemetryBackoffMs = telemetryBackoffMs == 0
                           ? BACKOFF_BASE_MS
                           : min(telemetryBackoffMs * 2UL, BACKOFF_MAX_MS);

  // Authentication/not-found errors require backend or provisioning work;
  // keep the local monitor running but recheck backend health before retrying.
  if (status == 401 || status == 403 || status == 404) {
    backendReady = false;
  }
  return false;
}

String makeMessageId() {
  ++messageSequence;
  char buffer[64];
  snprintf(buffer, sizeof(buffer), "%s-%08lX-%08lX", deviceId.c_str(),
           static_cast<unsigned long>(bootSessionId),
           static_cast<unsigned long>(messageSequence));
  return String(buffer);
}
