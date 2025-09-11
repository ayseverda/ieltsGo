@echo off
echo IELTS Go - Tüm Servisler Aynı Anda Başlatılıyor...
echo.

if not exist ".venv\Scripts\python.exe" (
    echo Virtual environment not found, running installation...
    call install_dependencies.bat
)

echo 1. Frontend Başlatılıyor...
start "Frontend" cmd /k "npm start"

echo 2. Ana Backend (API Gateway) Başlatılıyor...
start "API Gateway" cmd /k ".venv\Scripts\python.exe backend\main.py"

echo 3. Tüm Modüller Başlatılıyor...
start "All Modules" cmd /k ".venv\Scripts\python.exe modules\run_all_modules.py"

echo.
echo ✅ Tüm servisler başlatıldı!
echo.
echo 🌐 Servis URL'leri:
echo    • Frontend: http://localhost:3000
echo    • API Gateway: http://localhost:8000
echo    • Reading: http://localhost:8001
echo    • Writing: http://localhost:8002
echo    • Listening: http://localhost:8003
echo    • Speaking: http://localhost:8004
echo.
echo 💡 Servisleri durdurmak için her pencerede Ctrl+C tuşlayın
echo.
pause
