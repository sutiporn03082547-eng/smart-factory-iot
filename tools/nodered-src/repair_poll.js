// =====================================================================
// ดึงใบแจ้งซ่อมใหม่จาก Google Form (ผ่าน Apps Script) ทุก 20 วินาที
// =====================================================================
const url = env.get("SHEETS_URL") || "";
if (!url || url.includes("CHANGE_ME")) return null;
const last = flow.get("repairLastRow");
// ครั้งแรกหลังเปิดระบบ: ขอแค่เลขแถวล่าสุด ไม่ย้อนทำใบเก่า
const after = last === undefined ? -1 : last;
return { url: `${url}?action=repairs&after=${after}`, method: "GET" };
