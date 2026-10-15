@echo off
wsl -d Ubuntu -u root -e bash -lc "cd /root/smart-factory && docker compose stop"
taskkill /fi "WINDOWTITLE eq SmartFactory-WSL*" >nul 2>nul
pause
