@echo off
chcp 65001 >nul
title Smart Factory - Start on WSL + CasaOS
echo Starting Smart Factory on WSL Ubuntu + CasaOS ...
rem WSL shuts Ubuntu down a few seconds after the last command ends - keep one session alive
start "SmartFactory-WSL (keep open)" /min wsl -d Ubuntu -u root -e sleep infinity
timeout /t 6 >nul
wsl -d Ubuntu -u root -e bash -lc "cd /root/smart-factory && docker compose up -d && docker compose restart simulator && docker compose ps"
timeout /t 20 >nul
for /f "tokens=1,2 delims==" %%a in ('wsl -d Ubuntu -u root -e cat /root/smart-factory/ports.txt') do set "%%a=%%b"
if not defined GRAFANA set GRAFANA=3004
if not defined NODERED set NODERED=1881
if not defined N8N set N8N=5679
start "" http://localhost
start "" http://localhost:%GRAFANA%/d/sf-engineer
start "" http://localhost:%NODERED%
echo.
echo Grafana  : http://localhost:%GRAFANA%/d/sf-engineer
echo Node-RED : http://localhost:%NODERED%
echo n8n      : http://localhost:%N8N%
echo.
echo Keep the minimized "SmartFactory-WSL" window open while presenting.
pause
