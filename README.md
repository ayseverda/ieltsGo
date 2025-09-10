# IELTS Go - Yapay Zeka Destekli IELTS Hazırlık Platformu

Bu proje, IELTS sınavına hazırlanan öğrenciler için yapay zeka destekli bir öğrenme platformudur. Her modül ayrı geliştiriciler tarafından geliştirilmektedir.

## 🏗️ Proje Yapısı

```
ieltsGo/
├── 📁 src/               # React Frontend
├── 📁 backend/           # Ana API Gateway
│   ├── main.py          # API Gateway
│   └── requirements.txt # Tüm bağımlılıklar
├── 📁 modules/           # Modül backend'leri
│   ├── reading.py       # Reading modülü (Port: 8001)
│   ├── writing.py       # Writing modülü (Port: 8002)
│   ├── listening.py     # Listening modülü (Port: 8003)
│   ├── speaking.py      # Speaking modülü (Port: 8004)
│   └── run_all_modules.py # Tüm modülleri aynı anda başlat
├── start_all.bat        # Tüm servisleri başlat
├── start_modules.bat    # Sadece modülleri başlat
└── README.md
```

## 🚀 Hızlı Başlangıç

### 1. Otomatik Başlatma (Windows)

```bash
# Tüm servisleri aynı anda başlat (3 pencere açılır)
start_all.bat

# Sadece modülleri aynı anda başlat (1 pencere)
start_modules.bat
```

### 2. Manuel Başlatma

```bash
# Terminal 1 - Frontend
npm install
npm start

# Terminal 2 - Ana Backend (API Gateway)
cd backend
pip install -r requirements.txt
python main.py

# Terminal 3 - Tüm Modüller (Aynı anda)
cd modules
python run_all_modules.py
```

### 3. Servis URL'leri

- **Frontend**: http://localhost:3000
- **Ana API Gateway**: http://localhost:8000
- **Reading Modülü**: http://localhost:8001
- **Writing Modülü**: http://localhost:8002
- **Listening Modülü**: http://localhost:8003
- **Speaking Modülü**: http://localhost:8004

## 👥 Geliştirici Rehberi

### Modül Geliştirme

Her modül kendi klasöründe bağımsız olarak geliştirilir:

#### Reading Modülü Geliştiricisi
```bash
cd modules
# reading.py dosyasında API endpoint'lerinizi geliştirin
# Port: 8001
```

#### Writing Modülü Geliştiricisi
```bash
cd modules
# writing.py dosyasında API endpoint'lerinizi geliştirin
# Port: 8002
```

#### Listening Modülü Geliştiricisi
```bash
cd modules
# listening.py dosyasında API endpoint'lerinizi geliştirin
# Port: 8003
```

#### Speaking Modülü Geliştiricisi
```bash
cd modules
# speaking.py dosyasında API endpoint'lerinizi geliştirin
# Port: 8004
```

### API Endpoint Standartları

Her modül şu endpoint'leri sağlamalıdır:

```python
@app.get("/")  # Modül durumu
@app.post("/analyze")  # veya /evaluate
@app.get("/topics")  # veya /texts, /audio-files
@app.get("/topics/{id}")  # Belirli içerik
```

### Frontend Entegrasyonu

Frontend, ana API Gateway üzerinden modüllere erişir:

```typescript
// Reading modülüne istek
const response = await axios.post('http://localhost:8000/api/reading/analyze', {
  text: "Metin içeriği",
  questions: ["Soru 1", "Soru 2"],
  user_answers: ["A", "B"]
});

// Writing modülüne istek
const response = await axios.post('http://localhost:8000/api/writing/evaluate', {
  task_type: "task2",
  topic: "Technology",
  user_text: "Essay içeriği",
  word_count: 250
});
```

## 🔧 Geliştirme Araçları

### Health Check
```bash
# Tüm modüllerin durumunu kontrol et
curl http://localhost:8000/health
```

### API Dokümantasyonu
- Ana Gateway: http://localhost:8000/docs
- Reading: http://localhost:8001/docs
- Writing: http://localhost:8002/docs
- Listening: http://localhost:8003/docs
- Speaking: http://localhost:8004/docs

## 📋 Görev Dağılımı

- **Frontend**: Ana sayfa ve modül sayfaları ✅
- **Reading Modülü**: Metin analizi, soru çözme, AI entegrasyonu 🔄
- **Writing Modülü**: Essay değerlendirme, gramer analizi, AI entegrasyonu 🔄
- **Listening Modülü**: Ses dosyası işleme, konuşma tanıma, AI entegrasyonu 🔄
- **Speaking Modülü**: Konuşma analizi, telaffuz değerlendirme, AI entegrasyonu 🔄

### 🎯 Modül Geliştiricileri İçin

Her modül şu anda sadece temel yapıya sahip. Geliştiriciler:

1. **Kendi modül dosyasını düzenler** (`modules/reading.py`, `writing.py`, vb.)
2. **API endpoint'lerini ekler** (POST, GET, PUT, DELETE)
3. **AI entegrasyonu yapar** (OpenAI, diğer AI servisleri)
4. **Veritabanı bağlantısı kurar** (SQLite, PostgreSQL, vb.)
5. **Test yazar** ve **dokümantasyon** hazırlar

## 🚀 Sonraki Adımlar

- [ ] AI entegrasyonu (OpenAI API)
- [ ] Veritabanı entegrasyonu
- [ ] Kullanıcı kimlik doğrulama
- [ ] Gerçek içerik ekleme
- [ ] Test yazma
- [ ] Deployment

## 📞 İletişim

Her modül geliştiricisi kendi modülü ile ilgili soruları çözebilir. Genel proje soruları için ana geliştirici ile iletişime geçin.

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.
