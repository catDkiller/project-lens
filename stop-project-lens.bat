@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\project-lens-stop.ps1"
exit /b %ERRORLEVEL%
