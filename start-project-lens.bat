@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\project-lens-start.ps1"
set "code=%ERRORLEVEL%"
if not "%code%"=="0" pause
exit /b %code%
