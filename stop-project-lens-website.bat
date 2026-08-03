@echo off
setlocal
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":4174" ^| findstr "LISTENING"') do (
  for /f "delims=" %%C in ('wmic process where "ProcessId=%%P" get CommandLine ^| findstr /i "website.*vite"') do taskkill /PID %%P /T /F >nul 2>&1
)
echo Project Lens public website stopped if it was running on port 4174.
