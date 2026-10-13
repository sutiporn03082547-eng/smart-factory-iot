/*
 * =====================================================================
 *  Smart Factory – Machine M6 "ESP32 Test Rig" (จำลองบน Wokwi ไม่ต้องมีบอร์ดจริง)
 * =====================================================================
 *  เปิด https://wokwi.com/projects/new/esp32 แล้ววางไฟล์ 3 ไฟล์
 *    sketch.ino, diagram.json, libraries.txt
 *  แก้ TOPIC_PREFIX ให้ตรงกับ HIVEMQ_PREFIX ในไฟล์ .env แล้วกด ▶
 *
 *  อุปกรณ์ในวงจรจำลอง
 *    DHT22         -> อุณหภูมิเครื่อง (คลิกที่เซนเซอร์เพื่อปรับค่าได้)
 *    Potentiometer -> ความสั่นสะเทือน 0-15 mm/s (หมุนเกิน 11 = Trip)
 *    Push button   -> ปุ่มฉุกเฉิน (E-Stop)
 *    LED เขียว/แดง -> สถานะ RUNNING / ALARM (กะพริบ = MAINTENANCE)
 *
 *  ส่งข้อมูล : <prefix>/factory/data/M6   (รูปแบบ JSON เดียวกับตัวจำลอง Python)
 *  รับคำสั่ง : <prefix>/factory/cmd/M6    {"action":"stop|start|repair|maintenance|fault"}
 * =====================================================================
 */
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHTesp.h>

#define TOPIC_PREFIX "smf-ba60aa63"   // <-- ต้องตรงกับ HIVEMQ_PREFIX
#define MACHINE_ID   "M6"

const char* WIFI_SSID = "Wokwi-GUEST";
const char* MQTT_HOST = "broker.hivemq.com";
const int   MQTT_PORT = 1883;

const int PIN_DHT = 15, PIN_VIB = 34, PIN_ESTOP = 4, PIN_LED_OK = 26, PIN_LED_ALARM = 27;
const float TEMP_TRIP = 95.0, VIB_TRIP = 11.0;
const float IDEAL_PPM = 6.0;                 // ชิ้น/นาที

enum State { STOPPED = 0, RUNNING = 1, ALARM = 2, MAINTENANCE = 3 };
const char* STATE_NAME[] = {"STOPPED", "RUNNING", "ALARM", "MAINTENANCE"};

WiFiClient net;
PubSubClient mqtt(net);
DHTesp dht;

State state = RUNNING;
String tripReason = "";
String fault = "none";
unsigned long shiftStart, runMs = 0, lastTick = 0;
unsigned long total = 0, good = 0, reject = 0;
float partAcc = 0;
char topicData[96], topicCmd[96];

void setState(State s) { state = s; }

void onCommand(char* topic, byte* payload, unsigned int len) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, len)) return;
  String action = doc["action"] | "";
  Serial.printf("[CMD] %s\n", action.c_str());
  if (action == "stop") setState(STOPPED);
  else if (action == "start" && state != ALARM) setState(RUNNING);
  else if (action == "maintenance") setState(MAINTENANCE);
  else if (action == "repair") { fault = "none"; tripReason = ""; setState(RUNNING); }
  else if (action == "fault") { fault = doc["fault"] | "jam"; tripReason = fault; setState(ALARM); }
}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, "", 6);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(250); Serial.print("."); }
  Serial.printf(" OK %s\n", WiFi.localIP().toString().c_str());
}

void connectMqtt() {
  while (!mqtt.connected()) {
    String cid = "sf-m6-" + String((uint32_t)esp_random(), HEX);
    Serial.printf("MQTT %s ... ", MQTT_HOST);
    if (mqtt.connect(cid.c_str())) {
      Serial.println("connected");
      mqtt.subscribe(topicCmd);
    } else {
      Serial.printf("fail rc=%d\n", mqtt.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_ESTOP, INPUT_PULLUP);
  pinMode(PIN_LED_OK, OUTPUT);
  pinMode(PIN_LED_ALARM, OUTPUT);
  dht.setup(PIN_DHT, DHTesp::DHT22);
  snprintf(topicData, sizeof(topicData), "%s/factory/data/%s", TOPIC_PREFIX, MACHINE_ID);
  snprintf(topicCmd, sizeof(topicCmd), "%s/factory/cmd/%s", TOPIC_PREFIX, MACHINE_ID);
  connectWiFi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onCommand);
  mqtt.setBufferSize(768);
  shiftStart = millis();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  // ปุ่มฉุกเฉิน
  if (digitalRead(PIN_ESTOP) == LOW && state == RUNNING) { tripReason = "estop"; setState(ALARM); }

  // LED
  digitalWrite(PIN_LED_OK, state == RUNNING);
  digitalWrite(PIN_LED_ALARM, state == ALARM || (state == MAINTENANCE && (millis() / 400) % 2));

  if (millis() - lastTick < 2000) return;
  unsigned long dtMs = millis() - lastTick;
  lastTick = millis();

  TempAndHumidity th = dht.getTempAndHumidity();
  float temp = isnan(th.temperature) ? 0 : th.temperature;
  float vib = analogRead(PIN_VIB) / 4095.0 * 15.0;
  if (state != RUNNING) vib *= 0.05;

  if (state == RUNNING) {
    runMs += dtMs;
    partAcc += IDEAL_PPM * random(88, 101) / 100.0 * dtMs / 60000.0;
    while (partAcc >= 1) {
      partAcc -= 1; total++;
      if (random(1000) < 20 + vib * 10) reject++; else good++;
    }
    if (temp >= TEMP_TRIP) { tripReason = "overtemp"; setState(ALARM); }
    else if (vib >= VIB_TRIP) { tripReason = "overvibration"; setState(ALARM); }
  }

  float planned = max(1.0f, (millis() - shiftStart) / 1000.0f);
  float runSec = runMs / 1000.0f;
  float availability = min(1.0f, runSec / planned);
  float performance = runSec > 30 ? min(1.0f, (60.0f / IDEAL_PPM * total) / runSec) : 1.0f;
  float quality = total ? (float)good / total : 1.0f;

  JsonDocument doc;
  doc["machine"] = MACHINE_ID;
  doc["name"] = "ESP32 Test Rig (Wokwi)";
  doc["line"] = "B";
  doc["zone"] = "Zone B";
  doc["state"] = STATE_NAME[state];
  doc["state_code"] = (int)state;
  doc["fault"] = fault;
  doc["trip_reason"] = state == ALARM ? tripReason : "";
  doc["temp"] = round(temp * 100) / 100.0;
  doc["vibration"] = round(vib * 1000) / 1000.0;
  doc["rpm"] = state == RUNNING ? 1450 + random(-10, 11) : 0;
  doc["count_total"] = total;
  doc["count_good"] = good;
  doc["count_reject"] = reject;
  doc["availability"] = availability;
  doc["performance"] = performance;
  doc["quality"] = quality;
  doc["oee"] = availability * performance * quality;
  doc["wear"] = 0;

  char buf[640];
  size_t n = serializeJson(doc, buf);
  mqtt.publish(topicData, buf, n);
  Serial.println(buf);
}
