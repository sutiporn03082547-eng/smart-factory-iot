// =====================================================================
// Telegram getUpdates (polling ทุก 3 วินาที) - รับคำสั่งจากแชท
// =====================================================================
const token = env.get("TELEGRAM_BOT_TOKEN") || "";
if (!token || token.includes("CHANGE_ME")) return null;

// กันยิงซ้อนถ้ารอบก่อนยังไม่ตอบกลับ (หมดเวลา 15 วินาทีถือว่าค้าง)
const busy = flow.get("tgBusy") || 0;
if (Date.now() - busy < 15000) return null;
flow.set("tgBusy", Date.now());

const offset = flow.get("tgOffset") || 0;
return {
    url: `https://api.telegram.org/bot${token}/getUpdates?timeout=0&offset=${offset}&allowed_updates=%5B%22message%22%5D`,
    method: "GET",
};
