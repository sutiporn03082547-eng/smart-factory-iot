# ตารางตรวจสอบวัตถุประสงค์การสอน (Traceability Matrix)

ใช้เนื้อหาหลัก **3 สัปดาห์ = 12 วัตถุประสงค์** (W10 Data-Cloud, W11 Private Server, W12 GitHub/Docker/n8n) ตามเกณฑ์อย่างน้อย 3 สัปดาห์ ทุกข้อทดสอบบนเครื่องจริงแล้ว (☑) และมีภาพหลักฐานในรายงาน

> ส่วน W7–W9 ที่ต้องใช้ Azure VM ถูกตัดออก เพราะเครดิต Azure for Students หมด ($0 จาก $100) ความรู้ W8 (Grafana) และ W9 (Self-Server) ยังใช้เสริมในระบบ ดูท้ายไฟล์

## สัปดาห์ที่ 10 – การสร้าง Data-Cloud

| # | วัตถุประสงค์ | ใช้ทำอะไรในโปรเจค | ไฟล์ / จุดที่ทำงาน | หลักฐานที่ต้องเก็บ | ☑ |
|---|---|---|---|---|---|
| W10-1 | Google Sheets | Production Log ทุก 1 นาที, Alarm log, MapStatus ผ่าน Apps Script Web App | `google/apps-script.gs`, Node-RED tab 1 ③ | Sheet มีแถวเพิ่มขึ้นอัตโนมัติ | ☑ |
| W10-2 | Google Drive | รายงานประจำวันเป็น PDF อัตโนมัติ + รูปประกอบใบแจ้งซ่อม | `dailyReport()` | โฟลเดอร์ SmartFactory Reports มีไฟล์ PDF | ☑ |
| W10-3 | Google Form | ใบแจ้งซ่อม (สร้างด้วยโค้ด) + ลิงก์ pre-filled จากปุ่ม Telegram → ปิดลูปสั่งเครื่อง | `setup()`, Node-RED tab 2 ② | ฟอร์ม + ภาพเครื่องกลับเป็น RUNNING หลังส่งฟอร์ม | ☑ |
| W10-4 | Google myMaps | ผังโรงงาน 2 โซน 6 เครื่อง สไตล์ไอคอนตามสถานะ (นำเข้าจากแท็บ MapStatus) | แท็บ `MapStatus` | แผนที่ My Maps แสดงไอคอนต่างสี | ☑ |
| W10-5 | WSL and CasaOS Server | WSL Ubuntu + CasaOS เป็นฐานของ Self-Server | `INSTALL-CASAOS.bat`, `tools/setup-wsl.sh` | หน้า CasaOS dashboard แสดงแอปที่รัน | ☑ |

## สัปดาห์ที่ 11 – การสร้าง Private Server

| # | วัตถุประสงค์ | ใช้ทำอะไรในโปรเจค | ไฟล์ / จุดที่ทำงาน | หลักฐานที่ต้องเก็บ | ☑ |
|---|---|---|---|---|---|
| W11-1 | WSL CasaOS Server | รัน Node-RED, Grafana, InfluxDB, n8n, Mosquitto, Simulator บน CasaOS | `docker-compose.yml` | CasaOS แสดงทุก container | ☑ |
| W11-2 | influxDB | Time-series DB: measurement `machine` (14 fields) และ `event` | Node-RED `Process + Alarm + Predictive` | InfluxDB Data Explorer แสดงกราฟ | ☑ |
| W11-3 | influxDB with Grafana | Flux queries ทุก panel, ตัวแปรเลือกเครื่อง | `grafana/dashboards/*.json` | Grafana (CasaOS :3003) แสดงข้อมูลสด | ☑ |
| W11-4 | Telegram | Bot แจ้งเตือน 4 ระดับ + สั่งงาน 9 คำสั่ง + ปุ่มเปิดฟอร์ม | Node-RED tab 2 ① | ภาพแชท Telegram ทั้งแจ้งเตือนและคำสั่ง | ☑ |

## สัปดาห์ที่ 12 – GitHub, Docker and n8n

| # | วัตถุประสงค์ | ใช้ทำอะไรในโปรเจค | ไฟล์ / จุดที่ทำงาน | หลักฐานที่ต้องเก็บ | ☑ |
|---|---|---|---|---|---|
| W12-1 | GitHub | Repo + branch ต่อฟีเจอร์ + Pull Request + GitHub Actions CI | `.github/workflows/ci.yml` | หน้า PR ที่ merge แล้ว + CI ✅ | ☑ |
| W12-2 | Docker | Dockerfile ของ Simulator + Compose 6 services รันคำสั่งเดียว | `simulator/Dockerfile`, `docker-compose.yml` | `docker compose ps` ทุกตัว Up | ☑ |
| W12-3 | n8n | AI Shift Report (ตั้งเวลา + /report) และ Ask AI (/ask) อ่านข้อมูลจริงจาก InfluxDB | `n8n/*.json` | หน้า workflow ใน n8n + คำตอบ AI ใน Telegram | ☑ |

---

## สรุปจำนวน

| สัปดาห์ | หัวข้อ | วัตถุประสงค์ | สถานะ |
|---|---|---|---|
| W10 | Data-Cloud | 5 | ☑ ครบ |
| W11 | Private Server | 4 | ☑ ครบ |
| W12 | GitHub, Docker, n8n | 3 | ☑ ครบ |
| **รวม** | | **12** | **12/12** |

## ส่วนที่ใช้เสริม / ตัดออก

| สัปดาห์ | สถานะ | หมายเหตุ |
|---|---|---|
| W7 Virtual Server in Cloud | ตัดออก | เครดิต Azure for Students หมด สคริปต์ `azure/setup-azure.sh` ยังเก็บไว้ใช้ต่อได้ |
| W8 Dashboard (Grafana) | ใช้เสริม | Grafana 2 dashboards, Data source InfluxDB (Flux) |
| W9 Self-Server | ใช้เสริม | คอมที่บ้านรันระบบทั้งหมดเป็น Self-Server |
