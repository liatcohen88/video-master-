@echo off
rem Double-click to install JAMES (JARVIS in Hebrew).
title JAMES installer
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kit\install-jarvis.ps1"
if errorlevel 1 pause
