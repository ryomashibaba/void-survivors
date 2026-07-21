@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-update.ps1"
set "exitCode=%errorlevel%"
echo.
if not "%exitCode%"=="0" echo 更新処理はエラーコード %exitCode% で終了しました。
pause
exit /b %exitCode%
