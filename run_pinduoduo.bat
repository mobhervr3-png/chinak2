@echo off
setlocal EnableDelayedExpansion
title Pinduoduo Scraper
color 0A

:: Change directory to project root
cd /d "%~dp0"
set "PDD_PROFILE_FRESH=0"
set "PDD_SKIP_COOKIES=0"
set "PDD_IDLE_AFTER_LOGIN_MS=15000"
set "PDD_MOBILE_LISTING=1"
set "PDD_FORCE_DESKTOP=0"
set "PDD_MANUAL_READY=1"
set "PDD_GUEST=0"
:: Optional: Set specific profile directory (e.g. "Profile 1", "Default", "Profile 3")
set "PDD_PROFILE_DIR=Profile 3"
:: Auto-kill Chrome if profile is locked (0=Ask, 1=Force Kill)
set "PDD_AUTO_KILL_CHROME=1"
set "PDD_REQUIRE_PROFILE=0"
set "PDD_CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%PDD_CHROME_PATH%" set "PDD_CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set "PDD_USER_DATA_DIR=%LOCALAPPDATA%\Google\Chrome\User Data"

echo ========================================================
echo        Pinduoduo Product Scraper ^& Importer
echo ========================================================
echo.
echo This tool will:
echo 1. Open a Chrome browser controlled by automation
echo 2. Scrape products from the Pinduoduo category you provide
echo 3. Translate content to Arabic using AI
echo 4. Insert products directly into your local database
echo.

:: Check if URL was passed as an argument
if "%~1" neq "" (
    echo Launching with provided URL...
    node server/scripts/pinduoduo-scraper.js "%~1" "%~2"
) else (
    echo Please paste the Pinduoduo Category/Search URL below:
    echo (Right-click to paste in CMD/PowerShell)
    echo.
    set /p "url=URL: "
    echo.
    
    if "!url!"=="" (
        echo No URL provided. Running in default interactive mode...
        node server/scripts/pinduoduo-scraper.js
    ) else (
        echo Starting scraper with provided URL...
        echo Target: "!url!"
        echo.
        node server/scripts/pinduoduo-scraper.js "!url!"
    )
)

echo.
echo Scraper finished.
pause
