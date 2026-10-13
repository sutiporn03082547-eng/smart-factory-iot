@echo off
cd /d "%~dp0"
where docker >nul 2>nul && (docker compose down) || (wsl -e bash -lc "cd ~/smart-factory && sudo docker compose down")
echo Stopped.
pause
