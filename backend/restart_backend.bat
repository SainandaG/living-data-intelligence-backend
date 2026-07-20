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

if exist ..\.venv\Scripts\python.exe (
    echo Using virtual environment Python...
    ..\.venv\Scripts\python main.py
) else (
    echo Using system Python...
    python main.py
)

