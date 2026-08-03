@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%website"
echo Project Lens public website:
echo http://localhost:4174
call npm run dev
