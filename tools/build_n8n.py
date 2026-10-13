"""
สร้าง n8n workflows -> n8n/*.json  (Import ใน n8n: Workflows > Import from File)
  python tools/build_n8n.py
"""
import json
import pathlib
import uuid

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "n8n-src"
OUT = ROOT / "n8n"


def uid():
    return str(uuid.uuid4())


def code(name, file, pos, mode=None):
    js = (SRC / file).read_text(encoding="utf-8")
    if mode:
        js = js.replace("__MODE__", mode)
    return {"parameters": {"jsCode": js}, "id": uid(), "name": name,
            "type": "n8n-nodes-base.code", "typeVersion": 2, "position": pos}


def http_json(name, url, body_expr, pos, headers=None):
    p = {"method": "POST", "url": url, "sendBody": True, "specifyBody": "json", "jsonBody": body_expr, "options": {}}
    if headers:
        p["sendHeaders"] = True
        p["headerParameters"] = {"parameters": [{"name": k, "value": v} for k, v in headers.items()]}
    return {"parameters": p, "id": uid(), "name": name, "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2, "position": pos}


def webhook(name, path, pos):
    return {"parameters": {"httpMethod": "POST", "path": path, "responseMode": "responseNode", "options": {}},
            "id": uid(), "name": name, "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": pos,
            "webhookId": uid()}


def if_ai(pos):
    return {"parameters": {"conditions": {"boolean": [{"value1": "={{ $json.useAI }}", "value2": True}]}},
            "id": uid(), "name": "AI key set?", "type": "n8n-nodes-base.if", "typeVersion": 1, "position": pos}


def sticky(text, pos, w=520, h=220):
    return {"parameters": {"content": text, "width": w, "height": h}, "id": uid(), "name": "Note",
            "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": pos}


AI = http_json("AI (OpenAI-compatible)", "={{ $env.AI_BASE_URL }}/chat/completions",
               "={{ JSON.stringify($json.request) }}", [900, 200],
               {"Authorization": "=Bearer {{ $env.AI_API_KEY }}"})
TG = http_json("Telegram sendMessage", "=https://api.telegram.org/bot{{ $env.TELEGRAM_BOT_TOKEN }}/sendMessage",
               "={{ JSON.stringify({ chat_id: $json.chat_id, text: $json.text }) }}", [1340, 300])


def respond(pos):
    return {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ ok: true, text: $json.text }) }}", "options": {}},
            "id": uid(), "name": "Respond (ผลลัพธ์)", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
            "position": pos}


def workflow(wid, name, triggers, mode, note):
    q = code("Query InfluxDB", "query_influx.js", [460, 300], mode)
    iff = if_ai([680, 300])
    ai = dict(AI, id=uid())
    fmt = code("Format message", "format_message.js", [1120, 300])
    tg = dict(TG, id=uid(), onError="continueRegularOutput")
    rsp = respond([1340, 480])
    nodes = [sticky(note, [140, -20])] + triggers + [q, iff, ai, fmt, tg, rsp]
    conn = {t["name"]: {"main": [[{"node": "Query InfluxDB", "type": "main", "index": 0}]]} for t in triggers}
    conn["Query InfluxDB"] = {"main": [[{"node": "AI key set?", "type": "main", "index": 0}]]}
    conn["AI key set?"] = {"main": [[{"node": ai["name"], "type": "main", "index": 0}],
                                    [{"node": "Format message", "type": "main", "index": 0}]]}
    conn[ai["name"]] = {"main": [[{"node": "Format message", "type": "main", "index": 0}]]}
    conn["Format message"] = {"main": [[{"node": tg["name"], "type": "main", "index": 0},
                                        {"node": rsp["name"], "type": "main", "index": 0}]]}
    return {"id": wid, "name": name, "nodes": nodes, "connections": conn, "active": False,
            "settings": {"executionOrder": "v1", "timezone": "Asia/Bangkok"}, "pinData": {}, "tags": []}


report = workflow(
    "SFshiftReport001",
    "Smart Factory – AI Shift Report",
    [webhook("Telegram /report", "factory-report", [220, 220]),
     {"parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 0 0,8,16 * * *"}]}},
      "id": uid(), "name": "ทุกสิ้นกะ (00/08/16 น.)", "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2, "position": [220, 400]}],
    "report",
    "## AI Shift Report\nTrigger: คำสั่ง /report ใน Telegram (ผ่าน Node-RED) หรืออัตโนมัติทุกสิ้นกะ\n"
    "InfluxDB -> สรุปข้อมูล -> AI วิเคราะห์ -> ส่ง Telegram\nถ้ายังไม่ตั้ง AI_API_KEY จะส่งรายงานแบบไม่ใช้ AI แทน",
)
ask = workflow(
    "SFaskAI000000001",
    "Smart Factory – Ask AI",
    [webhook("Telegram /ask", "factory-ask", [220, 300])],
    "ask",
    "## Ask AI\n/ask <คำถาม> ใน Telegram -> Node-RED -> webhook นี้\nAI ตอบจากข้อมูลจริงใน InfluxDB เท่านั้น",
)

OUT.mkdir(exist_ok=True)
for fname, wf in [("workflow-ai-shift-report.json", report), ("workflow-ask-ai.json", ask)]:
    (OUT / fname).write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", fname, len(wf["nodes"]), "nodes")
