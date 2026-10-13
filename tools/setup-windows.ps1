# =====================================================================
#  Smart Factory – ตั้งค่าฝั่ง Windows (รัน PowerShell แบบ Run as Administrator)
#    - Port proxy Windows -> WSL (ให้ Azure/มือถือผ่าน ZeroTier และ Router เข้าถึงได้)   W9, W11
#    - Firewall inbound rules
#    - Grafana บน Windows: datasource + Engineer dashboard (provisioning)               W8
#
#  ใช้งาน:  Set-ExecutionPolicy -Scope Process Bypass; .\tools\setup-windows.ps1 -InfluxToken "<token>"
# =====================================================================
param(
    [string]$InfluxToken = "smartfactory-super-secret-token-CHANGE_ME",
    [string]$InfluxOrg = "factory",
    [string]$InfluxBucket = "machines",
    [string]$GrafanaDir = "C:\Program Files\GrafanaLabs\grafana"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "==> 1) หา IP ของ WSL" -ForegroundColor Cyan
$WslIp = (wsl hostname -I).Trim().Split(" ")[0]
Write-Host "   WSL IP = $WslIp"

Write-Host "==> 2) Port proxy + Firewall (8086 InfluxDB, 1880 Node-RED, 3003 Grafana-CasaOS)" -ForegroundColor Cyan
foreach ($p in 8086, 1880, 3003) {
    netsh interface portproxy delete v4tov4 listenport=$p listenaddress=0.0.0.0 2>$null | Out-Null
    netsh interface portproxy add v4tov4 listenport=$p listenaddress=0.0.0.0 connectport=$p connectaddress=$WslIp | Out-Null
    if (-not (Get-NetFirewallRule -DisplayName "SmartFactory $p" -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName "SmartFactory $p" -Direction Inbound -Protocol TCP -LocalPort $p -Action Allow | Out-Null
    }
}
netsh interface portproxy show v4tov4

Write-Host "==> 3) Grafana บน Windows (provisioning)" -ForegroundColor Cyan
if (Test-Path $GrafanaDir) {
    $prov = Join-Path $GrafanaDir "conf\provisioning"
    $dashDir = Join-Path $GrafanaDir "dashboards-smartfactory"
    New-Item -ItemType Directory -Force -Path "$prov\datasources", "$prov\dashboards", $dashDir | Out-Null
    @"
apiVersion: 1
datasources:
  - name: InfluxDB-Factory
    uid: influxdb-factory
    type: influxdb
    access: proxy
    url: http://localhost:8086
    isDefault: true
    jsonData:
      version: Flux
      organization: $InfluxOrg
      defaultBucket: $InfluxBucket
      timeInterval: 2s
    secureJsonData:
      token: $InfluxToken
"@ | Set-Content -Encoding UTF8 "$prov\datasources\smartfactory.yml"
    @"
apiVersion: 1
providers:
  - name: smart-factory
    folder: Smart Factory
    type: file
    allowUiUpdates: true
    options:
      path: $($dashDir -replace '\\','/')
"@ | Set-Content -Encoding UTF8 "$prov\dashboards\smartfactory.yml"
    Copy-Item "$Root\grafana\dashboards\*.json" $dashDir -Force
    Restart-Service -Name Grafana -ErrorAction SilentlyContinue
    Write-Host "   เปิด http://localhost:3000  (admin/admin ครั้งแรก) -> Dashboards > Smart Factory"
} else {
    Write-Host "   ไม่พบ Grafana ที่ $GrafanaDir – ติดตั้งจาก https://grafana.com/grafana/download?platform=windows ก่อน" -ForegroundColor Yellow
}

Write-Host "`n✅ เสร็จแล้ว  (WSL IP เปลี่ยนทุกครั้งที่รีสตาร์ทเครื่อง ให้รันสคริปต์นี้ใหม่)" -ForegroundColor Green
