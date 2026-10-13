// =====================================================================
// Telegram sendMessage builder (W11)
// input: msg.payload = { text, chat_id?, buttons? }
// output -> http request (POST https://api.telegram.org/bot<TOKEN>/sendMessage)
// =====================================================================
const token = env.get("TELEGRAM_BOT_TOKEN") || "";
const chat = msg.payload.chat_id || env.get("TELEGRAM_CHAT_ID");
if (!token || token.includes("CHANGE_ME") || !chat || String(chat).includes("CHANGE_ME")) {
    node.status({ fill: "grey", shape: "ring", text: "Telegram ยังไม่ตั้งค่า token/chat_id" });
    return null;
}
const body = {
    chat_id: chat,
    text: msg.payload.text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
};
if (msg.payload.buttons) body.reply_markup = { inline_keyboard: msg.payload.buttons };

node.status({ fill: "blue", shape: "dot", text: "sent " + new Date().toLocaleTimeString() });
return {
    url: `https://api.telegram.org/bot${token}/sendMessage`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    payload: body,
};
