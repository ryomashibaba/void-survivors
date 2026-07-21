@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title VOID SURVIVORS Updater

set "EXIT_CODE=1"

echo.
echo ========================================
echo   VOID SURVIVORS UPDATE
echo ========================================
echo.

if not exist "%~dp0apply-update.ps1" (
    echo ERROR: apply-update.ps1 was not found.
    goto :END
)

where powershell.exe >nul 2>nul
if errorlevel 1 (
    echo ERROR: powershell.exe was not found.
    goto :END
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-update.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

:END
echo.
echo ========================================
echo Exit code: %EXIT_CODE%
echo ========================================
echo.
pause
exit /b %EXIT_CODE%