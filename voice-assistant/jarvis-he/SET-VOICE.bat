@echo off
rem Double-click to give JAMES a natural Google voice, or to change it.
title JAMES voice
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kit\set-voice.ps1"
if errorlevel 1 pause
