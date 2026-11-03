@echo off
REM LifeKeeper - recompilar el APK (doble clic o desde cmd/PowerShell).
REM Opciones: build-apk.bat -SkipPull   |   -Install   |   -Clean   |   -Branch main
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-apk.ps1" %*
echo.
pause
