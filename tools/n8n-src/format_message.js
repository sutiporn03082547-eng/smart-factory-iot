// =====================================================================
// n8n Code node: แปลงคำตอบ AI เป็นข้อความ Telegram
// =====================================================================
const prep = $('Query InfluxDB').first().json;
const ai = $input.first().json || {};
let text = ai.choices && ai.choices[0] && ai.choices[0].message ? ai.choices[0].message.content : prep.fallback;
text = String(text || prep.fallback).replace(/[*#`]/g, '').trim();
const head = prep.mode === 'ask' ? '🤖 AI ตอบจากข้อมูลจริง' : '📋 รายงานกะการผลิต (AI)';
const time = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
return [{ json: { chat_id: prep.chat_id, text: `${head} | ${time}\n\n${text}`.slice(0, 4000) } }];
