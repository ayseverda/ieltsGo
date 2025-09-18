# 🎯 IELTS Go - AI Destekli IELTS Hazırlık Platformu

Modern teknoloji ile IELTS sınavına hazırlan! Yapay zeka destekli, modüler yapıda geliştirilmiş kapsamlı IELTS hazırlık platformu.

## ✨ Özellikler

### 🎓 **Tamamlanan Modüller**
- ✅ **Listening Modülü**: AI destekli metin üretimi, ElevenLabs TTS, IELTS benzeri puanlama (1 sections, 10 questions)
- ✅ **Reading Modülü**: AI metin analizi, çoklu soru tipleri, detaylı geri bildirim, soru bazlı sonuç gösterimi
- ✅ **Writing Modülü**: AI essay değerlendirmesi, kriter bazlı puanlama, gelişim önerileri, Academic/General Training
- ✅ **Speaking Modülü**: Konuşma pratiği, gerçek zamanlı analiz, session bazlı puanlama, interaktif soru-cevap
- ✅ **General Test**: Tam IELTS sınav simülasyonu (Listening + Reading + Writing + Speaking)

### 🔐 **Kullanıcı Sistemi**
- ✅ **Kayıt/Giriş**: JWT token tabanlı authentication
- ✅ **Dashboard**: Detaylı istatistikler ve progress tracking
- ✅ **Puan Takibi**: MongoDB ile kullanıcı puanları saklama
- ✅ **Session Yönetimi**: Speaking için session bazlı puanlama
- ✅ **Cache Sistemi**: API çağrılarını azaltmak için localStorage cache

### 🤖 **AI Entegrasyonu**
- ✅ **Gemini AI**: Metin üretimi ve analiz
- ✅ **ElevenLabs TTS**: Doğal ses sentezi
- ✅ **Speech Recognition**: Konuşma-metin dönüşümü
- ✅ **FFmpeg**: Audio format dönüşümü
- ✅ **Akıllı Cache**: Gereksiz API çağrılarını önleme

### 🎨 **Modern UI/UX**
- ✅ **Responsive Design**: Tüm cihazlarda uyumlu
- ✅ **Tema Sistemi**: Navy blue, red, white, dark gray renk paleti
- ✅ **Minimalist Tasarım**: iOS benzeri temiz arayüz
- ✅ **Logo Entegrasyonu**: Profesyonel görünüm

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
pip install -r requirements.txt
```

### 4️⃣ MongoDB Kurulumu
```bash
# MongoDB Community Server indir ve kur
# https://www.mongodb.com/try/download/community

# MongoDB Compass ile bağlantıyı test et
# Connection String: mongodb://127.0.0.1:27017
```

### 5️⃣ API Key'leri Ayarla

**Gemini API Key:**
1. https://aistudio.google.com/ adresine git
2. "Get API Key" butonuna tıkla
3. API key'ini kopyala

**ElevenLabs API Key:**
1. https://elevenlabs.io adresine git
2. Ücretsiz hesap oluştur
3. Profile → API Key'den key'ini al

**API Key'leri Modüllere Ekle:**
- `modules/listening.py` → GEMINI_API_KEY ve ELEVENLABS_API_KEY
- `modules/speaking.py` → GEMINI_API_KEY ve ELEVENLABS_API_KEY
- `modules/writing.py` → GEMINI_API_KEY
- `modules/reading.py` → GEMINI_API_KEY

### 6️⃣ FFmpeg Kurulumu (Speaking için)
```bash
# Windows: FFmpeg indir ve C:\ffmpeg\bin'e çıkar
# PATH'e ekle: $env:PATH += ";C:\ffmpeg\bin"

# Test: ffmpeg -version
```

### 7️⃣ Uygulamayı Başlat
```bash
# Tüm servisleri başlat
npm start

# Ayrı terminal'de backend'i başlat
cd backend && python main.py

# Ayrı terminal'de modülleri başlat
cd modules && python listening.py
cd modules && python writing.py  
cd modules && python reading.py
cd modules && python speaking.py
```

### 8️⃣ Kullanmaya Başla!
- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:8000
- **Dashboard**: Kullanıcı kayıt/giriş yap

## 📁 Proje Yapısı

```
ieltsGo/
├── src/                    # React frontend
│   ├── components/         # React bileşenleri
│   │   ├── HomePage.tsx   # Ana sayfa
│   │   ├── Dashboard.tsx  # Kullanıcı dashboard'u
│   │   ├── ListeningModule.tsx # Listening modülü ✅
│   │   ├── ReadingModule.tsx   # Reading modülü ✅
│   │   ├── WritingModule.tsx   # Writing modülü ✅
│   │   ├── SpeakingModule.tsx  # Speaking modülü ✅
│   │   ├── SpeechRecording.tsx # Speaking practice ✅
│   │   └── GeneralTestPage.tsx # General Test ✅
│   ├── App.tsx            # Ana uygulama
│   ├── App.css            # Stiller
│   └── index.tsx          # Giriş noktası
├── backend/               # Ana API Gateway
│   ├── main.py           # FastAPI ana uygulama
│   ├── api/              # API endpoints
│   │   ├── auth.py       # Authentication ✅
│   │   ├── scores.py     # Puan yönetimi ✅
│   │   └── speaking.py   # Speaking API ✅
│   └── requirements.txt  # Python bağımlılıkları
├── modules/              # Modül backend'leri
│   ├── listening.py      # Listening modülü ✅
│   ├── reading.py        # Reading modülü ✅
│   ├── writing.py        # Writing modülü ✅
│   ├── speaking.py       # Speaking modülü ✅
│   └── run_all_modules.py # Tüm modülleri başlat
├── public/               # Static dosyalar
│   ├── logo.png         # Ana logo
│   ├── ieltsgokitap.jpg # Kitap logo
│   └── ieltsgoyazi.jpg  # Yazı logo
├── requirements.txt      # Ana Python bağımlılıkları
├── .gitignore           # Git ignore dosyası
└── README.md           # Bu dosya
```

## 🎧 Modül Kullanımı

### 🎧 Listening Modülü
1. **Ayarları Yap**: Konu, zorluk, aksan seç
2. **Dinle**: AI üretilen metni dinle
3. **Cevapla**: 40 IELTS benzeri soru (4 sections)
4. **Sonuç**: Detaylı analiz ve band score

### 📖 Reading Modülü  
1. **Metin Seç**: AI üretilen reading passage
2. **Oku ve Cevapla**: Çoklu soru tipleri (13 soru practice)
3. **Analiz**: Detaylı geri bildirim
4. **Soru Sonuçları**: Her sorunun altında doğru/yanlış durumu

### ✍️ Writing Modülü
1. **Task Seç**: Academic/General, Task 1/2
2. **Yaz**: Essay/letter yaz
3. **Değerlendirme**: AI kriter bazlı analiz
4. **Görsel**: Academic Task 1 için tablo/grafik

### 🎤 Speaking Modülü
1. **Konu Seç**: Çeşitli konular
2. **Konuş**: Mikrofonla konuş
3. **Analiz**: Gerçek zamanlı değerlendirme
4. **Session**: Session bazlı puanlama

### 🏆 General Test
1. **Başlat**: Tam IELTS sınav simülasyonu
2. **Modüller**: Listening → Reading → Writing → Speaking
3. **Değerlendirme**: Tüm modüllerin genel puanı
4. **Sonuç**: IELTS band score hesaplama

## 🌐 Servis URL'leri

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:8000
- **Listening Modülü**: http://localhost:8001
- **Writing Modülü**: http://localhost:8002  
- **Reading Modülü**: http://localhost:8003
- **Speaking Modülü**: http://localhost:8004

## 📚 API Dokümantasyonu

Her modül için Swagger UI mevcuttur:
- Listening: http://localhost:8001/docs
- Writing: http://localhost:8002/docs
- Reading: http://localhost:8003/docs
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
netstat -ano | findstr :8001
taskkill /PID [PID_NUMARASI] /F

# macOS/Linux:
lsof -ti:8001 | xargs kill -9
```

### API Key Hatası
- API key'lerin modüllerde doğru yerde olduğunu kontrol et
- Gemini API quota limitini kontrol et
- ElevenLabs ücretsiz plan limitini kontrol et

### FFmpeg Hatası (Speaking)
- FFmpeg'in PATH'de olduğunu kontrol et: `ffmpeg -version`
- C:\ffmpeg\bin klasörünün var olduğunu kontrol et

### MongoDB Bağlantı Hatası
- MongoDB'nin çalıştığını kontrol et
- Connection string: `mongodb://127.0.0.1:27017`

### Ses Çalışmıyor
- ElevenLabs API key'inin doğru olduğundan emin ol
- Internet bağlantını kontrol et
- Mikrofon izinlerini kontrol et

### Cache Sorunları
- Browser localStorage'ı temizle
- Console'da cache log'larını kontrol et

## 🎯 Proje Durumu

### ✅ **Tamamlanan Özellikler**
- [x] Tüm modüller (Listening, Reading, Writing, Speaking)
- [x] General Test (Tam IELTS simülasyonu)
- [x] User authentication & registration
- [x] MongoDB entegrasyonu
- [x] Puan takip sistemi
- [x] Dashboard istatistikleri
- [x] Session bazlı Speaking puanlama
- [x] FFmpeg entegrasyonu
- [x] Authorization sistemi
- [x] AI entegrasyonları
- [x] Cache sistemi
- [x] Modern UI/UX tasarım
- [x] Tema sistemi
- [x] Logo entegrasyonu
- [x] Responsive design

### 🔄 **Geliştirilebilir Özellikler**
- [ ] Mobile app (React Native)
- [ ] Offline mode
- [ ] Progress analytics
- [ ] Social features
- [ ] Advanced reporting
- [ ] Multi-language support
- [ ] Dark mode toggle
- [ ] Voice recognition improvements

## 🎨 Tema Renkleri

- **Navy Blue**: `#1e3a8a` - Ana tema rengi
- **Red**: `#dc2626` - Vurgu rengi
- **White**: `#ffffff` - Arka plan
- **Dark Gray**: `#374151` - Metin rengi

## 🤝 Katkıda Bulunma

1. Fork yap
2. Feature branch oluştur (`git checkout -b feature/amazing-feature`)
3. Commit yap (`git commit -m 'Add amazing feature'`)
4. Push yap (`git push origin feature/amazing-feature`)
5. Pull Request oluştur

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

---

**🎉 Başarılar! IELTS sınavında başarılar dileriz!**

**Proje GitHub'da**: https://github.com/ayseverda/ieltsGo

