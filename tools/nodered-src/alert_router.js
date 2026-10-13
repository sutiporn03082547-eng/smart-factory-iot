// =====================================================================
// Alert router  (input: msg.payload = alert จาก Process machine data)
// output 1 -> Telegram (ข้อความ + ปุ่มเปิด Google Form แจ้งซ่อม)
// output 2 -> Google Sheets (แท็บ Alarms)
// =====================================================================
const a = msg.payload;
const icon = { critical: "🔴 CRITICAL", warning: "🟠 WARNING", info: "🟢 INFO" }[a.level] || a.level;
const time = new Date(a.ts).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

let buttons = null;
const form = env.get("FORM_PREFILL_URL") || "";
if ((a.type === "TRIP" || a.type === "PREDICT") && form && !form.includes("CHANGE_ME")) {
    buttons = [[{ text: `📝 แจ้งซ่อม ${a.machine} (Google Form)`, url: form.replace("{machine}", encodeURIComponent(a.machine)) }]];
}

const tg = {
    payload: {
        text: `<b>${icon}</b> | ${time}\n${a.text}`,
        buttons,
    },
};

const sheet = {
    payload: {
        action: "alarm",
        row: [time, a.machine, a.name || "", a.level, a.type, a.text.replace(/\n/g, " | ")],
    },
};
return [tg, sheet];
