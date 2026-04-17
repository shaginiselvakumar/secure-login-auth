@echo off
REM Startup script for SecureCorp Login System (Windows)

echo ===================================
echo SecureCorp Login System - Startup
echo ===================================
echo.

REM Check if .env file exists
if not exist .env (
    echo Warning: .env file not found!
    echo Creating .env from .env.example...
    copy .env.example .env
    echo .env file created. Please edit it with your configuration.
    echo.
)

REM Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Start the server
echo Starting server...
echo.
call npm run dev
