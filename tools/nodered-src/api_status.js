// =====================================================================
// GET /api/status -> JSON สถานะเครื่องทั้งหมด
// ใช้กับหน้า Factory Portal บน Azure (เข้าผ่าน DDNS + Port Forwarding, W9)
// =====================================================================
const latest = global.get("latest") || {};
const machines = Object.keys(latest).sort().map((k) => {
    const d = latest[k];
    return {
        machine: d.machine, name: d.name, zone: d.zone, state: d.state, state_code: d.state_code,
        temp: d.temp, vibration: d.vibration, oee: d.oee, count_total: d.count_total,
        online: Date.now() - d.received < 15000,
    };
});
const oee = machines.length ? machines.reduce((s, m) => s + Number(m.oee || 0), 0) / machines.length : 0;
msg.payload = { updated: new Date().toISOString(), factory_oee: Math.round(oee * 10000) / 10000, machines };
return msg;
