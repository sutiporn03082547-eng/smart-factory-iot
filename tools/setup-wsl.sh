#!/usr/bin/env bash
# =====================================================================
#  ติดตั้งระบบฝั่งคอมที่บ้าน: WSL Ubuntu + CasaOS + Docker Compose (W10, W11, W12)
#    bash tools/setup-wsl.sh
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 1) CasaOS (ติดตั้ง Docker มาให้ด้วย)"
if ! command -v casaos >/dev/null 2>&1 && [ ! -d /var/lib/casaos ]; then
  sudo apt-get update -y && sudo apt-get install -y curl
  curl -fsSL https://get.casaos.io | sudo bash
else
  echo "   มี CasaOS แล้ว"
fi
if ! command -v docker >/dev/null; then
  echo "ไม่พบ docker – ติดตั้ง CasaOS ไม่สำเร็จหรือยังไม่ได้ติดตั้ง"; exit 1
fi
sudo usermod -aG docker "$USER" || true

echo "==> 2) ไฟล์ตั้งค่า .env"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "   สร้าง .env แล้ว -> แก้ค่า CHANGE_ME ก่อน (nano .env) แล้วรันสคริปต์นี้อีกครั้ง"
  exit 0
fi

echo "==> 3) Build + Run ทั้งระบบ"
sudo docker compose up -d --build
sudo docker compose ps

IP=$(hostname -I | awk '{print $1}')
cat <<EOF

✅ ระบบทำงานแล้ว (WSL IP: ${IP})
   CasaOS     : http://localhost:8080   (ถ้าเปลี่ยนพอร์ต WebUI เป็น 8080 ตามบทเรียน)
   Node-RED   : http://localhost:1880
   InfluxDB   : http://localhost:8086   (admin / ตามไฟล์ .env)
   Grafana    : http://localhost:3003   (admin / ตามไฟล์ .env)
   n8n        : http://localhost:5679   -> Import workflow จากโฟลเดอร์ n8n/
   API status : http://localhost:1880/api/status

ทดสอบเครื่องเสีย:  docker exec sf-mosquitto mosquitto_pub -t factory/cmd/M3 -m '{"action":"fault","fault":"bearing"}'
EOF
