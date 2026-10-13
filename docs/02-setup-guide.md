# คู่มือติดตั้งทีละขั้น

ทำตามลำดับนี้ (ทำ **ขั้น 0–8 ให้เสร็จก่อน** = แกนของระบบ W10, W11, W12 จากนั้นค่อยทำ 9–13 = W7, W8, W9)

| ขั้น | งาน | สัปดาห์ | เวลาประมาณ |
|---|---|---|---|
| 0 | เตรียมเครื่อง | – | 30 นาที |
| 1 | GitHub repo | W12 | 15 นาที |
| 2 | WSL + CasaOS + Docker Compose | W10, W11, W12 | 45 นาที |
| 3 | Telegram Bot | W11 | 10 นาที |
| 4 | Google Sheets / Apps Script / Form / Drive | W10 | 40 นาที |
| 5 | Google My Maps | W10 | 15 นาที |
| 6 | n8n + AI | W12 | 20 นาที |
| 7 | Grafana บน Windows + Alert | W8, W11 | 30 นาที |
| 8 | ESP32 M6 บน Wokwi | เสริม | 15 นาที |
| 9 | Azure VM + Apache + Network | W7 | 45 นาที |
| 10 | ZeroTier VPN | W9 | 20 นาที |
| 11 | Grafana บน Azure + Viewer + QR | W8 | 15 นาที |
| 12 | DDNS + Port Forwarding | W9 | 30 นาที |
| 13 | Remote PC (VS Code SSH) | W9 | 15 นาที |

---

## ขั้น 0 – เตรียมเครื่อง

ติดตั้งบน Windows: **Git**, **VS Code** (+ extension *Remote - SSH*, *WSL*), **Grafana for Windows**, **ZeroTier**, แอป **Telegram** และ **ZeroTier** บนมือถือ

```powershell
wsl --install          # PowerShell (Admin) แล้วรีสตาร์ท
```

## ขั้น 1 – GitHub (W12-1)

1. สร้าง repo ชื่อ `smart-factory` บน github.com (Private ได้ ถ้าจะให้อาจารย์ดูให้ invite)
2. ใน WSL:

```bash
cd ~ && unzip /mnt/c/Users/<you>/Downloads/smart-factory.zip && cd smart-factory
git init && git add . && git commit -m "Initial commit: Smart Factory platform"
git branch -M main
git remote add origin https://github.com/<you>/smart-factory.git
git push -u origin main
```

3. **ทำ Branch + Pull Request อย่างน้อย 1 ครั้ง** (เป็นหลักฐาน W12-1) เช่นตอนแก้พิกัด My Maps:

```bash
git checkout -b feature/mymaps-location
# แก้ google/apps-script.gs
git commit -am "Update machine locations for My Maps"
git push -u origin feature/mymaps-location
```
แล้วเปิด Pull Request บนเว็บ → รอ CI ✅ → Merge

## ขั้น 2 – WSL + CasaOS + Docker Compose (W10-5, W11-1, W11-2, W12-2)

```bash
cd ~/smart-factory
bash tools/setup-wsl.sh        # ครั้งแรก: ติดตั้ง CasaOS และสร้าง .env
nano .env                       # ใส่ INFLUX_TOKEN (ตั้งเองยาวๆ), รหัสผ่าน
bash tools/setup-wsl.sh        # ครั้งที่สอง: build + run ทั้งระบบ
```

- CasaOS: เปิด `http://localhost` → ตั้งบัญชี → Settings เปลี่ยน WebUI port เป็น **8080** (ตามบทเรียน)
- ตรวจ: `docker compose ps` ต้อง Up ทั้ง 6 ตัว
- InfluxDB `http://localhost:8086` → Data Explorer → bucket `machines` → measurement `machine` → เห็นกราฟ
- Node-RED `http://localhost:1880` → มี 2 แท็บ, node "Process + Alarm + Predictive" มีจุดสีเขียว
- Grafana CasaOS `http://localhost:3003` → Dashboards → Smart Factory

> ถ้า CasaOS เวอร์ชันของคุณไม่แสดง container ที่รันด้วย compose ให้ใช้ App Store > Custom Install > Import แล้ววางเนื้อหา `docker-compose.yml` (แก้ path volume เป็น absolute เช่น `/home/<you>/smart-factory/nodered`)

## ขั้น 3 – Telegram Bot (W11-4)

1. Telegram → ค้นหา **@BotFather** → `/newbot` → ตั้งชื่อ → ได้ **Token**
2. กด Start ที่บอทของตัวเอง 1 ครั้ง
3. หา chat id: เปิด `https://api.telegram.org/bot<TOKEN>/getUpdates` ในเบราว์เซอร์ ดูค่า `chat.id`
   (ถ้าจะใช้กลุ่ม: เพิ่มบอทเข้ากลุ่ม พิมพ์อะไรสักอย่าง แล้วดู id ที่ขึ้นต้น `-100`)
4. ใส่ `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` ใน `.env` → `docker compose up -d`
5. ทดสอบพิมพ์ `/help`, `/status` ในแชท

> ⚠️ ห้ามเปิด `getUpdates` ในเบราว์เซอร์ค้างไว้ระหว่างใช้งาน เพราะ Node-RED ใช้ getUpdates อยู่ (บอทหนึ่งตัวรับคำสั่งได้จากที่เดียว)

## ขั้น 4 – Google Sheets / Apps Script / Form / Drive (W10-1, 2, 3)

1. สร้าง Google Sheets ใหม่ ชื่อ **Smart Factory Data**
2. Extensions → **Apps Script** → ลบโค้ดเดิม วาง `google/apps-script.gs` ทั้งไฟล์ → Save
3. เลือกฟังก์ชัน **`setup`** → Run → อนุญาตสิทธิ์ (Advanced → Go to project)
   - จะได้แท็บ `Log`, `Alarms`, `MapStatus`, โฟลเดอร์ Drive `SmartFactory Reports` และ Google Form ใบแจ้งซ่อม
   - เปิด **Execution log** คัดลอก `FORM_PREFILL_URL` ไปใส่ `.env`
4. เปิดลิงก์ "Form edit URL" ใน log → เพิ่มคำถาม **"รูปภาพประกอบ"** แบบ *File upload* (รูปจะเก็บใน Drive)
5. Deploy → **New deployment** → ⚙️ Web app → Execute as **Me** → Who has access **Anyone** → Deploy → คัดลอก URL ที่ลงท้าย `/exec` ไปใส่ `SHEETS_URL` ใน `.env`
6. รันฟังก์ชัน **`installTriggers`** (ตั้งรายงาน PDF ทุกวัน 23:00) และลองรัน **`dailyReport`** เองหนึ่งครั้งเพื่อเก็บหลักฐาน
7. (ไม่บังคับ) Project Settings → Script properties → เพิ่ม `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` ให้รายงาน PDF ส่งลิงก์เข้า Telegram
8. `docker compose up -d` → รอ 1–2 นาที แท็บ `Log` ต้องมีแถวเพิ่ม

> แก้โค้ด Apps Script ภายหลัง ต้อง Deploy → Manage deployments → ✏️ → Version: **New version** ทุกครั้ง (URL เดิม)

## ขั้น 5 – Google My Maps (W10-4)

1. เปิด https://www.google.com/mymaps → **Create a new map** ตั้งชื่อ "Smart Factory Layout"
2. Layer แรก → **Import** → Google Drive → เลือก **Smart Factory Data** → แท็บ **MapStatus**
3. Position: `Latitude`, `Longitude` → Title: `Machine`
4. Style → *Style by data column* → **Status** → ตั้งไอคอน/สี: RUNNING เขียว, ALARM แดง, MAINTENANCE ส้ม, STOPPED เทา
5. เพิ่ม Layer "Zones" วาดสี่เหลี่ยม 2 โซน (Zone A, Zone B)
6. อัปเดตสถานะ: เมนู Layer ⋮ → **Reimport and merge**
7. แก้พิกัดจริงได้ที่ `MACHINE_LOCATIONS` ใน Apps Script

## ขั้น 6 – n8n + AI (W12-3)

1. หา API key แบบ OpenAI-compatible: OpenAI (`https://api.openai.com/v1`), DeepSeek (`https://api.deepseek.com/v1`, model `deepseek-chat`) หรือ Groq (`https://api.groq.com/openai/v1`) ใส่ `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` ใน `.env` → `docker compose up -d`
2. ไม่ต้อง Import เอง: container `sf-n8n` จะ import และเปิดใช้ (Active) workflow ทั้ง 2 ตัวจากโฟลเดอร์ `n8n/` อัตโนมัติทุกครั้งที่เริ่ม
3. เปิด `http://localhost:5679` → สร้างบัญชี owner (ครั้งแรกครั้งเดียว) → จะเห็น workflow *AI Shift Report* และ *Ask AI*
4. ถ้าแก้ workflow ใน UI แล้วอยากเก็บ ให้ Download เป็น JSON ทับไฟล์ในโฟลเดอร์ `n8n/`
5. ทดสอบใน Telegram: `/report` และ `/ask เครื่องไหนน่าห่วงที่สุด`

> ยังไม่มี API key ก็ใช้ได้ ระบบจะส่งรายงานแบบไม่ใช้ AI (fallback) แต่ควรมี key ตอนเดโมจะดูดีกว่ามาก

## ขั้น 7 – Grafana บน Windows + Alert (W8-1, W8-3, W8-4)

1. ติดตั้ง Grafana for Windows (ค่าเริ่มต้น `C:\Program Files\GrafanaLabs\grafana`)
2. PowerShell (Admin) ที่โฟลเดอร์โปรเจค:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\tools\setup-windows.ps1 -InfluxToken "<ค่าเดียวกับ INFLUX_TOKEN>"
```

3. เปิด `http://localhost:3000` (admin/admin) → Dashboards → Smart Factory → **Engineer**
4. **Setting up (W8-4)**
   - Profile/Preferences → Home dashboard = Smart Factory – Engineer, Theme = Dark
   - Alerting → Contact points → New → Integration **Telegram** → ใส่ Bot token + Chat ID → Test
   - Alerting → Alert rules → New → Query:
     ```
     from(bucket: "machines") |> range(start: -2m)
       |> filter(fn: (r) => r._measurement == "machine" and r._field == "vibration")
       |> mean()
     ```
     Condition: IS ABOVE **7.1** → Pending period **1m** → Contact point = Telegram → Save

> สคริปต์ตั้ง port proxy ด้วย: WSL IP เปลี่ยนทุกครั้งที่รีสตาร์ทเครื่อง ให้รัน `setup-windows.ps1` ใหม่

## ขั้น 8 – ESP32 M6 บน Wokwi (เสริม กันโดนถาม "IoT แต่ไม่มีอุปกรณ์")

1. เปิด https://wokwi.com/projects/new/esp32
2. วางเนื้อหา `wokwi/esp32-machine6/sketch.ino`, `diagram.json` และสร้างแท็บ `libraries.txt`
3. แก้ `TOPIC_PREFIX` ให้ตรง `HIVEMQ_PREFIX` ใน `.env` (เช่น `smf-6501234567`) และตั้ง `HIVEMQ_DATA_TOPIC=<prefix>/factory/data/+`
4. กด ▶ → Grafana/Telegram จะเห็นเครื่อง **M6**
5. หมุน Potentiometer เกิน 11 mm/s หรือกดปุ่ม E-STOP = Trip → Telegram แจ้ง → `/repair M6` → LED เขียวกลับมา

## ขั้น 9 – Azure VM + Apache + Network (W7)

1. สมัคร https://azure.microsoft.com/free/students/ ด้วยอีเมลมหาวิทยาลัย
2. Create **Virtual machine**: Ubuntu Server 22.04/24.04 LTS, Size **B1s/B2s**, Authentication **SSH public key** (ดาวน์โหลด `.pem`), Inbound ports: SSH (22), HTTP (80)
3. VM → Networking → **Add inbound port rule** เพิ่ม **3000** (Grafana) และแก้ SSH ให้ Source = My IP (W7-5)
4. (ไม่บังคับ) Configuration → DNS name label เช่น `smartfactory-xxx` จะได้ `smartfactory-xxx.southeastasia.cloudapp.azure.com`
5. SSH เข้าเครื่อง:

```powershell
move IoTKey.pem $HOME\.ssh\
ssh -i ~/.ssh/IoTKey.pem azureuser@<Public IP>
```

6. บน VM:

```bash
git clone https://github.com/<you>/smart-factory.git && cd smart-factory/azure
cp azure.env.example azure.env && nano azure.env     # ใส่ค่าทั้งหมด
sudo bash setup-azure.sh
```

## ขั้น 10 – ZeroTier VPN (W9-1)

1. https://my.zerotier.com → Create Network → คัดลอก **Network ID**
2. ติดตั้ง ZeroTier บน Windows → Join Network; บนมือถือ → Join Network; บน Azure สคริปต์ join ให้แล้ว
3. หน้าเว็บ ZeroTier → Members → ติ๊ก **Auth** ทั้ง 3 เครื่อง → จด IP ของคอมที่บ้าน (เช่น 10.147.17.10) ใส่ `HOME_ZT_IP` ใน `azure.env` แล้วรัน `sudo bash setup-azure.sh` ซ้ำ
4. ทดสอบจาก Azure: `curl http://<HOME_ZT_IP>:8086/health` ต้องได้ `"status":"pass"`
5. ทดสอบจากมือถือ (ปิด WiFi ใช้เน็ตมือถือ) เปิด `http://<HOME_ZT_IP>:1880/api/status`

## ขั้น 11 – Grafana บน Azure + Viewer + QR (W8-2, W8-5)

- `http://<Azure IP>:3000` → เข้าด้วย admin → Executive dashboard แสดงข้อมูลจากบ้านผ่าน VPN
- Administration → Users → มี `viewer` (Role Viewer) = **User account**
- เปิดหน้าต่าง Incognito → เข้าได้โดยไม่ต้อง login (Anonymous Viewer) = **Public**
- Portal `http://<Azure IP>/` มี QR Code → สแกนด้วยมือถือเปิด Dashboard (หรือสร้าง QR ที่ https://me-qr.com ตามบทเรียน)

## ขั้น 12 – DDNS + Port Forwarding (W9-2, W9-3, W9-4)

1. AIS Fibre: สมัครที่ https://www.thddns.net (คู่มือ PDF ในบทเรียน) / 3BB: เมนู DDNS ในหน้า Router
2. Router (`192.168.1.1`) → Port Forwarding / Virtual Server: External port เช่น **1121** → Internal IP = IP ของ Windows (ดูด้วย `ipconfig`) → Internal port **1880**
3. Windows ต้องมี port proxy 1880 → WSL (ทำแล้วในขั้น 7)
4. ทดสอบด้วยเน็ตมือถือ: `http://<name>.thddns.net:1121/api/status`
5. ใส่ URL นี้ใน `NODERED_STATUS_API` ของ `azure.env` แล้วรัน `setup-azure.sh` ซ้ำ → Portal แสดงสถานะสด

> ถ้าเน็ตบ้านเป็น CGNAT (ได้ IP ส่วนตัว 100.64.x.x) Port Forwarding จะใช้ไม่ได้ ให้โทรขอ Public IP จากผู้ให้บริการ หรือใช้ ZeroTier แทนแล้วอธิบายเหตุผลในรายงาน

## ขั้น 13 – Remote PC (W9-5)

1. VS Code → Remote Explorer → SSH → ➕ → `ssh -i ~/.ssh/IoTKey.pem azureuser@<Azure IP>`
2. Open Folder → `/var/www/html` → แก้ `index.html` (เช่นเปลี่ยนข้อความ footer) → Save → รีเฟรชหน้าเว็บเห็นผลทันที
3. (เพิ่มคะแนน) SSH ผ่าน VPN ด้วย ZeroTier IP ของ Azure แทน Public IP

---

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| Node-RED debug แสดง 401 จาก InfluxDB | `INFLUX_TOKEN` ใน `.env` ถูกแก้หลัง InfluxDB สร้างครั้งแรก → `docker compose down -v` แล้ว up ใหม่ (ลบข้อมูลเดิม) |
| Telegram ไม่ตอบคำสั่ง | token/chat id ผิด, หรือเปิด getUpdates ในเบราว์เซอร์ค้าง, หรือ chat id ไม่อยู่ใน `TELEGRAM_ALLOWED` |
| Sheets ไม่มีข้อมูล | ลืม Deploy เป็น Web app แบบ Anyone, หรือแก้โค้ดแล้วไม่ได้ Deploy *New version* |
| Grafana ขึ้น No data | เลือกช่วงเวลา Last 30 minutes, ตรวจ Data source → Test |
| Azure Grafana No data | ZeroTier ยังไม่ Auth, หรือ port proxy 8086 / firewall บน Windows ยังไม่เปิด |
| ไม่มีเครื่อง M6 | Wokwi ยังไม่รัน หรือ `TOPIC_PREFIX` ไม่ตรง `HIVEMQ_DATA_TOPIC` |
| n8n webhook 404 | Workflow ยังไม่ Active |
