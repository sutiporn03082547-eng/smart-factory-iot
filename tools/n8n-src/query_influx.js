// =====================================================================
// n8n Code node: ดึงข้อมูลจาก InfluxDB แล้วเตรียม prompt ให้ AI
// ใช้ร่วมกันทั้ง workflow "Shift Report" และ "Ask AI"
// =====================================================================
const MODE = '__MODE__'; // 'report' | 'ask'
const INFLUX = $env.INFLUX_URL || 'http://influxdb:8086';
const ORG = $env.INFLUX_ORG || 'factory';
const BUCKET = $env.INFLUX_BUCKET || 'machines';
const TOKEN = $env.INFLUX_TOKEN;

const input = $input.first().json || {};
const body = input.body || {};
const chat_id = body.chat_id || $env.TELEGRAM_CHAT_ID;
const question = (body.question || '').toString().slice(0, 500);

// ---------- CSV parser (รองรับค่าที่มี , และ " ) ----------
function splitCsv(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
function parseCsv(text) {
  const rows = []; let header = null;
  for (const raw of String(text).split(/\r?\n/)) {
    if (!raw.trim()) { header = null; continue; }
    const cells = splitCsv(raw);
    if (!header) { header = cells; continue; }
    const r = {};
    header.forEach((h, i) => { if (h && h !== 'result' && h !== 'table') r[h] = cells[i]; });
    rows.push(r);
  }
  return rows;
}
async function flux(query) {
  const res = await this.helpers.httpRequest({
    method: 'POST',
    url: `${INFLUX}/api/v2/query?org=${encodeURIComponent(ORG)}`,
    headers: { Authorization: `Token ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/csv' },
    body: JSON.stringify({ query, type: 'flux', dialect: { header: true, annotations: [] } }),
    json: false,
  });
  return parseCsv(typeof res === 'string' ? res : JSON.stringify(res));
}
const q = flux.bind(this);
const B = `from(bucket: "${BUCKET}")`;

const latest = await q(`${B}
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "machine")
  |> filter(fn: (r) => contains(value: r._field, set: ["temp","vibration","oee","availability","performance","quality","count_total","count_reject","state_code","wear"]))
  |> last()
  |> toFloat()
  |> group(columns: ["machine"])
  |> pivot(rowKey: ["machine"], columnKey: ["_field"], valueColumn: "_value")
  |> group()`);

const peaks = await q(`${B}
  |> range(start: -8h)
  |> filter(fn: (r) => r._measurement == "machine" and (r._field == "temp" or r._field == "vibration"))
  |> group(columns: ["machine", "_field"])
  |> max()
  |> group(columns: ["machine"])
  |> pivot(rowKey: ["machine"], columnKey: ["_field"], valueColumn: "_value")
  |> group()`);

const events = await q(`${B}
  |> range(start: -8h)
  |> filter(fn: (r) => r._measurement == "event" and r._field == "message")
  |> group()
  |> keep(columns: ["_time", "machine", "level", "type", "_value"])
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 30)`);

const STATE = { 0: 'STOPPED', 1: 'RUNNING', 2: 'ALARM', 3: 'MAINTENANCE' };
const pct = (v) => Math.round(Number(v || 0) * 1000) / 10;
const machines = latest.map((r) => {
  const p = peaks.find((x) => x.machine === r.machine) || {};
  return {
    machine: r.machine,
    state: STATE[Number(r.state_code)] || r.state_code,
    oee_pct: pct(r.oee), availability_pct: pct(r.availability),
    performance_pct: pct(r.performance), quality_pct: pct(r.quality),
    produced: Number(r.count_total), rejects: Number(r.count_reject),
    temp_now: Number(r.temp), vib_now: Number(r.vibration),
    temp_max_8h: Number(p.temp), vib_max_8h: Number(p.vibration),
    wear_pct: pct(r.wear),
  };
}).sort((a, b) => a.machine.localeCompare(b.machine));

const factoryOee = machines.length ? Math.round(machines.reduce((s, m) => s + m.oee_pct, 0) / machines.length * 10) / 10 : 0;
const ev = events.map((e) => ({ time: e._time, machine: e.machine, level: e.level, type: e.type, message: e._value }));
const data = { generated_at: new Date().toISOString(), factory_oee_pct: factoryOee, machines, events_8h: ev };

const system = 'คุณคือผู้ช่วยวิศวกรซ่อมบำรุงและผู้จัดการฝ่ายผลิตของโรงงาน ตอบเป็นภาษาไทย กระชับ ใช้เฉพาะข้อมูลที่ให้มาเท่านั้น ห้ามแต่งตัวเลขเอง ' +
  'เกณฑ์: OEE ระดับโลก >= 85%, ความสั่นตามมาตรฐาน ISO 10816 (<4.5 ปกติ, 4.5-7.1 เฝ้าระวัง, >11 อันตราย), อุณหภูมิเตือน 85°C Trip 95°C. ' +
  'ห้ามใช้ Markdown หรือเครื่องหมาย * # ให้ใช้อีโมจิและขึ้นบรรทัดใหม่แทน';
const user = MODE === 'ask'
  ? `คำถามจากผู้ใช้: "${question}"\n\nข้อมูลโรงงานล่าสุด (JSON):\n${JSON.stringify(data)}`
  : `เขียนรายงานสรุปกะการผลิต ไม่เกิน 1,200 ตัวอักษร ประกอบด้วย 1) OEE โรงงานและการประเมิน 2) เครื่องที่ดีที่สุด/แย่ที่สุดพร้อมเหตุผล 3) เหตุการณ์สำคัญ 4) ความเสี่ยงที่ต้องเฝ้าระวัง (ดูแนวโน้มการสั่น/การสึกหรอ) 5) ข้อแนะนำ 3 ข้อสำหรับกะถัดไป\n\nข้อมูล (JSON):\n${JSON.stringify(data)}`;

// รายงานสำรองเมื่อยังไม่ได้ตั้ง AI_API_KEY
const worst = machines.slice().sort((a, b) => a.oee_pct - b.oee_pct)[0];
const fallback = [
  `🏭 สรุปโรงงาน (ไม่ใช้ AI)`,
  `OEE โรงงาน ${factoryOee}%`,
  ...machines.map((m) => `• ${m.machine} ${m.state} | OEE ${m.oee_pct}% | ผลิต ${m.produced} | Vib max ${m.vib_max_8h}`),
  worst ? `ต่ำสุด: ${worst.machine} (${worst.oee_pct}%)` : '',
  `เหตุการณ์ 8 ชม.: ${ev.length} รายการ`,
].join('\n');

const key = $env.AI_API_KEY || '';
return [{
  json: {
    chat_id,
    mode: MODE,
    useAI: Boolean(key) && !key.includes('CHANGE_ME'),
    fallback,
    data,
    request: {
      model: $env.AI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    },
  },
}];
