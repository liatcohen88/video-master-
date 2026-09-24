@echo off
rem JAMES (JARVIS in Hebrew): starts the brain and the face, then opens Chrome.
rem Keep this window open while using JAMES; closing it turns him off.
setlocal EnableExtensions
title JAMES
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode

if not exist "node_modules\" call npm install
if not exist "node_modules\" goto installfailed

rem The offline transcriber only knows English and would override Chrome's
rem Hebrew speech recognition, so it stays off. The bridge stays on this
rem computer only, which also spares a Windows firewall question.
set "JARVIS_LOCAL_WHISPER=off"
set "JARVIS_BRIDGE_HOST=127.0.0.1"
set "VITE_BRIDGE_URL=ws://127.0.0.1:8787"

rem Sonnet 5 answers quickly and is light on the Claude plan's usage limits.
rem Opus 5 can still be picked in SETTINGS. brain-check.mjs uses the same one.
if not defined JARVIS_MODEL set "JARVIS_MODEL=claude-sonnet-5"

rem Claude Code on Windows needs Git Bash, and does not always find it alone.
if not defined CLAUDE_CODE_GIT_BASH_PATH if exist "%ProgramFiles%\Git\bin\bash.exe" set "CLAUDE_CODE_GIT_BASH_PATH=%ProgramFiles%\Git\bin\bash.exe"
if not defined CLAUDE_CODE_GIT_BASH_PATH if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "CLAUDE_CODE_GIT_BASH_PATH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"

start "" /b powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-jarvis.ps1"
call npm start
exit /b

:nonode
echo.
echo   Node.js is not installed. Run INSTALL-JAMES.bat again, or install the
echo   LTS version from https://nodejs.org and then try again.
echo.
pause
exit /b 1

:installfailed
echo.
echo   "npm install" did not finish. Scroll up to see why, or run INSTALL-JAMES.bat again.
echo.
pause
exit /b 1
