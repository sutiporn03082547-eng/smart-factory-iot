@echo off
title Smart Factory - Reset CasaOS login
echo Resetting the CasaOS login account (apps and data are NOT touched)...
wsl -d Ubuntu -u root -e bash -c "ls /var/lib/casaos/db/; systemctl stop casaos-user-service; for f in /var/lib/casaos/db/user.db; do [ -f $f ] && mv $f $f.bak-$(date +%%s) && echo moved $f; done; systemctl start casaos-user-service; systemctl restart casaos-gateway casaos 2>/dev/null; systemctl is-active casaos-user-service"
timeout /t 8 >nul
echo.
echo Done. CasaOS will open - click "Go" and create a NEW username/password.
start "" http://localhost
pause
