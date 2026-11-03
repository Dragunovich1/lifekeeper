@echo off
REM LifeKeeper - actualizar la WEB en el servidor (doble clic o desde cmd/PowerShell).
REM Opciones: update-web.bat -NoCache   |   -NoBackup   |   -DryRun   |   -Server 192.168.0.52
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update-web.ps1" %*
echo.
pause
