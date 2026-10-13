# ตารางตรวจสอบวัตถุประสงค์การสอน (Traceability Matrix)

ใช้เนื้อหา **6 สัปดาห์ = 27 วัตถุประสงค์** ทุกข้อมีหน้าที่จริงในระบบ มีไฟล์ที่ทำงาน และมีหลักฐานที่ต้องเก็บ (ภาพหน้าจอ/วิดีโอ) ใส่ในรายงาน

> วิธีใช้: ทำครบแต่ละข้อแล้วติ๊ก ☐ → ☑ และแปะภาพหลักฐานลงรายงานตามลำดับเลขข้อ (เช่น `W7-3.png`)

## สัปดาห์ที่ 7 – การสร้าง Virtual Server in Cloud และ Services

| # | วัตถุประสงค์ | ใช้ทำอะไรในโปรเจค | ไฟล์ / จุดที่ทำงาน | หลักฐานที่ต้องเก็บ | ☐ |
|---|---|---|---|---|---|
| W7-1 | Cloud Virtual PC | Azure Ubuntu VM (Azure for Students) เป็น Cloud Server ของระบบ | Azure Portal | หน้า Overview ของ VM แสดง Public IP / สเปค | ☐ |
| W7-2 | Create a Server | ติดตั้ง Server ด้วยสคริปต์อัตโนมัติ + SSH Key | `azure/setup-azure.sh` | Terminal ตอนรันสคริปต์จบ (สรุป ✅) | ☐ |
| W7-3 | Apache Installing | Web server สำหรับ Factory Portal | `setup-azure.sh` ขั้น 5 | `systemctl status apache2` เป็น active | ☐ |
| W7-4 | Creating a Webpage | Factory Portal: สถานะเครื่องสด, ฝัง Grafana, ลิงก์ทุกระบบ, QR Code | `azure/portal/index.html` | หน้าเว็บ `http://<Azure IP>/` ที่มีข้อมูลสด | ☐ |
| W7-5 | Set Network Permission | Inbound rules เปิดเฉพาะ 80, 3000, 22 (จำกัด IP) | Azure > Networking | ภาพหน้า Inbound port rules | ☐ |

## สัปดาห์ที่ 8 – การสร้าง Dashboard (Grafana)

| # | วัตถุประสงค์ | ใช้ทำอะไรในโปรเจค | ไฟล์ / จุดที่ทำงาน | หลักฐานที่ต้องเก็บ | ☐ |
|---|---|---|---|---|---|
| W8-1 | Grafana on Windows | Engineer Dashboard สำหรับวิศวกรหน้างาน (localhost:3000) | `tools/setup-windows.ps1`, `grafana/dashboards/factory-engineer.json` | Dashboard บน Windows พร้อม URL localhost:3000 | ☐ |
| W8-2 | Grafana on Virtual Server PC | Executive Dashboard บน Azure VM | `setup-azure.sh` ขั้น 3–4 | Dashboard บน `http://<Azure IP>:3000` | ☐ |
| W8-3 | Data Sources and Creating Dashboards | Datasource InfluxDB (Flux) ผ่าน provisioning, 2 dashboards 18 panels (stat, gauge, timeseries, bar gauge, state timeline, table) | `grafana/provisioning/`, `tools/build_dashboards.py` | หน้า Connections > Data sources (Test = ✅) + ภาพ dashboard | ☐ |
| W8-4 | Setting up | Alert rule ค่าสั่น > 7.1 mm/s นาน 1 นาที → Contact point Telegram, ตั้ง Home dashboard, theme, auto refresh | คู่มือขั้นที่ 7 | หน้า Alert rule + ข้อความที่ Grafana ส่งเข้า Telegram | ☐ |
| W8-5 | Public and User account | Anonymous Viewer (Public) + บัญชี `viewer` + เข้าผ่าน QR Code บนมือถือ | `setup-azure.sh` ขั้น 4, Portal QR | หน้า Users + ภาพมือถือสแกน QR เข้า Dashboard | ☐ |

## สัปดาห์ที่ 9 – การสร้าง Self-Server

| # | วัตถุประสงค์ | ใช้ทำอะไรในโปรเจค | ไฟล์ / จุดที่ทำงาน | หลักฐานที่ต้องเก็บ | ☐ |
|---|---|---|---|---|---|
| W9-1 | VPN | ZeroTier เชื่อม คอมที่บ้าน + Azure VM + มือถือ → Grafana บน Azure ดึงข้อมูล InfluxDB ที่บ้านผ่าน VPN | `setup-azure.sh` ขั้น 2, datasource `HOME_ZT_IP` | หน้า my.zerotier.com มี 3 members + Grafana Azure แสดงข้อมูล | ☐ |
| W9-2 | Free Domain Name from Internet Provider | DDNS ของ AIS/3BB (thddns.net) ชี้มาที่ Router บ้าน | Router / thddns.net | หน้าตั้งค่า DDNS + `ping <name>.thddns.net` | ☐ |
| W9-3 | Port Forwarding | Router forward พอร์ตภายนอก → Windows:1880 → (portproxy) → Node-RED ใน WSL | Router, `setup-windows.ps1` | หน้า Port Forwarding ของ Router + เปิด `/api/status` จากเน็ตมือถือได้ | ☐ |
| W9-4 | Self-Server | คอมที่บ้าน + CasaOS คือ Server หลัก (Node-RED, InfluxDB, Grafana, n8n) ให้บริการจากภายนอกได้ | `docker-compose.yml` | Portal บน Azure ดึงสถานะจาก Self-Server ได้ | ☐ |
| W9-5 | Remote PC | VS Code Remote-SSH เข้า Azure VM แก้ไฟล์ Portal + SSH ผ่าน VPN | VS Code | ภาพ VS Code ที่เปิดโฟลเดอร์ `/var/www/html` บน Azure | ☐ |

## สัปดาห์ที่ 10 – การสร้าง Data-Cloud

| # | วัตถุประสงค์ | ใช้ทำอะไรในโปรเจค | ไฟล์ / จุดที่ทำงาน | หลักฐานที่ต้องเก็บ | ☐ |
|---|---|---|---|---|---|
| W10-1 | Google Sheets | Production Log ทุก 1 นาที, Alarm log, MapStatus ผ่าน Apps Script Web App | `google/apps-script.gs`, Node-RED tab 1 ③ | Sheet มีแถวเพิ่มขึ้นอัตโนมัติ | ☐ |
| W10-2 | Google Drive | รายงานประจำวันเป็น PDF อัตโนมัติ + รูปประกอบใบแจ้งซ่อม | `dailyReport()` | โฟลเดอร์ SmartFactory Reports มีไฟล์ PDF | ☐ |
| W10-3 | Google Form | ใบแจ้งซ่อม (สร้างด้วยโค้ด) + ลิงก์ pre-filled จากปุ่ม Telegram → ปิดลูปสั่งเครื่อง | `setup()`, Node-RED tab 2 ② | ฟอร์ม + ภาพเครื่องกลับเป็น RUNNING หลังส่งฟอร์ม | ☐ |
| W10-4 | Google myMaps | ผังโรงงาน 2 โซน 6 เครื่อง สไตล์ไอคอนตามสถานะ (นำเข้าจากแท็บ MapStatus) | แท็บ `MapStatus` | แผนที่ My Maps แสดงไอคอนต่างสี | ☐ |
| W10-5 | WSL and CasaOS Server | WSL Ubuntu + CasaOS เป็นฐานของ Self-Server | `tools/setup-wsl.sh` | หน้า CasaOS dashboard แสดงแอปที่รัน | ☐ |

## สัปดาห์ที่ 11 – การสร้าง Private Server

| # | วัตถุประสงค์ | ใช้ทำอะไรในโปรเจค | ไฟล์ / จุดที่ทำงาน | หลักฐานที่ต้องเก็บ | ☐ |
|---|---|---|---|---|---|
| W11-1 | WSL CasaOS Server | รัน Node-RED, Grafana, InfluxDB, n8n, Mosquitto, Simulator บน CasaOS | `docker-compose.yml` | CasaOS แสดงทุก container | ☐ |
| W11-2 | influxDB | Time-series DB: measurement `machine` (14 fields) และ `event` | Node-RED `Process + Alarm + Predictive` | InfluxDB Data Explorer แสดงกราฟ | ☐ |
| W11-3 | influxDB with Grafana | Flux queries ทุก panel, ตัวแปรเลือกเครื่อง | `grafana/dashboards/*.json` | Grafana (CasaOS :3003) แสดงข้อมูลสด | ☐ |
| W11-4 | Telegram | Bot แจ้งเตือน 4 ระดับ + สั่งงาน 9 คำสั่ง + ปุ่มเปิดฟอร์ม | Node-RED tab 2 ① | ภาพแชท Telegram ทั้งแจ้งเตือนและคำสั่ง | ☐ |

## สัปดาห์ที่ 12 – GitHub, Docker and n8n

| # | วัตถุประสงค์ | ใช้ทำอะไรในโปรเจค | ไฟล์ / จุดที่ทำงาน | หลักฐานที่ต้องเก็บ | ☐ |
|---|---|---|---|---|---|
| W12-1 | GitHub | Repo + branch ต่อฟีเจอร์ + Pull Request + GitHub Actions CI | `.github/workflows/ci.yml` | หน้า PR ที่ merge แล้ว + CI ✅ | ☐ |
| W12-2 | Docker | Dockerfile ของ Simulator + Compose 6 services รันคำสั่งเดียว | `simulator/Dockerfile`, `docker-compose.yml` | `docker compose ps` ทุกตัว Up | ☐ |
| W12-3 | n8n | AI Shift Report (ตั้งเวลา + /report) และ Ask AI (/ask) อ่านข้อมูลจริงจาก InfluxDB | `n8n/*.json` | หน้า workflow ใน n8n + คำตอบ AI ใน Telegram | ☐ |

---

## สรุปจำนวน

| สัปดาห์ | หัวข้อ | วัตถุประสงค์ |
|---|---|---|
| W7 | Virtual Server in Cloud | 5 |
| W8 | Dashboard | 5 |
| W9 | Self-Server | 5 |
| W10 | Data-Cloud | 5 |
| W11 | Private Server | 4 |
| W12 | GitHub, Docker, n8n | 3 |
| **รวม** | | **27** |
