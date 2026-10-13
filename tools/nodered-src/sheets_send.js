// =====================================================================
// Google Sheets (Apps Script Web App) builder (W10)
// input: msg.payload = { action: "log"|"alarm"|..., ... }
// output -> http request POST SHEETS_URL
// =====================================================================
const url = env.get("SHEETS_URL") || "";
if (!url || url.includes("CHANGE_ME")) {
    node.status({ fill: "grey", shape: "ring", text: "SHEETS_URL ยังไม่ตั้งค่า" });
    return null;
}
node.status({ fill: "green", shape: "dot", text: msg.payload.action + " " + new Date().toLocaleTimeString() });
return {
    url,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    payload: JSON.stringify(msg.payload),
};
