@echo off
chcp 65001 >nul
title Smart Factory - Test fault
set NODERED=1881
set GRAFANA=3004
for /f "tokens=1,2 delims==" %%a in ('wsl -d Ubuntu -u root -e cat /root/smart-factory/ports.txt') do set "%%a=%%b"
:MENU
echo.
echo ============ Smart Factory - Test ============
echo  1) M3 bearing wear  (predictive alert, trip in ~1.5 min)
echo  2) M4 overheat      (trip in ~20 s)
echo  3) M5 jam           (trip in ~20 s)
echo  4) Repair ALL machines
echo  5) Stop M1          6) Start M1
echo  0) Exit
set "c="
set /p c=Choose: 
if "%c%"=="1" curl -s "http://localhost:%NODERED%/api/cmd?machine=M3&action=fault&fault=bearing"
if "%c%"=="2" curl -s "http://localhost:%NODERED%/api/cmd?machine=M4&action=fault&fault=overheat"
if "%c%"=="3" curl -s "http://localhost:%NODERED%/api/cmd?machine=M5&action=fault&fault=jam"
if "%c%"=="4" curl -s "http://localhost:%NODERED%/api/cmd?machine=all&action=repair"
if "%c%"=="5" curl -s "http://localhost:%NODERED%/api/cmd?machine=M1&action=stop"
if "%c%"=="6" curl -s "http://localhost:%NODERED%/api/cmd?machine=M1&action=start"
if "%c%"=="0" exit /b
echo.
echo Watch Grafana: http://localhost:%GRAFANA%/d/sf-engineer
goto MENU
