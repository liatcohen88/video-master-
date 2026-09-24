@echo off
rem J.A.R.V.I.S. in Hebrew: starts the brain and the face, then opens Chrome.
rem Keep this window open while using JARVIS; closing it turns him off.
setlocal EnableExtensions
title JARVIS
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode

if not exist "node_modules\" call npm install
if not exist "node_modules\" goto installfailed

rem The offline transcriber only knows English and would override Chrome's
rem Hebrew speech recognition, so it stays off.
set "JARVIS_LOCAL_WHISPER=off"

start "" /b powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-jarvis.ps1"
call npm start
exit /b

:nonode
echo.
echo   Node.js is not installed. Install the LTS version from https://nodejs.org
echo   and then double-click start-jarvis.bat again.
echo.
pause
exit /b 1

:installfailed
echo.
echo   "npm install" did not finish. Scroll up to see why, or ask Claude Code to fix it.
echo.
pause
exit /b 1
