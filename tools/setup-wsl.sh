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

echo "==> 3) ตรวจพอร์ตที่ถูกใช้อยู่ (เช่นแอปจากบทเรียนใน CasaOS) แล้วเลือกพอร์ตว่างให้อัตโนมัติ"
sudo docker compose down >/dev/null 2>&1 || true
set_port() {  # $1=ชื่อตัวแปร  $2=พอร์ตเริ่มต้น
  local var=$1 p=$2
  # ว่างจริงต้องผ่าน 2 ข้อ: ไม่มีใน ss และ bind ได้จริง (กันพอร์ตที่ Windows ใช้อยู่ เช่น Node-RED/InfluxDB ที่ลงไว้ในเครื่อง)
  port_busy() {
    sudo ss -ltnH "sport = :$1" | grep -q . && return 0
    python3 -c "import socket,sys;s=socket.socket();s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.bind(('0.0.0.0',int(sys.argv[1])))" "$1" 2>/dev/null && return 1
    return 0
  }
  while port_busy "$p"; do p=$((p+1)); done
  sed -i "/^${var}=/d" .env; echo "${var}=${p}" >> .env
  [ "$p" != "$2" ] && echo "   พอร์ต $2 ถูกใช้อยู่ -> ${var}=${p}"
  eval "$var=$p"
}
set_port MQTT_HOST_PORT 1883
set_port INFLUX_HOST_PORT 8086
set_port NODERED_HOST_PORT 1880
set_port GRAFANA_HOST_PORT 3003
set_port N8N_HOST_PORT 5679

echo "==> 4) Build + Run ทั้งระบบ"
sudo docker compose up -d --build
sudo docker compose ps
printf 'NODERED=%s\nGRAFANA=%s\nINFLUX=%s\nN8N=%s\n' "$NODERED_HOST_PORT" "$GRAFANA_HOST_PORT" "$INFLUX_HOST_PORT" "$N8N_HOST_PORT" > ports.txt

IP=$(hostname -I | awk '{print $1}')
cat <<EOF

✅ ระบบทำงานแล้ว (WSL IP: ${IP})
   CasaOS     : http://localhost:8080   (ถ้าเปลี่ยนพอร์ต WebUI เป็น 8080 ตามบทเรียน)
   Node-RED   : http://localhost:${NODERED_HOST_PORT}
   InfluxDB   : http://localhost:${INFLUX_HOST_PORT}   (admin / ตามไฟล์ .env)
   Grafana    : http://localhost:${GRAFANA_HOST_PORT}   (admin / ตามไฟล์ .env)
   n8n        : http://localhost:${N8N_HOST_PORT}   -> Import workflow จากโฟลเดอร์ n8n/
   API status : http://localhost:${NODERED_HOST_PORT}/api/status

ทดสอบเครื่องเสีย:  docker exec sf-mosquitto mosquitto_pub -t factory/cmd/M3 -m '{"action":"fault","fault":"bearing"}'
EOF
