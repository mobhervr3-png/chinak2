@echo off
setlocal EnableDelayedExpansion
title Taobao Scraper
color 0A
cd /d "%~dp0"

echo ========================================================
echo               Taobao Product Scraper
echo ========================================================
echo.

if "%~1" neq "" (
    echo Launching with provided URL...
    node server/scripts/taobao-scraper.js "%~1"
) else (
    echo Please paste the Taobao Category URL below:
    echo (Right-click to paste in CMD/PowerShell)
    echo.
    set /p "url=URL: "
    echo.
    
    if "!url!"=="" (
        echo No URL provided. Running in default interactive mode...
        node server/scripts/taobao-scraper.js
    ) else (
        echo Starting scraper with provided URL...
        echo Target: "!url!"
        echo.
        node server/scripts/taobao-scraper.js "!url!"
    )
)

echo.
echo Scraper finished.
pause
