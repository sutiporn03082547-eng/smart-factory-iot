@echo off
chcp 65001 >nul
title Smart Factory - Install WSL + CasaOS (W10-5, W11-1)
cd /d "%~dp0"
echo ============================================================
echo   Smart Factory : move the system to WSL Ubuntu + CasaOS
echo ============================================================
echo.
echo [1/4] Stop the Docker Desktop stack (avoid port conflicts)
docker compose down 2>nul
echo.
echo [2/4] Check WSL Ubuntu
wsl -d Ubuntu -e true >nul 2>nul
if errorlevel 1 (
  echo   Ubuntu not found in WSL - installing...
  echo   When Ubuntu asks, create your own username and password, then type exit
  wsl --install -d Ubuntu
  echo.
  echo   Ubuntu installed. Double-click INSTALL-CASAOS.bat again.
  pause
  exit /b
)
echo.
echo [3/4] Enable systemd in WSL (required by CasaOS)
wsl -d Ubuntu -u root -e sh -c "printf '[boot]\nsystemd=true\n' > /etc/wsl.conf"
wsl --terminate Ubuntu
timeout /t 5 >nul
echo.
echo [4/4] Install CasaOS + run 6 services (type your Ubuntu password when asked, 5-15 min)
wsl -d Ubuntu --cd "%~dp0." -e bash -lc "rm -rf ~/smart-factory && cp -r . ~/smart-factory && cd ~/smart-factory && sed -i 's/\r$//' tools/*.sh && bash tools/setup-wsl.sh"
if errorlevel 1 ( echo [X] A step failed - take a screenshot of this window and send it to Claude & pause & exit /b )
echo.
echo [OK] Done - opening CasaOS and Grafana
timeout /t 20 >nul
for /f "tokens=1,2 delims==" %%a in ('wsl -d Ubuntu -e bash -lc "cat ~/smart-factory/ports.txt"') do set "%%a=%%b"
if not defined GRAFANA set GRAFANA=3003
if not defined NODERED set NODERED=1880
start "" http://localhost
start "" http://localhost:%GRAFANA%/d/sf-engineer
start "" http://localhost:%NODERED%
echo Grafana  : http://localhost:%GRAFANA%
echo Node-RED : http://localhost:%NODERED%
echo n8n      : http://localhost:%N8N%
pause
