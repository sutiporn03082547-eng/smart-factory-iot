/**
 * =====================================================================
 *  Smart Factory – Google Apps Script (W10: Sheets / Drive / Form / My Maps)
 * =====================================================================
 *  วิธีใช้ (ละเอียดใน docs/02-setup-guide.md ขั้นที่ 4)
 *   1. สร้าง Google Sheets ใหม่ชื่อ "Smart Factory Data"
 *   2. Extensions > Apps Script > วางโค้ดนี้ทั้งไฟล์ > Save
 *   3. เลือกฟังก์ชัน setup แล้วกด Run (อนุญาตสิทธิ์)  -> สร้างแท็บ, โฟลเดอร์ Drive, Google Form
 *   4. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone
 *      -> คัดลอก URL (/exec) ไปใส่ SHEETS_URL ในไฟล์ .env
 *   5. ดู Logs (View > Executions) จะมี FORM_PREFILL_URL ให้คัดลอกไปใส่ .env
 *
 *  Endpoint
 *   POST {action:"log",   rows:[[...]]}   -> แท็บ Log + อัปเดต MapStatus
 *   POST {action:"alarm", row:[...]}      -> แท็บ Alarms
 *   GET  ?action=repairs&after=<row>      -> ใบแจ้งซ่อมใหม่จาก Google Form
 *   GET  ?action=status                   -> สถานะเครื่อง (MapStatus) เป็น JSON
 * =====================================================================
 */

// พิกัดเครื่องจักรสำหรับ Google My Maps (แก้เป็นพิกัดโรงงาน/มหาวิทยาลัยจริงได้)
const MACHINE_LOCATIONS = {
  M1: { zone: 'Zone A – Machining', lat: 13.81970, lng: 100.51380 },
  M2: { zone: 'Zone A – Machining', lat: 13.81985, lng: 100.51410 },
  M3: { zone: 'Zone A – Machining', lat: 13.82000, lng: 100.51440 },
  M4: { zone: 'Zone B – Molding & Packing', lat: 13.81930, lng: 100.51480 },
  M5: { zone: 'Zone B – Molding & Packing', lat: 13.81915, lng: 100.51510 },
  M6: { zone: 'Zone B – Molding & Packing', lat: 13.81900, lng: 100.51540 },
};
// ถ้าสคริปต์ไม่ได้ผูกกับชีต (สร้างจาก script.google.com) ให้ใส่ ID ของ Google Sheets ที่นี่
const SHEET_ID = '';
function ss_() { return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID); }

const MACHINE_LIST = ['M1 - CNC Lathe', 'M2 - CNC Milling', 'M3 - Hydraulic Press',
  'M4 - Injection Molding', 'M5 - Packaging Conveyor', 'M6 - ESP32 Test Rig (Wokwi)'];

const LOG_HEADERS = ['เวลา', 'เครื่อง', 'ชื่อเครื่อง', 'โซน', 'สถานะ', 'อุณหภูมิ (°C)', 'สั่น (mm/s)', 'ผลิตรวม', 'ของดี', 'ของเสีย', 'OEE (%)'];
const ALARM_HEADERS = ['เวลา', 'เครื่อง', 'ชื่อเครื่อง', 'ระดับ', 'ประเภท', 'ข้อความ'];
const MAP_HEADERS = ['Machine', 'Name', 'Zone', 'Latitude', 'Longitude', 'Status', 'OEE (%)', 'Temp (°C)', 'Updated'];

// ---------------------------------------------------------------------
// SETUP (รันครั้งเดียว)
// ---------------------------------------------------------------------
function setup() {
  const ss = ss_();
  ensureSheet_(ss, 'Log', LOG_HEADERS);
  ensureSheet_(ss, 'Alarms', ALARM_HEADERS);
  const map = ensureSheet_(ss, 'MapStatus', MAP_HEADERS);
  if (map.getLastRow() < 2) {
    Object.keys(MACHINE_LOCATIONS).forEach((id, i) => {
      const loc = MACHINE_LOCATIONS[id];
      map.appendRow([id, MACHINE_LIST[i].split(' - ')[1], loc.zone, loc.lat, loc.lng, 'RUNNING', '', '', new Date()]);
    });
  }

  // โฟลเดอร์ Google Drive สำหรับรายงาน PDF
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('REPORT_FOLDER_ID')) {
    const folder = DriveApp.createFolder('SmartFactory Reports');
    props.setProperty('REPORT_FOLDER_ID', folder.getId());
    Logger.log('Drive folder: ' + folder.getUrl());
  }

  // Google Form ใบแจ้งซ่อม
  if (!props.getProperty('FORM_ID')) {
    const form = FormApp.create('ใบแจ้งซ่อม / บันทึกงานซ่อม – Smart Factory');
    form.setDescription('สแกน QR หรือกดปุ่มจาก Telegram เพื่อบันทึกงานซ่อม ระบบจะสั่งเดินเครื่องให้อัตโนมัติเมื่อเลือก "ซ่อมเสร็จ"');
    const mItem = form.addListItem().setTitle('เครื่องจักร').setChoiceValues(MACHINE_LIST).setRequired(true);
    form.addTextItem().setTitle('ชื่อช่าง').setRequired(true);
    form.addParagraphTextItem().setTitle('อาการ / สาเหตุ').setRequired(true);
    form.addParagraphTextItem().setTitle('การแก้ไข').setRequired(true);
    form.addMultipleChoiceItem().setTitle('ผลการซ่อม')
      .setChoiceValues(['ซ่อมเสร็จ', 'รออะไหล่', 'ส่งซ่อมภายนอก']).setRequired(true);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    props.setProperty('FORM_ID', form.getId());

    const prefill = form.createResponse()
      .withItemResponse(mItem.createResponse(MACHINE_LIST[0])).toPrefilledUrl();
    const tpl = prefill.replace(encodeURIComponent(MACHINE_LIST[0]).replace(/%20/g, '+'), '{machine}')
      .replace(encodeURIComponent(MACHINE_LIST[0]), '{machine}');
    props.setProperty('FORM_PREFILL_URL', tpl);
    Logger.log('Form edit URL : ' + form.getEditUrl());
    Logger.log('Form public   : ' + form.getPublishedUrl());
    Logger.log('FORM_PREFILL_URL (ใส่ใน .env) : ' + tpl);
    Logger.log('** เพิ่มคำถาม "รูปภาพประกอบ" แบบ File upload เองในหน้าแก้ไขฟอร์ม (รูปจะถูกเก็บใน Google Drive)');
  }
  Logger.log('Setup เสร็จแล้ว -> Deploy เป็น Web app ต่อได้เลย');
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

// ---------------------------------------------------------------------
// WEB APP
// ---------------------------------------------------------------------
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = ss_();
    if (data.action === 'log' && Array.isArray(data.rows) && data.rows.length) {
      const sh = ss.getSheetByName('Log');
      sh.getRange(sh.getLastRow() + 1, 1, data.rows.length, data.rows[0].length).setValues(data.rows);
      updateMapStatus_(ss, data.rows);
      return json_({ ok: true, appended: data.rows.length });
    }
    if (data.action === 'alarm' && Array.isArray(data.row)) {
      ss.getSheetByName('Alarms').appendRow(data.row);
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'repairs') return json_(getRepairs_(Number(p.after)));
  if (p.action === 'status') {
    const sh = ss_().getSheetByName('MapStatus');
    const values = sh.getDataRange().getValues();
    const head = values.shift();
    return json_(values.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]]))));
  }
  return json_({ ok: true, service: 'Smart Factory Apps Script', actions: ['repairs', 'status'] });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// MapStatus = แหล่งข้อมูลของ Google My Maps (Reimport and merge เพื่ออัปเดต)
function updateMapStatus_(ss, rows) {
  const sh = ss.getSheetByName('MapStatus');
  const values = sh.getDataRange().getValues();
  rows.forEach((r) => {
    const id = r[1];
    const idx = values.findIndex((v) => v[0] === id);
    const loc = MACHINE_LOCATIONS[id] || { zone: r[3], lat: '', lng: '' };
    const row = [id, r[2], loc.zone, loc.lat, loc.lng, r[4], r[10], r[5], new Date()];
    if (idx > 0) sh.getRange(idx + 1, 1, 1, row.length).setValues([row]);
    else { sh.appendRow(row); values.push(row); }
  });
}

// อ่านคำตอบ Google Form (แท็บที่ผูกกับฟอร์ม)
function getRepairs_(after) {
  const ss = ss_();
  const sh = ss.getSheets().find((s) => s.getFormUrl());
  if (!sh) return { lastRow: 1, repairs: [], note: 'ยังไม่ได้ผูก Google Form' };
  const last = sh.getLastRow();
  if (after < 0 || last <= Math.max(1, after)) return { lastRow: last, repairs: [] };

  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const col = (kw) => head.findIndex((h) => h.indexOf(kw) >= 0);
  const c = {
    ts: 0, machine: col('เครื่องจักร'), tech: col('ช่าง'), cause: col('สาเหตุ'),
    action: col('การแก้ไข'), result: col('ผลการซ่อม'), photo: col('รูป'),
  };
  const start = Math.max(2, after + 1);
  const rows = sh.getRange(start, 1, last - start + 1, head.length).getValues();
  const repairs = rows.map((r, i) => ({
    row: start + i,
    timestamp: r[c.ts],
    machine: c.machine >= 0 ? String(r[c.machine]) : '',
    technician: c.tech >= 0 ? r[c.tech] : '',
    cause: c.cause >= 0 ? r[c.cause] : '',
    action: c.action >= 0 ? r[c.action] : '',
    result: c.result >= 0 ? r[c.result] : '',
    photo: c.photo >= 0 ? String(r[c.photo]).split(',')[0].trim() : '',
  }));
  return { lastRow: last, repairs };
}

// ---------------------------------------------------------------------
// รายงานประจำวัน -> PDF เก็บใน Google Drive (+ แจ้ง Telegram ถ้าตั้งค่า)
// ตั้ง Script properties: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (ไม่บังคับ)
// ---------------------------------------------------------------------
function dailyReport() {
  const ss = ss_();
  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const since = new Date(Date.now() - 24 * 3600 * 1000);

  const latest = {};
  const logs = ss.getSheetByName('Log').getDataRange().getValues().slice(1);
  logs.forEach((r) => { latest[r[1]] = r; });
  const alarms = ss.getSheetByName('Alarms').getDataRange().getValues().slice(1)
    .filter((r) => !(r[0] instanceof Date) || r[0] >= since);
  const repairsSheet = ss.getSheets().find((s) => s.getFormUrl());
  const repairs = repairsSheet ? repairsSheet.getDataRange().getValues().slice(1).filter((r) => r[0] >= since) : [];

  const ids = Object.keys(latest).sort();
  const avgOee = ids.length ? ids.reduce((s, k) => s + Number(latest[k][10] || 0), 0) / ids.length : 0;
  const td = (v) => `<td style="border:1px solid #ccc;padding:4px 8px">${v}</td>`;
  const html = `
  <h1 style="font-family:sans-serif">Smart Factory – Daily Report ${today}</h1>
  <h2 style="font-family:sans-serif">OEE โรงงาน: ${avgOee.toFixed(1)}%</h2>
  <table style="border-collapse:collapse;font-family:sans-serif;font-size:12px">
   <tr>${['เครื่อง', 'ชื่อ', 'สถานะ', 'อุณหภูมิ', 'สั่น', 'ผลิต', 'ของเสีย', 'OEE %'].map(td).join('')}</tr>
   ${ids.map((k) => { const r = latest[k]; return `<tr>${[r[1], r[2], r[4], r[5], r[6], r[7], r[9], r[10]].map(td).join('')}</tr>`; }).join('')}
  </table>
  <h3 style="font-family:sans-serif">Alarms 24 ชม. (${alarms.length})</h3>
  <ul style="font-family:sans-serif;font-size:12px">${alarms.slice(-30).map((a) => `<li>${a[0]} | ${a[1]} | ${a[3]} | ${a[5]}</li>`).join('')}</ul>
  <h3 style="font-family:sans-serif">งานซ่อม 24 ชม. (${repairs.length})</h3>
  <ul style="font-family:sans-serif;font-size:12px">${repairs.map((r) => `<li>${r.slice(0, 6).join(' | ')}</li>`).join('')}</ul>`;

  const props = PropertiesService.getScriptProperties();
  const folder = DriveApp.getFolderById(props.getProperty('REPORT_FOLDER_ID'));
  const pdf = folder.createFile(Utilities.newBlob(html, 'text/html', `report-${today}.html`).getAs('application/pdf'))
    .setName(`SmartFactory-Report-${today}.pdf`);
  Logger.log('PDF: ' + pdf.getUrl());

  const token = props.getProperty('TELEGRAM_BOT_TOKEN');
  const chat = props.getProperty('TELEGRAM_CHAT_ID');
  if (token && chat) {
    UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ chat_id: chat, text: `📄 รายงานประจำวัน ${today}\nOEE ${avgOee.toFixed(1)}% | Alarm ${alarms.length} | งานซ่อม ${repairs.length}\n${pdf.getUrl()}` }),
    });
  }
}

// ตั้งเวลาให้ dailyReport ทำงานทุกวัน 23:00
function installTriggers() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'dailyReport')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyReport').timeBased().everyDays(1).atHour(23).create();
  Logger.log('ตั้งเวลา dailyReport ทุกวัน 23:00 แล้ว');
}
