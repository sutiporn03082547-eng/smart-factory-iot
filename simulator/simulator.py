"""
Smart Factory - Virtual Machine Simulator
=========================================
จำลองเครื่องจักรในไลน์ผลิต ส่งข้อมูลผ่าน MQTT ทุก TICK_SEC วินาที
และรับคำสั่งกลับ (stop / start / fault / repair) จาก Node-RED / Telegram

Topic ที่ใช้
  publish   : factory/data/<machine>   (JSON)
  subscribe : factory/cmd/<machine>    (JSON {"action": "...", "fault": "..."})
              factory/cmd/all

สถานะเครื่อง (state_code)
  0 = STOPPED, 1 = RUNNING, 2 = ALARM (Trip), 3 = MAINTENANCE

โหมดเสียจำลอง (fault)
  bearing  : ลูกปืนสึก -> ค่าสั่นค่อยๆ ไต่ขึ้น (ใช้ทดสอบ Predictive Alert)
  overheat : ระบายความร้อนผิดปกติ -> อุณหภูมิขึ้นเร็ว
  jam      : ชิ้นงานติด -> ยอดผลิตหยุด แล้ว Trip ภายใน ~20 วินาที
"""
import json
import math
import os
import random
import sys
import threading
import time
from datetime import datetime, timezone

# ---------------- Config ----------------
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
TICK_SEC = float(os.getenv("TICK_SEC", "2"))
FAULT_PROB = float(os.getenv("FAULT_PROB", "0.0005"))  # โอกาสเกิด fault เองต่อ tick ต่อเครื่อง
SHIFT_HOURS = float(os.getenv("SHIFT_HOURS", "8"))
FAULT_SPEED = float(os.getenv("FAULT_SPEED", "1.5"))  # ความเร็วการลุกลามของ fault (เดโม 5 นาทีใช้ 1.5)
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"  # 1 = ไม่ต่อ MQTT แค่ print (ใช้ทดสอบ)
SEED = os.getenv("SEED")

TEMP_TRIP = 95.0      # องศา C
VIB_TRIP = 11.0       # mm/s (ISO 10816 zone D)

STATE_NAMES = {0: "STOPPED", 1: "RUNNING", 2: "ALARM", 3: "MAINTENANCE"}

MACHINES = [
    # id,   name,                 line, zone,  ideal parts/min, base temp, base vib
    ("M1", "CNC Lathe",           "A",  "Zone A", 12, 55.0, 1.8),
    ("M2", "CNC Milling",         "A",  "Zone A", 10, 58.0, 2.2),
    ("M3", "Hydraulic Press",     "A",  "Zone A", 20, 62.0, 2.8),
    ("M4", "Injection Molding",   "B",  "Zone B", 15, 70.0, 1.5),
    ("M5", "Packaging Conveyor",  "B",  "Zone B", 30, 45.0, 1.2),
]

if SEED:
    random.seed(int(SEED))


def now_ms() -> int:
    return int(time.time() * 1000)


class Machine:
    def __init__(self, mid, name, line, zone, ideal_ppm, base_temp, base_vib):
        self.id = mid
        self.name = name
        self.line = line
        self.zone = zone
        self.ideal_ppm = ideal_ppm
        self.base_temp = base_temp
        self.base_vib = base_vib

        self.state = 1
        self.fault = None
        self.fault_ticks = 0
        self.temp = base_temp
        self.vib = base_vib
        self.rpm = 0.0
        self.wear = 0.0          # 0..1 การสึกหรอสะสม
        self.reset_shift()
        self.lock = threading.Lock()

    # ---- shift / OEE counters ----
    def reset_shift(self):
        self.shift_start = time.time()
        self.run_sec = 0.0
        self.total = 0
        self.good = 0
        self.reject = 0
        self._part_acc = 0.0
        self.downtime_events = 0

    # ---- commands ----
    def command(self, action: str, fault: str | None = None) -> str:
        with self.lock:
            action = (action or "").lower()
            if action == "stop":
                self.state = 0
                return f"{self.id} stopped"
            if action == "start":
                if self.state == 2:
                    return f"{self.id} is in ALARM - repair first"
                self.state = 1
                return f"{self.id} started"
            if action == "fault":
                f = (fault or random.choice(["bearing", "overheat", "jam"])).lower()
                if f not in ("bearing", "overheat", "jam"):
                    return f"unknown fault {f}"
                self.fault = f
                self.fault_ticks = 0
                return f"{self.id} fault injected: {f}"
            if action == "maintenance":
                self.state = 3
                return f"{self.id} under maintenance"
            if action == "repair":
                self.fault = None
                self.fault_ticks = 0
                self.wear = 0.0
                self.vib = self.base_vib
                self.temp = min(self.temp, self.base_temp + 5)
                self.state = 1
                return f"{self.id} repaired and running"
            if action == "reset_shift":
                self.reset_shift()
                return f"{self.id} shift counters reset"
            return f"unknown action {action}"

    # ---- physics step ----
    def step(self, dt: float):
        with self.lock:
            # สุ่มเกิด fault เอง (ถ้าตั้ง FAULT_PROB > 0)
            if self.state == 1 and self.fault is None and random.random() < FAULT_PROB:
                self.fault = random.choice(["bearing", "overheat", "jam"])
                self.fault_ticks = 0

            running = self.state == 1
            if self.fault and running:  # ความเสียหายลุกลามเฉพาะตอนเครื่องเดิน
                self.fault_ticks += 1

            # --- rpm ---
            target_rpm = 1450.0 if running else 0.0
            self.rpm += (target_rpm - self.rpm) * 0.5
            self.rpm = max(0.0, self.rpm + (random.gauss(0, 8) if running else 0))

            # --- temperature (first-order toward target) ---
            load_heat = 18.0 if running else 0.0
            target_temp = self.base_temp + load_heat - 15.0 + self.wear * 10
            if self.fault == "overheat" and running:
                target_temp += min(60.0, 6.0 * (self.fault_ticks * FAULT_SPEED) ** 0.8)
            self.temp += (target_temp - self.temp) * 0.08 + random.gauss(0, 0.25)

            # --- vibration (mm/s RMS) ---
            if running:
                if self.fault == "bearing":
                    self.wear = min(1.0, self.wear + 0.012 * FAULT_SPEED)
                else:
                    self.wear = min(1.0, self.wear + 0.00002)
                target_vib = self.base_vib + self.wear * 9.5
                self.vib += (target_vib - self.vib) * 0.25 + abs(random.gauss(0, 0.12))
            else:
                self.vib += (0.05 - self.vib) * 0.6
            self.vib = max(0.0, self.vib)

            # --- production ---
            if running:
                self.run_sec += dt
                ppm = self.ideal_ppm * random.uniform(0.88, 1.0)
                if self.fault == "jam":
                    ppm = 0.0
                self._part_acc += ppm * dt / 60.0
                new_parts = int(self._part_acc)
                self._part_acc -= new_parts
                reject_rate = 0.015 + self.wear * 0.15 + (0.1 if self.fault == "overheat" else 0)
                for _ in range(new_parts):
                    self.total += 1
                    if random.random() < reject_rate:
                        self.reject += 1
                    else:
                        self.good += 1

            # --- protection trip ---
            if running:
                reason = None
                if self.temp >= TEMP_TRIP:
                    reason = "overtemp"
                elif self.vib >= VIB_TRIP:
                    reason = "overvibration"
                elif self.fault == "jam" and self.fault_ticks * dt >= 20:
                    reason = "jam"
                if reason:
                    self.state = 2
                    self.trip_reason = reason
                    self.downtime_events += 1

    def oee(self):
        planned = max(1.0, time.time() - self.shift_start)
        availability = min(1.0, self.run_sec / planned)
        ideal_cycle_sec = 60.0 / self.ideal_ppm
        performance = min(1.0, (ideal_cycle_sec * self.total) / self.run_sec) if self.run_sec > 30 else 1.0
        quality = (self.good / self.total) if self.total else 1.0
        return availability, performance, quality, availability * performance * quality

    def payload(self) -> dict:
        with self.lock:
            a, p, q, o = self.oee()
            return {
                "machine": self.id,
                "name": self.name,
                "line": self.line,
                "zone": self.zone,
                "ts": now_ms(),
                "state": STATE_NAMES[self.state],
                "state_code": self.state,
                "fault": self.fault or "none",
                "trip_reason": getattr(self, "trip_reason", "") if self.state == 2 else "",
                "temp": round(self.temp, 2),
                "vibration": round(self.vib, 3),
                "rpm": round(self.rpm, 1),
                "count_total": self.total,
                "count_good": self.good,
                "count_reject": self.reject,
                "availability": round(a, 4),
                "performance": round(p, 4),
                "quality": round(q, 4),
                "oee": round(o, 4),
                "wear": round(self.wear, 3),
            }


class Factory:
    def __init__(self):
        self.machines = {m[0]: Machine(*m) for m in MACHINES}
        self.client = None

    # ---------- MQTT ----------
    def connect(self):
        import paho.mqtt.client as mqtt

        try:
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"factory-sim-{random.randint(1000,9999)}")
        except AttributeError:  # paho < 2.0
            client = mqtt.Client(client_id=f"factory-sim-{random.randint(1000,9999)}")

        def on_connect(c, userdata, flags, rc, properties=None):
            print(f"[MQTT] connected rc={rc} -> subscribe factory/cmd/#", flush=True)
            c.subscribe("factory/cmd/#")

        def on_message(c, userdata, msg):
            self.handle_command(msg.topic, msg.payload)

        client.on_connect = on_connect
        client.on_message = on_message
        client.will_set("factory/status/simulator", "offline", retain=True)
        while True:
            try:
                client.connect(MQTT_HOST, MQTT_PORT, keepalive=30)
                break
            except Exception as e:  # broker ยังไม่พร้อม
                print(f"[MQTT] connect failed ({e}) retry in 3s", flush=True)
                time.sleep(3)
        client.loop_start()
        client.publish("factory/status/simulator", "online", retain=True)
        self.client = client

    def handle_command(self, topic: str, raw: bytes):
        try:
            target = topic.split("/")[-1]
            text = raw.decode("utf-8").strip()
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                data = {"action": text}
            action = data.get("action")
            fault = data.get("fault")
            ids = list(self.machines) if target.lower() == "all" else [target.upper()]
            for mid in ids:
                m = self.machines.get(mid)
                if not m:
                    continue
                result = m.command(action, fault)
                print(f"[CMD] {mid}: {result}", flush=True)
                ack = {"machine": mid, "action": action, "result": result, "ts": now_ms()}
                if self.client:
                    self.client.publish(f"factory/ack/{mid}", json.dumps(ack))
        except Exception as e:
            print(f"[CMD] error {e}", flush=True)

    # ---------- main loop ----------
    def run(self, max_ticks: int | None = None):
        if not DRY_RUN:
            self.connect()
        ticks = 0
        next_t = time.time()
        while True:
            for m in self.machines.values():
                if time.time() - m.shift_start >= SHIFT_HOURS * 3600:
                    m.reset_shift()
                m.step(TICK_SEC)
                data = m.payload()
                if DRY_RUN:
                    print(json.dumps(data, ensure_ascii=False), flush=True)
                else:
                    self.client.publish(f"factory/data/{m.id}", json.dumps(data, ensure_ascii=False))
            ticks += 1
            if max_ticks and ticks >= max_ticks:
                return
            next_t += TICK_SEC
            time.sleep(max(0.0, next_t - time.time()))


if __name__ == "__main__":
    print(f"Smart Factory Simulator | broker={MQTT_HOST}:{MQTT_PORT} tick={TICK_SEC}s "
          f"machines={len(MACHINES)} dry_run={DRY_RUN}", flush=True)
    max_ticks = int(sys.argv[1]) if len(sys.argv) > 1 else None
    Factory().run(max_ticks)
