@echo off
rem Voice assistant launcher: finds Python (installs it if missing) and starts assistant.py.
setlocal EnableExtensions
title Voice Assistant
cd /d "%~dp0"

call :findpython
if not defined PYEXE call :installpython
if not defined PYEXE goto nopython

"%PYEXE%" assistant.py %*
if errorlevel 1 pause
exit /b

:findpython
set "PYEXE="
for /f "delims=" %%P in ('py -3 -c "import sys; print(sys.executable)" 2^>nul') do set "PYEXE=%%P"
if not defined PYEXE for /f "delims=" %%P in ('python -c "import sys; print(sys.executable)" 2^>nul') do set "PYEXE=%%P"
rem The Microsoft Store "python" placeholder prints a message instead of a path.
if defined PYEXE if not exist "%PYEXE%" set "PYEXE="
if not defined PYEXE for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do if exist "%%D\python.exe" set "PYEXE=%%D\python.exe"
exit /b

:installpython
echo.
echo   Python is not installed yet. Installing it now (about a minute)...
echo.
winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
call :findpython
exit /b

:nopython
echo.
echo   Could not find or install Python.
echo   Please install it from https://www.python.org/downloads/
echo   and then double-click start.bat again.
echo.
pause
exit /b 1
