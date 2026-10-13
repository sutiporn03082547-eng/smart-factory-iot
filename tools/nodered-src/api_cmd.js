// =====================================================================
// GET /api/cmd?machine=M3&action=fault&fault=bearing
//   action: stop | start | fault | maintenance | repair | reset_shift
//   machine: M1-M6 หรือ all
// ใช้กับ TEST-FAULT.bat, ปุ่มเดโม และทดสอบจากเบราว์เซอร์
// ถ้าตั้ง CMD_API_KEY ใน .env ต้องส่ง &key=... ด้วย (แนะนำเมื่อเปิด Port Forwarding)
// output 1 -> MQTT local | output 2 -> MQTT HiveMQ (M6) | output 3 -> http response
// =====================================================================
const q = msg.req.query || {};
const key = env.get("CMD_API_KEY") || "";
const reply = (code, body) => [null, null, { req: msg.req, res: msg.res, statusCode: code, payload: body }];

if (key && q.key !== key) return reply(403, { ok: false, error: "invalid key" });

const action = String(q.action || "").toLowerCase();
const allowed = ["stop", "start", "fault", "maintenance", "repair", "reset_shift"];
if (!allowed.includes(action)) return reply(400, { ok: false, error: "action must be one of " + allowed.join(", ") });

const target = String(q.machine || "").toUpperCase();
if (!/^(M\d+|ALL)$/.test(target)) return reply(400, { ok: false, error: "machine must be M1..M6 or all" });

const body = { action, by: "api" };
if (action === "fault") body.fault = String(q.fault || "bearing").toLowerCase();

const prefix = env.get("HIVEMQ_PREFIX") || "smf";
const local = [], hive = [];
if (target === "ALL") {
    local.push({ topic: "factory/cmd/all", payload: JSON.stringify(body) });
    hive.push({ topic: `${prefix}/factory/cmd/M6`, payload: JSON.stringify(body) });
} else if (target === "M6") {
    hive.push({ topic: `${prefix}/factory/cmd/M6`, payload: JSON.stringify(body) });
} else {
    local.push({ topic: `factory/cmd/${target}`, payload: JSON.stringify(body) });
}
node.status({ fill: "blue", shape: "dot", text: `${target} ${action} ${body.fault || ""}` });
return [local, hive, { req: msg.req, res: msg.res, statusCode: 200, payload: { ok: true, machine: target, ...body } }];
