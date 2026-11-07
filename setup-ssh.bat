@echo off
REM LifeKeeper - configurar SSH para que no se corte por inactividad (doble clic).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-ssh.ps1" %*
echo.
pause
