"""
สร้าง nodered/flows.json จากไฟล์ JavaScript ใน tools/nodered-src/
แก้โค้ดในไฟล์ .js แล้วรัน:  python tools/build_flows.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "nodered-src"
OUT = ROOT / "nodered" / "flows.json"

nodes = []


def js(name):
    return (SRC / name).read_text(encoding="utf-8")


def add(node):
    nodes.append(node)
    return node["id"]


T1, T2 = "tab_pipeline", "tab_telegram"
BR_LOCAL, BR_HIVE = "broker_local", "broker_hivemq"

# ---------------- tabs & config ----------------
add({"id": T1, "type": "tab", "label": "1. Data Pipeline", "disabled": False,
     "info": "รับข้อมูลเครื่องจักรผ่าน MQTT -> InfluxDB / Google Sheets / Telegram Alert / API สำหรับ Portal"})
add({"id": T2, "type": "tab", "label": "2. Telegram Bot & Maintenance", "disabled": False,
     "info": "รับคำสั่งจาก Telegram, ปิดลูปใบแจ้งซ่อมจาก Google Form, เรียก n8n AI"})

for bid, name, host in [(BR_LOCAL, "Local Mosquitto", "mosquitto"), (BR_HIVE, "HiveMQ Public (Wokwi M6)", "broker.hivemq.com")]:
    add({"id": bid, "type": "mqtt-broker", "name": name, "broker": host, "port": "1883", "clientid": "",
         "autoConnect": True, "usetls": False, "protocolVersion": "4", "keepalive": "60", "cleansession": True,
         "autoUnsubscribe": True, "birthTopic": "", "birthQos": "0", "birthPayload": "", "birthMsg": {},
         "closeTopic": "", "closeQos": "0", "closePayload": "", "closeMsg": {}, "willTopic": "", "willQos": "0",
         "willPayload": "", "willMsg": {}, "userProps": "", "sessionExpiry": ""})


def comment(z, x, y, name, info=""):
    return add({"id": f"c_{z}_{x}_{y}", "type": "comment", "z": z, "name": name, "info": info, "x": x, "y": y, "wires": []})


def func(id_, z, x, y, name, file, outputs, wires):
    return add({"id": id_, "type": "function", "z": z, "name": name, "func": js(file), "outputs": outputs,
                "timeout": 0, "noerr": 0, "initialize": "", "finalize": "", "libs": [], "x": x, "y": y, "wires": wires})


def http(id_, z, x, y, name, wires, ret="obj"):
    return add({"id": id_, "type": "http request", "z": z, "name": name, "method": "use", "ret": ret,
                "paytoqs": "ignore", "url": "", "tls": "", "persist": False, "proxy": "", "insecureHTTPParser": False,
                "authType": "", "senderr": False, "headers": [], "x": x, "y": y, "wires": wires})


def mqtt_in(id_, z, x, y, name, topic, broker, wires):
    return add({"id": id_, "type": "mqtt in", "z": z, "name": name, "topic": topic, "qos": "0", "datatype": "json",
                "broker": broker, "nl": False, "rap": True, "rh": 0, "inputs": 0, "x": x, "y": y, "wires": wires})


def mqtt_out(id_, z, x, y, name, broker):
    return add({"id": id_, "type": "mqtt out", "z": z, "name": name, "topic": "", "qos": "", "retain": "",
                "respTopic": "", "contentType": "", "userProps": "", "correl": "", "expiry": "", "broker": broker,
                "x": x, "y": y, "wires": []})


def inject(id_, z, x, y, name, repeat, delay, wires):
    return add({"id": id_, "type": "inject", "z": z, "name": name, "props": [{"p": "payload"}], "repeat": str(repeat),
                "crontab": "", "once": True, "onceDelay": str(delay), "topic": "", "payload": "", "payloadType": "date",
                "x": x, "y": y, "wires": wires})


def debug(id_, z, x, y, name, active=False):
    return add({"id": id_, "type": "debug", "z": z, "name": name, "active": active, "tosidebar": True, "console": False,
                "tostatus": False, "complete": "true", "targetType": "full", "statusVal": "", "statusType": "auto",
                "x": x, "y": y, "wires": []})


def catch(id_, z, x, y, wires):
    return add({"id": id_, "type": "catch", "z": z, "name": "Errors", "scope": None, "uncaught": False,
                "x": x, "y": y, "wires": wires})


# ======================= TAB 1: DATA PIPELINE =======================
comment(T1, 190, 40, "① รับข้อมูลเครื่องจักร M1-M5 (Mosquitto) + M6 (Wokwi ESP32 ผ่าน HiveMQ)")
mqtt_in("in_local", T1, 150, 100, "factory/data/+", "factory/data/+", BR_LOCAL, [["fn_process"]])
mqtt_in("in_hive", T1, 160, 160, "HiveMQ M6", "${HIVEMQ_DATA_TOPIC}", BR_HIVE, [["fn_process"]])
func("fn_process", T1, 420, 130, "Process + Alarm + Predictive", "process_machine.js", 2,
     [["http_influx"], ["fn_alert"]])
http("http_influx", T1, 720, 100, "InfluxDB write", [["dbg_influx"]], ret="txt")
debug("dbg_influx", T1, 900, 100, "influx result")

comment(T1, 170, 220, "② Alert -> Telegram + Google Sheets (Alarms)")
func("fn_alert", T1, 660, 180, "Alert router", "alert_router.js", 2, [["fn_tg1"], ["fn_sheet1"]])
func("fn_tg1", T1, 880, 160, "Telegram msg", "telegram_send.js", 1, [["http_tg1"]])
http("http_tg1", T1, 1080, 160, "Telegram API", [["dbg_tg1"]])
debug("dbg_tg1", T1, 1260, 160, "telegram result")

comment(T1, 170, 300, "③ Production log ทุก 1 นาที -> Google Sheets")
inject("inj_log", T1, 160, 340, "ทุก 60 วินาที", 60, 20, [["fn_log"]])
func("fn_log", T1, 380, 340, "Build log rows", "build_log.js", 1, [["fn_sheet1"]])
func("fn_sheet1", T1, 880, 220, "Sheets request", "sheets_send.js", 1, [["http_sheet1"]])
http("http_sheet1", T1, 1080, 220, "Apps Script", [["dbg_sheet1"]], ret="txt")
debug("dbg_sheet1", T1, 1260, 220, "sheets result")

comment(T1, 190, 420, "④ REST API สำหรับ Factory Portal (Azure) – เปิดผ่าน DDNS/Port Forward")
add({"id": "httpin_status", "type": "http in", "z": T1, "name": "", "url": "/api/status", "method": "get",
     "upload": False, "swaggerDoc": "", "x": 170, "y": 460, "wires": [["fn_api"]]})
func("fn_api", T1, 380, 460, "Status JSON", "api_status.js", 1, [["httpres_status"]])
add({"id": "httpres_status", "type": "http response", "z": T1, "name": "", "statusCode": "",
     "headers": {"Access-Control-Allow-Origin": "*", "content-type": "application/json"}, "x": 570, "y": 460, "wires": []})

comment(T1, 200, 520, "⑤ Demo / Control API: GET /api/cmd?machine=M3&action=fault&fault=bearing")
add({"id": "httpin_cmd", "type": "http in", "z": T1, "name": "", "url": "/api/cmd", "method": "get",
     "upload": False, "swaggerDoc": "", "x": 160, "y": 560, "wires": [["fn_cmd"]]})
func("fn_cmd", T1, 380, 560, "Command API", "api_cmd.js", 3, [["mqtt_local1"], ["mqtt_hive1"], ["httpres_cmd"]])
mqtt_out("mqtt_local1", T1, 620, 520, "cmd -> Mosquitto", BR_LOCAL)
mqtt_out("mqtt_hive1", T1, 630, 560, "cmd -> HiveMQ (M6)", BR_HIVE)
add({"id": "httpres_cmd", "type": "http response", "z": T1, "name": "", "statusCode": "",
     "headers": {"Access-Control-Allow-Origin": "*"}, "x": 590, "y": 600, "wires": []})

catch("catch1", T1, 140, 660, [["dbg_err1"]])
debug("dbg_err1", T1, 320, 660, "errors", active=True)

# ================= TAB 2: TELEGRAM BOT & MAINTENANCE =================
comment(T2, 200, 40, "① Telegram Bot: /status /oee /stop /run /fault /maint /repair /report /ask")
inject("inj_tg", T2, 150, 100, "ทุก 3 วินาที", 3, 5, [["fn_tgpoll"]])
func("fn_tgpoll", T2, 340, 100, "getUpdates", "tg_poll.js", 1, [["http_tgpoll"]])
http("http_tgpoll", T2, 530, 100, "Telegram API", [["fn_tgcmd"]])
func("fn_tgcmd", T2, 740, 100, "Command parser", "tg_commands.js", 4,
     [["mqtt_local"], ["mqtt_hive"], ["fn_tg2"], ["http_n8n"]])

mqtt_out("mqtt_local", T2, 1010, 40, "cmd -> Mosquitto", BR_LOCAL)
mqtt_out("mqtt_hive", T2, 1010, 80, "cmd -> HiveMQ (M6)", BR_HIVE)
func("fn_tg2", T2, 1000, 140, "Telegram msg", "telegram_send.js", 1, [["http_tg2"]])
http("http_tg2", T2, 1190, 140, "Telegram API", [["dbg_tg2"]])
debug("dbg_tg2", T2, 1370, 140, "telegram result")
http("http_n8n", T2, 1000, 200, "n8n webhook", [["dbg_n8n"]], ret="txt")
debug("dbg_n8n", T2, 1180, 200, "n8n result")

comment(T2, 220, 280, "② ปิดลูปงานซ่อม: Google Form -> Apps Script -> Node-RED -> เครื่องจักร")
inject("inj_rep", T2, 150, 340, "ทุก 20 วินาที", 20, 10, [["fn_reppoll"]])
func("fn_reppoll", T2, 340, 340, "Poll repairs", "repair_poll.js", 1, [["http_rep"]])
http("http_rep", T2, 530, 340, "Apps Script", [["fn_repproc"]])
func("fn_repproc", T2, 740, 340, "Repair -> command", "repair_process.js", 4,
     [["mqtt_local"], ["mqtt_hive"], ["fn_tg2"], ["http_inf2"]])
http("http_inf2", T2, 1000, 400, "InfluxDB event", [], ret="txt")

catch("catch2", T2, 140, 460, [["dbg_err2"]])
debug("dbg_err2", T2, 320, 460, "errors", active=True)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(nodes, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"wrote {OUT} ({len(nodes)} nodes)")
