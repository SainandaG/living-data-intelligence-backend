@echo off
chcp 65001 >nul
echo Cleaning up old processes...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *main.py*" 2>nul

echo Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo Starting backend with UTF-8 encoding...
set PYTHONIOENCODING=utf-8
python main.py
