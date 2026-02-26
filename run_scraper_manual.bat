@echo off
setlocal EnableDelayedExpansion
echo ===================================================
echo      Pinduoduo Scraper - Manual Link Mode
echo ===================================================
echo.
echo Please paste the Pinduoduo Category/Search URL below:
echo (Right-click to paste in CMD/PowerShell)
echo.
set /p "url=URL: "

echo.
if "!url!"=="" (
    echo No URL provided. Using default URL configured in script.
    node server/scripts/pinduoduo-scraper.js
) else (
    echo Starting scraper with provided URL...
    echo Target: "!url!"
    echo.
    node server/scripts/pinduoduo-scraper.js "!url!"
)

echo.
echo Scraper finished.
pause
