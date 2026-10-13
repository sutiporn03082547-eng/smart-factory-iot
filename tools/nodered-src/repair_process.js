// =====================================================================
// ปิดลูปงานซ่อม: Google Form -> Node-RED -> สั่งเครื่อง + แจ้ง Telegram
// input : { lastRow, repairs: [{row, timestamp, machine, technician, cause, action, result, photo}] }
// output 1 -> MQTT local (M1-M5) | output 2 -> MQTT HiveMQ (M6)
// output 3 -> Telegram          | output 4 -> InfluxDB event
// =====================================================================
const r = msg.payload;
if (!r || typeof r !== "object" || r.lastRow === undefined) {
    node.status({ fill: "red", shape: "ring", text: "Apps Script ตอบกลับไม่ถูกต้อง" });
    return null;
}
const first = flow.get("repairLastRow") === undefined;
flow.set("repairLastRow", r.lastRow);
if (first) {
    node.status({ fill: "green", shape: "dot", text: `พร้อมรับใบซ่อม (แถวล่าสุด ${r.lastRow})` });
    return null;
}

const prefix = env.get("HIVEMQ_PREFIX") || "smf";
const out1 = [], out2 = [], out3 = [], out4 = [];
const str = (v) => '"' + String(v ?? "").replace(/(["\\])/g, "\\$1") + '"';

for (const j of r.repairs || []) {
    const id = String(j.machine || "").toUpperCase().match(/M\d+/);
    if (!id) continue;
    const mid = id[0];
    const done = /เสร็จ|done|complete|ok/i.test(j.result || "");
    const action = done ? "repair" : "maintenance";
    const cmd = { payload: JSON.stringify({ action, by: j.technician || "form" }) };
    if (mid === "M6") { cmd.topic = `${prefix}/factory/cmd/M6`; out2.push(cmd); }
    else { cmd.topic = `factory/cmd/${mid}`; out1.push(cmd); }

    const text = done
        ? `🔧 <b>${mid} ซ่อมเสร็จ</b> โดย ${j.technician || "-"}\nสาเหตุ: ${j.cause || "-"}\nการแก้ไข: ${j.action || "-"}\n➡️ ระบบสั่งเดินเครื่องอัตโนมัติแล้ว`
        : `🛠️ <b>${mid} เข้าโหมดซ่อมบำรุง</b> (${j.result || "รอดำเนินการ"}) โดย ${j.technician || "-"}\nสาเหตุ: ${j.cause || "-"}`;
    const photo = j.photo ? `\n📷 <a href="${j.photo}">รูปประกอบ (Google Drive)</a>` : "";
    out3.push({ payload: { text: text + photo } });

    out4.push({
        url: `${env.get("INFLUX_URL")}/api/v2/write?org=${encodeURIComponent(env.get("INFLUX_ORG"))}&bucket=${encodeURIComponent(env.get("INFLUX_BUCKET"))}&precision=ms`,
        method: "POST",
        headers: { Authorization: "Token " + env.get("INFLUX_TOKEN"), "Content-Type": "text/plain; charset=utf-8" },
        payload: `event,machine=${mid},level=info,type=${done ? "REPAIRED" : "MAINTENANCE"} message=${str(`${j.technician || ""}: ${j.cause || ""} -> ${j.action || ""}`)},value=1i ${Date.now()}`,
    });
}
node.status({ fill: "green", shape: "dot", text: `แถวล่าสุด ${r.lastRow} | ใบใหม่ ${(r.repairs || []).length}` });
return [out1, out2, out3, out4];
