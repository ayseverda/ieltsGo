# 🎯 IELTS Go - AI Destekli IELTS Hazırlık Platformu

Modern teknoloji ile IELTS sınavına hazırlan! Yapay zeka destekli, modüler yapıda geliştirilmiş kapsamlı IELTS hazırlık platformu.

## ✨ Özellikler



### 📚  Modüller (Geliştirilecek)
- **Listening Modülü**: Metin dinleme soru çözme
- **Reading Modülü**: Metin analizi ve soru çözme
- **Writing Modülü**: Yazma becerileri ve AI geri bildirimi
- **Speaking Modülü**: Konuşma pratiği ve değerlendirme

## 🚀 Hızlı Başlangıç

### 1️⃣ Projeyi İndir
```bash
git clone https://github.com/ayseverda/ieltsGo.git
cd ieltsGo
```

### 2️⃣ Frontend Kurulumu
```bash
npm install
```

### 3️⃣ Backend Kurulumu
```bash
# Python virtual environment oluştur
python -m venv venv

# Virtual environment'ı aktifleştir
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Bağımlılıkları yükle
pip install -r backend/requirements.txt
```

### 4️⃣ API Key'leri Ayarla
`.env` dosyası oluştur:
```env
GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

#### 🔑 API Key'leri Nasıl Alınır?

**Gemini API Key:**
1. https://makersuite.google.com/app/apikey adresine git
2. "Create API Key" butonuna tıkla
3. API key'ini kopyala

**ElevenLabs API Key:**
1. https://elevenlabs.io adresine git
2. Ücretsiz hesap oluştur
3. Profile → API Key'den key'ini al

### 5️⃣ Uygulamayı Başlat
```bash
# Windows:
.\start_all.bat

# macOS/Linux:
chmod +x start_all.sh
./start_all.sh
```

### 6️⃣ Kullanmaya Başla!
- **Frontend**: http://localhost:3000
- **Listening Modülü**: http://localhost:8003/docs

## 📁 Proje Yapısı

```
ieltsGo/
├── src/                    # React frontend
│   ├── components/         # React bileşenleri
│   │   ├── HomePage.tsx   # Ana sayfa
│   │   ├── ListeningModule.tsx # Listening modülü (tamamlandı)
│   │   ├── ReadingModule.tsx   # Reading modülü (placeholder)
│   │   ├── WritingModule.tsx   # Writing modülü (placeholder)
│   │   └── SpeakingModule.tsx  # Speaking modülü (placeholder)
│   ├── App.tsx            # Ana uygulama
│   ├── App.css            # Stiller
│   └── index.tsx          # Giriş noktası
├── backend/               # Ana API Gateway
│   ├── main.py           # FastAPI ana uygulama
│   └── requirements.txt  # Python bağımlılıkları
├── modules/              # Modül backend'leri
│   ├── listening.py      # Listening modülü (tamamlandı)
│   ├── reading.py        # Reading modülü (placeholder)
│   ├── writing.py        # Writing modülü (placeholder)
│   ├── speaking.py       # Speaking modülü (placeholder)
│   └── run_all_modules.py # Tüm modülleri başlat
├── public/               # Statik dosyalar
├── start_all.bat         # Tüm servisleri başlat
├── start_modules.bat     # Sadece modülleri başlat
├── .env                  # API key'leri (oluşturulacak)
└── .gitignore           # Git ignore dosyası
```

## 🎧 Listening Modülü Kullanımı

### 1. Ayarları Yap
- **Konu**: Education, Work, Travel, Health, Technology, Environment
- **Zorluk**: Başlangıç, Orta, İleri
- **Aksan**: İngiliz, Amerikan, Avustralya

### 2. Listening Oluştur
- "🎧 Yeni Listening Oluştur" butonuna tıkla
- AI 10-15 saniyede içerik üretir

### 3. Dinle ve Cevapla
- "Dinle" butonuna tıkla (metin başta gizli)
- İstersen "Göster" butonuyla metni görüntüle
- Soruları cevapla (çoktan seçmeli, boşluk doldurma, doğru/yanlış)

### 4. Sonuçları Gör
- "📊 Cevapları Kontrol Et" butonuna tıkla
- Detaylı analiz ve puanlama

## 🌐 Servis URL'leri

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:8000
- **Reading Modülü**: http://localhost:8001
- **Writing Modülü**: http://localhost:8002
- **Listening Modülü**: http://localhost:8003
- **Speaking Modülü**: http://localhost:8004

## 📚 API Dokümantasyonu

Her modül için Swagger UI mevcuttur:
- Reading: http://localhost:8001/docs
- Writing: http://localhost:8002/docs
- Listening: http://localhost:8003/docs
- Speaking: http://localhost:8004/docs


### Health Check
```bash
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health
```

## 🔧 Sorun Giderme

### Port Zaten Kullanımda
```bash
# Windows:
netstat -ano | findstr :8003
taskkill /PID [PID_NUMARASI] /F

# macOS/Linux:
lsof -ti:8003 | xargs kill -9
```

### API Key Hatası
- `.env` dosyasının proje kök dizininde olduğundan emin ol
- API key'lerin doğru olduğunu kontrol et
- ElevenLabs ücretsiz plan limitini kontrol et

### Ses Çalışmıyor
- ElevenLabs API key'inin doğru olduğundan emin ol
- Internet bağlantını kontrol et
- Fallback olarak Windows TTS kullanılır

## 📋 Görev Dağılımı


## 🎯 Sonraki Adımlar

- [ ] Reading modülü geliştirme
- [ ] Writing modülü geliştirme  
- [ ] Speaking modülü geliştirme
- [ ] Veritabanı entegrasyonu
- [ ] Kullanıcı sistemi
- [ ] Progress tracking
- [ ] Mobile responsive design

---

**🎉 Başarılar! IELTS sınavında başarılar dileriz!**