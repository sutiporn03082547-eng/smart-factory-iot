@echo off
chcp 65001 >nul
title Smart Factory - Start
cd /d "%~dp0"
echo ============================================
echo   Smart Factory Platform - START
echo ============================================
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo [OK] Created .env from .env.example  ^(edit later for Telegram / Google / AI^)
)

rem ---- 1) Docker Desktop on Windows ----
where docker >nul 2>nul
if errorlevel 1 goto CHECK_WSL
docker info >nul 2>nul
if not errorlevel 1 goto DOCKER_WIN
echo [!] Docker is installed but not running. Open Docker Desktop, wait until it says "running", then run this file again.
pause
exit /b

:CHECK_WSL

rem ---- 2) WSL Ubuntu + CasaOS (same as the lesson) ----
wsl -l -q >nul 2>nul
if not errorlevel 1 goto WSL

echo.
echo [X] No Docker Desktop and no WSL found on this computer.
echo     Choose ONE:
echo      A) Install Docker Desktop: https://www.docker.com/products/docker-desktop/  (easiest)
echo      B) Open PowerShell as Administrator and run:   wsl --install
echo     Restart the computer, then double-click START-HERE.bat again.
pause
exit /b

:DOCKER_WIN
echo [..] Building and starting 6 containers with Docker Desktop (first time takes 5-10 min)...
docker compose up -d --build
if %errorlevel% neq 0 ( echo [X] docker compose failed - see messages above & pause & exit /b )
goto OPEN

:WSL
echo [..] Copying project into WSL and running tools/setup-wsl.sh (installs CasaOS + Docker, asks for your Ubuntu password)...
wsl --cd "%~dp0." -e bash -lc "rm -rf ~/smart-factory && cp -r . ~/smart-factory && cd ~/smart-factory && sed -i 's/\r$//' tools/*.sh && bash tools/setup-wsl.sh"
if %errorlevel% neq 0 ( echo [X] WSL setup failed - see messages above & pause & exit /b )

:OPEN
echo.
echo [OK] Waiting 30 s for services to boot...
timeout /t 30 >nul
start "" http://localhost:1880
start "" http://localhost:3003/d/sf-engineer
start "" http://localhost:8086
start "" http://localhost:5679
echo.
echo   Node-RED  http://localhost:1880
echo   Grafana   http://localhost:3003   (admin / admin1234)
echo   InfluxDB  http://localhost:8086   (admin / admin1234)
echo   n8n       http://localhost:5679
echo   API       http://localhost:1880/api/status
echo.
echo Test a breakdown:  double-click TEST-FAULT.bat
pause
