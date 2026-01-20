@echo off
echo Killing all Python processes...
taskkill /F /IM python.exe 2>nul
if %errorlevel% equ 0 (
    echo Python processes killed successfully
) else (
    echo No Python processes found or already killed
)

echo Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo Starting backend server...
cd /d "%~dp0"
python main.py
