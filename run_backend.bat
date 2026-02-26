
@echo off
cd /d "%~dp0"
echo Starting Backend on port 5001...
set PORT=5001
set NODE_ENV=development
node server/index.js
pause
