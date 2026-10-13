// =====================================================================
// Telegram command parser
// output 1 -> MQTT คำสั่งเครื่อง M1-M5 (local Mosquitto)
// output 2 -> MQTT คำสั่งเครื่อง M6 (Wokwi ESP32 ผ่าน HiveMQ)
// output 3 -> ตอบกลับ Telegram
// output 4 -> เรียก n8n (AI report / ถาม AI)
// =====================================================================
flow.set("tgBusy", 0);
const res = msg.payload;
if (!res || !res.ok || !Array.isArray(res.result)) return null;

const allowed = (env.get("TELEGRAM_ALLOWED") || env.get("TELEGRAM_CHAT_ID") || "")
    .split(",").map((x) => x.trim()).filter(Boolean);
const latest = global.get("latest") || {};
const prefix = env.get("HIVEMQ_PREFIX") || "smf";
const n8n = env.get("N8N_URL") || "http://n8n:5678";

const out1 = [], out2 = [], out3 = [], out4 = [];
const reply = (chat_id, text) => out3.push({ payload: { chat_id, text } });
const pct = (v) => (Number(v || 0) * 100).toFixed(1) + "%";
const dot = (c) => ["⚪", "🟢", "🔴", "🟠"][c] || "⚪";

function sendCmd(id, body) {
    const m = { topic: null, payload: JSON.stringify(body) };
    if (id === "M6") { m.topic = `${prefix}/factory/cmd/M6`; out2.push(m); }
    else { m.topic = `factory/cmd/${id}`; out1.push(m); }
}
function targets(arg) {
    if (!arg) return [];
    const a = arg.toUpperCase();
    if (a === "ALL") return Object.keys(latest).sort();
    return /^M\d+$/.test(a) ? [a] : [];
}
function statusLine(d) {
    return `${dot(d.state_code)} <b>${d.machine}</b> ${d.name || ""}\n   ${d.state} | ${Number(d.temp).toFixed(1)}°C | ${Number(d.vibration).toFixed(2)} mm/s | OEE ${pct(d.oee)}`;
}

const HELP = [
    "<b>🏭 Smart Factory Bot</b>",
    "/status – สถานะทุกเครื่อง",
    "/status M3 – รายละเอียดเครื่อง",
    "/oee – สรุป OEE ทั้งโรงงาน",
    "/stop M3 | /run M3 – หยุด/เดินเครื่อง (ใช้ all ได้)",
    "/fault M3 bearing|overheat|jam – จำลองเครื่องเสีย",
    "/maint M3 – เข้าสู่โหมดซ่อมบำรุง",
    "/repair M3 – ซ่อมเสร็จ เดินเครื่องต่อ",
    "/report – ให้ AI สรุปรายงานกะ",
    "/ask คำถาม – ถาม AI จากข้อมูลจริง",
].join("\n");

let maxId = flow.get("tgOffset") || 0;
for (const u of res.result) {
    maxId = Math.max(maxId, u.update_id + 1);
    const m = u.message;
    if (!m || !m.text) continue;
    const chat = String(m.chat.id);
    if (allowed.length && !allowed.includes(chat)) {
        reply(chat, `⛔ chat นี้ไม่มีสิทธิ์สั่งงาน (chat_id: ${chat})`);
        continue;
    }
    const [rawCmd, ...rest] = m.text.trim().split(/\s+/);
    const cmd = rawCmd.split("@")[0].toLowerCase();
    const arg = rest[0];
    const ids = targets(arg);

    switch (cmd) {
        case "/start":
        case "/help":
            reply(chat, HELP);
            break;
        case "/status": {
            if (ids.length === 1 && latest[ids[0]]) {
                const d = latest[ids[0]];
                reply(chat, [
                    statusLine(d),
                    `   RPM ${d.rpm} | Wear ${pct(d.wear)} | Fault: ${d.fault}`,
                    `   ผลิต ${d.count_total} (ดี ${d.count_good} / เสีย ${d.count_reject})`,
                    `   A ${pct(d.availability)} × P ${pct(d.performance)} × Q ${pct(d.quality)} = OEE ${pct(d.oee)}`,
                ].join("\n"));
            } else {
                const lines = Object.keys(latest).sort().map((k) => statusLine(latest[k]));
                reply(chat, lines.length ? "<b>📊 สถานะเครื่องจักร</b>\n" + lines.join("\n") : "ยังไม่มีข้อมูลจากเครื่องจักร");
            }
            break;
        }
        case "/oee": {
            const ds = Object.values(latest);
            if (!ds.length) { reply(chat, "ยังไม่มีข้อมูล"); break; }
            const avg = ds.reduce((s, d) => s + Number(d.oee || 0), 0) / ds.length;
            const total = ds.reduce((s, d) => s + Number(d.count_total || 0), 0);
            const worst = ds.slice().sort((a, b) => a.oee - b.oee)[0];
            reply(chat, `<b>📈 OEE โรงงาน ${pct(avg)}</b>\nผลิตรวม ${total} ชิ้น\nต่ำสุด: ${worst.machine} ${pct(worst.oee)}\n(มาตรฐานระดับโลก ≥ 85%)`);
            break;
        }
        case "/stop":
        case "/run":
        case "/maint":
        case "/repair": {
            if (!ids.length) { reply(chat, `ระบุเครื่องด้วย เช่น ${cmd} M3`); break; }
            const action = { "/stop": "stop", "/run": "start", "/maint": "maintenance", "/repair": "repair" }[cmd];
            ids.forEach((id) => sendCmd(id, { action, by: m.from.first_name || "telegram" }));
            reply(chat, `📨 ส่งคำสั่ง <b>${action}</b> ไปที่ ${ids.join(", ")} แล้ว`);
            break;
        }
        case "/fault": {
            if (!ids.length) { reply(chat, "เช่น /fault M3 bearing"); break; }
            const f = (rest[1] || "bearing").toLowerCase();
            ids.forEach((id) => sendCmd(id, { action: "fault", fault: f }));
            reply(chat, `🧪 จำลองความเสียหาย <b>${f}</b> ที่ ${ids.join(", ")}`);
            break;
        }
        case "/report":
            out4.push({ url: `${n8n}/webhook/factory-report`, method: "POST", headers: { "Content-Type": "application/json" }, payload: { chat_id: chat } });
            reply(chat, "⏳ กำลังให้ AI สรุปรายงานกะ...");
            break;
        case "/ask": {
            const q = rest.join(" ").trim();
            if (!q) { reply(chat, "เช่น /ask เครื่องไหนน่าห่วงที่สุดตอนนี้"); break; }
            out4.push({ url: `${n8n}/webhook/factory-ask`, method: "POST", headers: { "Content-Type": "application/json" }, payload: { chat_id: chat, question: q } });
            reply(chat, "🤖 กำลังวิเคราะห์ข้อมูล...");
            break;
        }
        default:
            reply(chat, "ไม่รู้จักคำสั่งนี้ พิมพ์ /help");
    }
}
flow.set("tgOffset", maxId);
return [out1, out2, out3, out4];
