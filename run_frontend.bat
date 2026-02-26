
@echo off
cd /d "%~dp0"
echo Starting Frontend on port 5173...
node node_modules/vite/bin/vite.js
pause
