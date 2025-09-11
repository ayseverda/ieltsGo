@echo off
echo =====================================================
echo IELTS Go - Gerekli paketler yükleniyor...
echo =====================================================

if exist ".venv\Scripts\python.exe" (
    echo Sanal ortam bulundu, paketler yükleniyor...
    .venv\Scripts\python.exe -m pip install -r backend\requirements.txt
) else (
    echo Sanal ortam bulunamadı, yeni ortam oluşturuluyor...
    python -m venv .venv
    .venv\Scripts\python.exe -m pip install --upgrade pip
    .venv\Scripts\python.exe -m pip install -r backend\requirements.txt
)

echo =====================================================
echo Paket kurulumu tamamlandı!
echo =====================================================
pause
