@echo off
chcp 65001 > nul
title AI Finance Assistant Server Manager

echo ============================================
echo AI Finance Assistant Server Manager
echo ============================================
echo.
echo 1. Stop running server
echo 2. Start development server
echo 3. Stop and restart server
echo 4. Check server status
echo.

set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto stop
if "%choice%"=="2" goto start
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto status
goto invalid

:stop
echo.
echo Stopping development server...
taskkill /f /im node.exe > nul 2>&1
echo Server stopped successfully!
goto end

:start
echo.
echo Starting development server...
start /B npm run dev
echo Server is starting... Please wait a few seconds.
echo Open your browser and navigate to http://localhost:3000
goto end

:restart
echo.
echo Restarting development server...
call :stop
timeout /t 2 /nobreak > nul
call :start
goto end

:status
echo.
echo Checking server status...
tasklist | findstr "node.exe" > nul
if %errorlevel% equ 0 (
    echo Development server is RUNNING on http://localhost:3000
) else (
    echo Development server is NOT running
)
goto end

:invalid
echo.
echo Invalid choice. Please enter a number between 1 and 4.
goto end

:end
echo.
pause
