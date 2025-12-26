@echo off
echo 💀 Killing all Python processes...
taskkill /F /IM python.exe
echo.
echo 🧹 Cleaning up ports...
echo.
echo ✅ Done. You can now start the backend cleanly with:
echo python main.py
pause
