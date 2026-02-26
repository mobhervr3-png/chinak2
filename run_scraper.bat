@echo off
echo Starting Xianyu Scraper...
cd /d "%~dp0"
cd server
if not exist node_modules (
    echo Installing dependencies...
    npm install
)
echo.
echo Please follow the prompts to enter the Category URL.
echo.
node scripts/xianyu-simple-scraper.js
pause