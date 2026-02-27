#include <Adafruit_Fingerprint.h>
#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include <SoftwareSerial.h>

// --- CONFIGURATION ---
const char *ssid = "MOTO";
const char *password = "00001111";

// R307 Sensor Pins (SoftwareSerial)
// TX of Sensor (White/Yellow) -> D5 (GPIO 14) of ESP
// RX of Sensor (Green)        -> D6 (GPIO 12) of ESP
SoftwareSerial mySerial(14, 12);

Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);
ESP8266WebServer server(80);

// Global State
int lastMatchID = -1;
unsigned long lastMatchTime = 0;
bool isEnrolling = false;
int enrollStep = 0;
int enrollID = -1;
String statusMessage = "Idle";
unsigned long lastStatusUpdate = 0;

void setup() {
  Serial.begin(115200);
  delay(10);

  // 1. Initialize Sensor
  Serial.println("\n\nAttendance System Starting...");

  // Try default baud rate 57600
  Serial.println("Attempting to connect to sensor at 57600 baud...");
  finger.begin(57600);
  delay(100);

  if (finger.verifyPassword()) {
    Serial.println("Found fingerprint sensor at 57600 baud!");
  } else {
    Serial.println("Initial attempt failed. Trying 9600 baud fallback...");
    finger.begin(9600);
    delay(100);
    if (finger.verifyPassword()) {
      Serial.println("Found fingerprint sensor at 9600 baud!");
    } else {
      Serial.println("CRITICAL: Fingerprint sensor NOT FOUND.");
      Serial.println("1. Check Wiring: VCC to 3.3V/5V, GND to GND.");
      Serial.println(
          "2. Swap TX/RX: Is Sensor White/Yellow on D5? Is Green on D6?");
      Serial.println(
          "3. Power: Does the sensor blink red when you plug it in?");
      while (1) {
        delay(1000);
      }
    }
  }

  // 2. Connect WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi (");
  Serial.print(ssid);
  Serial.println(")");

  int retryCount = 0;
  bool wifiConnected = true;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    retryCount++;
    if (retryCount > 30) { // ~15 seconds timeout
      wifiConnected = false;
      break;
    }
  }

  if (wifiConnected) {
    Serial.println("");
    Serial.print("Connected! IP address: ");
    Serial.println(WiFi.localIP());

    if (MDNS.begin("attendance")) {
      Serial.println("mDNS responder started: http://attendance.local");
    }
  } else {
    Serial.println("\nWiFi Failed. Starting Access Point...");
    WiFi.softAP("Attendance-Scanner", "12345678");
    Serial.print("AP IP address: ");
    Serial.println(WiFi.softAPIP());
    Serial.println(
        "Connect to 'Attendance-Scanner' WiFi and use IP 192.168.4.1");
  }

  // 3. Setup Web Server Routes

  // CORS Headers for all responses
  server.enableCORS(true);

  server.on("/", HTTP_GET, []() {
    server.send(200, "text/plain", "Attendance Sensor Online");
  });

  server.on("/status", HTTP_GET, []() {
    String json = "{\"status\":\"" + statusMessage +
                  "\", \"last_match\":" + String(lastMatchID) + "}";
    server.send(200, "application/json", json);
  });

  server.on("/poll", HTTP_GET, []() {
    // Return last match and clear it to avoid double counting
    String json;
    if (lastMatchID != -1 && (millis() - lastMatchTime < 5000)) {
      json = "{\"match_id\":" + String(lastMatchID) + "}";
      // Optional: Clear immediately or let client handle debounce
      // lastMatchID = -1;
    } else {
      json = "{\"match_id\":-1}";
    }
    server.send(200, "application/json", json);
  });

  server.on("/enroll", HTTP_GET, []() {
    if (server.hasArg("id")) {
      enrollID = server.arg("id").toInt();
      isEnrolling = true;
      statusMessage = "Enrolling ID " + String(enrollID);
      server.send(200, "application/json",
                  "{\"message\":\"Enrollment Started\"}");
    } else {
      server.send(400, "application/json", "{\"error\":\"Missing ID\"}");
    }
  });

  server.begin();
}

void loop() {
  server.handleClient();

  if (isEnrolling) {
    handleEnrollment();
  } else {
    handleScanning();
  }
}

// --- SCANNING LOGIC ---
void handleScanning() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK)
    return;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK)
    return;

  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_OK) {
    // Found a match!
    Serial.print("Found ID #");
    Serial.print(finger.fingerID);
    Serial.print(" with confidence of ");
    Serial.println(finger.confidence);

    lastMatchID = finger.fingerID;
    lastMatchTime = millis();
    statusMessage = "Matched ID " + String(lastMatchID);
  } else {
    lastMatchID = -1;
    statusMessage = "Scanning...";
  }
}

void handleEnrollment() {
  uint8_t p;

  switch (enrollStep) {
  case 0: // Ask for first scan
    statusMessage = "Waiting for finger for ID " + String(enrollID);
    Serial.println(statusMessage);
    p = finger.getImage();
    if (p == FINGERPRINT_OK) {
      p = finger.image2Tz(1);
      if (p == FINGERPRINT_OK) {
        statusMessage = "Remove finger...";
        Serial.println(statusMessage);
        enrollStep = 1;
      }
    }
    break;

  case 1: // Wait for removal
    p = finger.getImage();
    if (p == FINGERPRINT_NOFINGER) {
      statusMessage = "Place same finger again...";
      Serial.println(statusMessage);
      enrollStep = 2;
    }
    break;

  case 2: // Ask for second scan
    p = finger.getImage();
    if (p == FINGERPRINT_OK) {
      p = finger.image2Tz(2);
      if (p == FINGERPRINT_OK) {
        p = finger.createModel();
        if (p == FINGERPRINT_OK) {
          p = finger.storeModel(enrollID);
          if (p == FINGERPRINT_OK) {
            statusMessage = "Enrolled Success for ID " + String(enrollID);
            Serial.println(statusMessage);
            isEnrolling = false;
            enrollStep = 0;
          } else {
            statusMessage = "Error storing model";
            isEnrolling = false;
            enrollStep = 0;
          }
        } else {
          statusMessage = "Fingerprints did not match";
          isEnrolling = false;
          enrollStep = 0;
        }
      }
    }
    break;
  }
}
