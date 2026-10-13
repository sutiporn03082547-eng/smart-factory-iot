// =====================================================================
// Production log ทุก 1 นาที -> Google Sheets แท็บ Log (W10)
// อ่านค่าล่าสุดของทุกเครื่องจาก flow context
// =====================================================================
const latest = global.get("latest") || {};
const ids = Object.keys(latest).sort();
if (!ids.length) return null;

const time = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
const rows = ids.map((id) => {
    const d = latest[id];
    return [
        time, d.machine, d.name || "", d.zone || "", d.state,
        d.temp, d.vibration, d.count_total, d.count_good, d.count_reject,
        Math.round((d.oee || 0) * 1000) / 10,
    ];
});
return { payload: { action: "log", rows } };
