// =====================================================================
// Process machine data  (input: msg.payload = JSON จากเครื่องจักร)
// output 1 -> InfluxDB write (line protocol)
// output 2 -> Alert (ส่งต่อ Telegram / Sheets)
// =====================================================================
const d = msg.payload;
if (!d || typeof d !== "object" || !d.machine) {
    node.warn("invalid machine payload");
    return null;
}

const TEMP_WARN = 85;      // C
const VIB_TRIP = 11;       // mm/s
const VIB_PREDICT = 4.5;   // เริ่มดูแนวโน้มเมื่อเกินค่านี้
const SLOPE_PREDICT = 0.03; // mm/s ต่อ sample
const HIST = 10;           // จำนวน sample ล่าสุดที่ใช้คำนวณแนวโน้ม
const now = Date.now();
const ts = Number(d.ts) || now;

// ---------- เก็บค่าล่าสุดไว้ใช้กับ /status, Sheets, /api/status ----------
const latest = global.get("latest") || {};
latest[d.machine] = Object.assign({}, d, { received: now });
global.set("latest", latest);

// ---------- InfluxDB line protocol ----------
const esc = (v) => String(v).replace(/([,= \\])/g, "\\$1");
const str = (v) => '"' + String(v ?? "").replace(/(["\\])/g, "\\$1") + '"';
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const int = (v) => Math.round(num(v)) + "i";

const tags = [
    "machine=" + esc(d.machine),
    "line=" + esc(d.line || "-"),
    "zone=" + esc(d.zone || "-"),
    "name=" + esc(d.name || d.machine),
];
const fields = [
    "temp=" + num(d.temp),
    "vibration=" + num(d.vibration),
    "rpm=" + num(d.rpm),
    "state_code=" + int(d.state_code),
    "count_total=" + int(d.count_total),
    "count_good=" + int(d.count_good),
    "count_reject=" + int(d.count_reject),
    "availability=" + num(d.availability),
    "performance=" + num(d.performance),
    "quality=" + num(d.quality),
    "oee=" + num(d.oee),
    "wear=" + num(d.wear),
    "state=" + str(d.state),
    "fault=" + str(d.fault),
];
const lines = ["machine," + tags.join(",") + " " + fields.join(",") + " " + ts];

// ---------- Alarm / Predictive logic ----------
const st = flow.get("alarmState") || {};
const s = st[d.machine] || { prev: null, last: {}, hist: [], lastTs: ts };
const tick = Math.max(0.5, (ts - (s.lastTs || ts)) / 1000) || 2;
s.lastTs = ts;
s.hist.push(num(d.vibration));
if (s.hist.length > HIST) s.hist.shift();

function slope(arr) {
    const n = arr.length;
    if (n < 8) return 0;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sx += i; sy += arr[i]; sxy += i * arr[i]; sxx += i * i; }
    return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}
function cooled(type, ms) {
    const t = s.last[type] || 0;
    if (now - t < ms) return false;
    s.last[type] = now;
    return true;
}

const alerts = [];
const label = `${d.machine} (${d.name || ""})`;
const code = num(d.state_code);

if (code === 2 && s.prev !== 2) {
    const reason = { overtemp: "อุณหภูมิสูงเกิน", overvibration: "สั่นสะเทือนเกิน", jam: "ชิ้นงานติด" }[d.trip_reason] || d.trip_reason || "ไม่ทราบสาเหตุ";
    alerts.push({ level: "critical", type: "TRIP", text: `🚨 ${label} หยุดฉุกเฉิน: ${reason}\nTemp ${num(d.temp).toFixed(1)}°C | Vib ${num(d.vibration).toFixed(2)} mm/s` });
}
if (code === 1 && num(d.temp) >= TEMP_WARN && cooled("TEMP", 5 * 60 * 1000)) {
    alerts.push({ level: "warning", type: "OVERTEMP", text: `🌡️ ${label} อุณหภูมิสูง ${num(d.temp).toFixed(1)}°C (เกณฑ์เตือน ${TEMP_WARN}°C)` });
}
const sl = slope(s.hist);
if (code === 1 && num(d.vibration) >= VIB_PREDICT && sl >= SLOPE_PREDICT && cooled("PREDICT", 10 * 60 * 1000)) {
    const etaSec = Math.max(0, (VIB_TRIP - num(d.vibration)) / sl * tick);
    const eta = etaSec >= 60 ? `${(etaSec / 60).toFixed(1)} นาที` : `${Math.round(etaSec)} วินาที`;
    alerts.push({
        level: "warning", type: "PREDICT",
        text: `🔮 Predictive: ${label} ค่าสั่นกำลังไต่ขึ้น (${num(d.vibration).toFixed(2)} mm/s, +${sl.toFixed(3)}/รอบ)\nคาดว่าจะ Trip ในอีก ~${eta} แนะนำตรวจลูกปืนก่อนเครื่องพัง`,
    });
}
if (code === 1 && (s.prev === 2 || s.prev === 3)) {
    alerts.push({ level: "info", type: "RECOVER", text: `✅ ${label} กลับมาทำงานปกติแล้ว` });
    s.hist = [];
}
s.prev = code;
st[d.machine] = s;
flow.set("alarmState", st);

// event log ลง InfluxDB (ใช้ทำตาราง Alarm log ใน Grafana)
for (const a of alerts) {
    lines.push(`event,machine=${esc(d.machine)},level=${a.level},type=${a.type} message=${str(a.text.replace(/\n/g, " | "))},value=1i ${ts}`);
}

const influxMsg = {
    url: `${env.get("INFLUX_URL")}/api/v2/write?org=${encodeURIComponent(env.get("INFLUX_ORG"))}&bucket=${encodeURIComponent(env.get("INFLUX_BUCKET"))}&precision=ms`,
    method: "POST",
    headers: { Authorization: "Token " + env.get("INFLUX_TOKEN"), "Content-Type": "text/plain; charset=utf-8" },
    payload: lines.join("\n"),
};

const alertMsgs = alerts.map((a) => ({
    topic: "alert",
    payload: Object.assign({ machine: d.machine, name: d.name, ts }, a),
}));

node.status({ fill: code === 1 ? "green" : code === 2 ? "red" : "yellow", shape: "dot", text: `${d.machine} ${d.state} ${new Date().toLocaleTimeString()}` });
return [influxMsg, alertMsgs.length ? alertMsgs : null];
