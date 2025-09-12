# 🚀 IELTS Go - Kurulum Rehberi

Bu rehber, IELTS Go projesini GitHub'dan indirip çalıştırmanız için gerekli tüm adımları içerir.

## 📋 Gereksinimler

- **Node.js** (v16 veya üzeri) - [İndir](https://nodejs.org/)
- **Python** (v3.8 veya üzeri) - [İndir](https://python.org/)
- **Git** - [İndir](https://git-scm.com/)
- **Internet bağlantısı** (API key'ler için)
- (Opsiyonel) **MongoDB** (Local veya Atlas)

## 🔧 Adım Adım Kurulum

### 1️⃣ Projeyi İndir

```bash
# GitHub'dan projeyi klonla
git clone https://github.com/ayseverda/ieltsGo.git

# Proje dizinine git
cd ieltsGo
```

### 2️⃣ Frontend Kurulumu

```bash
# Node.js paketlerini yükle
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

# Python paketlerini yükle
pip install -r backend/requirements.txt
```

### 4️⃣ Ortam Değişkenlerini Ayarla

#### .env Dosyası Oluştur

```bash
# env.example dosyasını .env olarak kopyala
# Windows:
copy env.example .env

# macOS/Linux:
cp env.example .env
```

#### API Key'leri ve DB URI Ekle

**Gemini API Key:**
1. https://makersuite.google.com/app/apikey adresine git
2. Google hesabınla giriş yap
3. "Create API Key" butonuna tıkla
4. API key'ini kopyala
5. `.env` dosyasında `GEMINI_API_KEY=your_api_key_here` kısmını düzenle

**ElevenLabs API Key:**
1. https://elevenlabs.io adresine git
2. "Sign Up" ile ücretsiz hesap oluştur
3. Giriş yap
4. Profile → API Key'e git
5. API key'ini kopyala
6. `.env` dosyasında `ELEVENLABS_API_KEY=your_api_key_here` kısmını düzenle

**MongoDB URI:**

- Lokalde MongoDB kullanıyorsanız:
  - `MONGODB_URI=mongodb://localhost:27017`
  - `MONGODB_DB=ielts_go`
- MongoDB Atlas kullanıyorsanız:
  - `MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/ielts_go?retryWrites=true&w=majority&appName=ieltsGo`
  - `MONGODB_DB=ielts_go`

Reading modülü MongoDB'ye bağlıysa testleri `reading_tests`, gönderimleri `reading_submissions` koleksiyonlarında saklar. DB yoksa JSON dosyasından okur.


### 5️⃣ Uygulamayı Başlat

#### Otomatik Başlatma (Önerilen)

```bash
# Windows:
.\start_all.bat

#### Manuel Başlatma

**Terminal 1 - Frontend:**
```bash
npm start
```

**Terminal 2 - Backend:**
```bash
cd backend
python main.py
```

**Terminal 3 - Modüller:**
```bash
cd modules
python run_all_modules.py
```

### 6️⃣ Test Et

1. **Frontend**: http://localhost:3000 adresine git

## 🔍 Sorun Giderme

### Port Zaten Kullanımda

```bash
# Windows:
netstat -ano | findstr :3000
netstat -ano | findstr :8003
taskkill /PID [PID_NUMARASI] /F

# macOS/Linux:
lsof -ti:3000 | xargs kill -9
lsof -ti:8003 | xargs kill -9
```

### Python Paketleri Yüklenmiyorsa

```bash
# pip'i güncelle
python -m pip install --upgrade pip

# Virtual environment'ı yeniden oluştur
rm -rf venv
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux
pip install -r backend/requirements.txt
```

### Node.js Paketleri Yüklenmiyor

```bash
# npm cache'i temizle
npm cache clean --force

# node_modules'ı sil ve yeniden yükle
rm -rf node_modules
npm install
```

## 🌐 Servis URL'leri

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:8000
- **Reading Modülü**: http://localhost:8001
- **Writing Modülü**: http://localhost:8002
- **Listening Modülü**: http://localhost:8003
- **Speaking Modülü**: http://localhost:8004

## 📚 API Dokümantasyonu

- Reading: http://localhost:8001/docs
- Writing: http://localhost:8002/docs
- Listening: http://localhost:8003/docs
- Speaking: http://localhost:8004/docs



**🎉 Başarılar! IELTS sınavında başarılar dileriz!**
