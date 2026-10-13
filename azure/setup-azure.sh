#!/usr/bin/env bash
# =====================================================================
#  Smart Factory – ติดตั้ง Cloud Server บน Azure Ubuntu VM (W7, W8, W9)
#    - Apache2 + Factory Portal           (W7: Apache / Webpage)
#    - Grafana บน Virtual Server           (W8: Grafana on Server / Data source / User)
#    - ZeroTier VPN ต่อกลับคอมที่บ้าน      (W9: VPN)
#
#  ใช้งาน (บน VM ผ่าน SSH):
#    git clone <repo> && cd smart-factory/azure
#    cp azure.env.example azure.env && nano azure.env
#    sudo bash setup-azure.sh
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")"
[ -f azure.env ] || { echo "ไม่พบ azure.env (cp azure.env.example azure.env)"; exit 1; }
# shellcheck disable=SC1091
source azure.env
[ "$(id -u)" -eq 0 ] || { echo "ต้องรันด้วย sudo"; exit 1; }

step() { echo -e "\n\033[1;36m==> $*\033[0m"; }

step "1/6 อัปเดตระบบ"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
apt-get install -y apache2 curl wget gnupg apt-transport-https software-properties-common jq

step "2/6 ZeroTier VPN (join network ${ZT_NETWORK_ID})"
if ! command -v zerotier-cli >/dev/null; then
  curl -s https://install.zerotier.com | bash
fi
zerotier-cli join "${ZT_NETWORK_ID}" || true
echo ">> ไปกด Authorize เครื่องนี้ที่ https://my.zerotier.com แล้วตรวจด้วย: sudo zerotier-cli listnetworks"

step "3/6 ติดตั้ง Grafana"
if ! command -v grafana-server >/dev/null; then
  mkdir -p /etc/apt/keyrings
  wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor > /etc/apt/keyrings/grafana.gpg
  echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" > /etc/apt/sources.list.d/grafana.list
  apt-get update -y
  apt-get install -y grafana
fi

step "4/6 ตั้งค่า Grafana: datasource ผ่าน VPN, dashboard, public view, embedding"
mkdir -p /etc/grafana/provisioning/datasources /etc/grafana/provisioning/dashboards /var/lib/grafana/dashboards
cat > /etc/grafana/provisioning/datasources/influxdb.yml <<EOF
apiVersion: 1
datasources:
  - name: InfluxDB-Factory
    uid: influxdb-factory
    type: influxdb
    access: proxy
    url: http://${HOME_ZT_IP}:8086
    isDefault: true
    jsonData:
      version: Flux
      organization: ${INFLUX_ORG}
      defaultBucket: ${INFLUX_BUCKET}
      timeInterval: 2s
    secureJsonData:
      token: ${INFLUX_TOKEN}
EOF
cp ../grafana/provisioning/dashboards/dashboards.yml /etc/grafana/provisioning/dashboards/
cp ../grafana/dashboards/factory-executive.json /var/lib/grafana/dashboards/
chown -R grafana:grafana /var/lib/grafana/dashboards

# ค่าตั้งค่าผ่าน environment (Public = anonymous viewer, อนุญาตฝังใน Portal)
cat > /etc/default/grafana-server-smartfactory <<EOF
GF_SECURITY_ALLOW_EMBEDDING=true
GF_AUTH_ANONYMOUS_ENABLED=true
GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
GF_USERS_DEFAULT_THEME=dark
GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=/var/lib/grafana/dashboards/factory-executive.json
EOF
mkdir -p /etc/systemd/system/grafana-server.service.d
cat > /etc/systemd/system/grafana-server.service.d/smartfactory.conf <<EOF
[Service]
EnvironmentFile=/etc/default/grafana-server-smartfactory
EOF
systemctl daemon-reload
systemctl enable grafana-server
systemctl restart grafana-server

echo -n "รอ Grafana พร้อม"
for _ in $(seq 1 40); do curl -sf http://localhost:3000/api/health >/dev/null && break; echo -n "."; sleep 2; done; echo
grafana-cli admin reset-admin-password "${GRAFANA_ADMIN_PASSWORD}" >/dev/null 2>&1 || \
  grafana cli admin reset-admin-password "${GRAFANA_ADMIN_PASSWORD}" >/dev/null 2>&1 || true

# Viewer account (W8: User account)
curl -s -u "admin:${GRAFANA_ADMIN_PASSWORD}" -H "Content-Type: application/json" \
  -X POST http://localhost:3000/api/admin/users \
  -d "{\"name\":\"Factory Viewer\",\"login\":\"${GRAFANA_VIEWER_USER}\",\"password\":\"${GRAFANA_VIEWER_PASSWORD}\"}" | jq -c . || true

step "5/6 Apache + Factory Portal"
cp -n /var/www/html/index.html /var/www/html/index-apache-default.html 2>/dev/null || true
sed -e "s|__NODERED_STATUS_API__|${NODERED_STATUS_API}|" \
    -e "s|__GRAFANA_URL__|http://${AZURE_PUBLIC}:3000|" \
    -e "s|__FORM_URL__|${FORM_URL}|" \
    -e "s|__MYMAPS_URL__|${MYMAPS_URL}|" \
    -e "s|__SHEET_URL__|${SHEET_URL}|" \
    -e "s|__TELEGRAM_URL__|${TELEGRAM_URL}|" \
    -e "s|__GITHUB_URL__|${GITHUB_URL}|" \
    portal/index.html > /var/www/html/index.html
systemctl enable apache2
systemctl restart apache2

step "6/6 สรุป"
cat <<EOF
✅ Factory Portal : http://${AZURE_PUBLIC}/
✅ Grafana        : http://${AZURE_PUBLIC}:3000   (admin / ที่ตั้งไว้, viewer: ${GRAFANA_VIEWER_USER})
✅ Datasource     : InfluxDB ที่บ้านผ่าน ZeroTier -> http://${HOME_ZT_IP}:8086

อย่าลืมใน Azure Portal > VM > Networking > Add inbound port rule:
   80 (HTTP), 3000 (Grafana), 22 (SSH เปิดเฉพาะ IP ตัวเองจะปลอดภัยกว่า)
ตรวจ VPN: sudo zerotier-cli listnetworks   |   ping ${HOME_ZT_IP}
EOF
