from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import os
import json
import uvicorn
import asyncio
import datetime

from dotenv import load_dotenv, find_dotenv

try:
    from motor.motor_asyncio import AsyncIOMotorClient  # type: ignore
except Exception:
    AsyncIOMotorClient = None  # type: ignore

app = FastAPI(title="IELTS Reading Module API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Reading Module API - Geliştirici: AZROS", "status": "ready"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "module": "reading"}

# --------- Data models ---------

class Question(BaseModel):
    id: str
    type: str  # TrueFalseNotGiven, MultipleChoice, MatchingHeadings, FillInTheBlanks
    prompt: str
    options: Optional[List[str]] = None
    passage_id: Optional[str] = None
    answer: Optional[Any] = None  # Eski format için geriye uyumluluk
    correct_answer: Optional[Any] = None  # Yeni format

class Passage(BaseModel):
    id: str
    title: str
    text: str

class ReadingTest(BaseModel):
    id: str
    source: str = Field(description="Kaynak / test adı")
    passages: List[Passage]
    questions: List[Question]

class SubmitAnswersRequest(BaseModel):
    test_id: str
    answers: Dict[str, Any]
    user_id: Optional[str] = None
    test_data: Optional[Dict[str, Any]] = None  # Frontend'den gelen test verisi

class AIScoreFeedback(BaseModel):
    band_estimate: float
    strengths: List[str]
    improvements: List[str]
    tips: List[str]

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "reading")
TESTS_FILE = os.path.join(DATA_DIR, "tests.json")

# -------------- MongoDB Setup --------------
# Load .env from project root even if cwd is modules/
try:
    env_path = find_dotenv()
    if env_path:
        load_dotenv(env_path)
    else:
        load_dotenv()
except Exception:
    # Fallback silently if dotenv is not available
    pass
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "ielts_go")

_mongo_client: Optional[AsyncIOMotorClient] = None

def _get_mongo_client() -> Optional[AsyncIOMotorClient]:
    global _mongo_client
    if AsyncIOMotorClient is None:
        return None
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(MONGODB_URI)
    return _mongo_client

def _get_db():
    client = _get_mongo_client()
    return client[MONGODB_DB] if client else None

def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)

def load_tests() -> List[ReadingTest]:
    _ensure_data_dir()
    if not os.path.exists(TESTS_FILE):
        # Create sample data if not present
        sample = {
            "tests": [
                {
                    "id": "cambridge-15-test-1",
                    "source": "Cambridge IELTS 15 Test 1 (sample)",
                    "passages": [
                        {
                            "id": "p1",
                            "title": "The History of Tea",
                            "text": "Tea has been consumed for centuries..."
                        }
                    ],
                    "questions": [
                        {
                            "id": "q1",
                            "type": "TrueFalseNotGiven",
                            "prompt": "Tea originated in Europe.",
                            "answer": "False",
                            "passage_id": "p1"
                        },
                        {
                            "id": "q2",
                            "type": "MultipleChoice",
                            "prompt": "Which country is most associated with the origins of tea?",
                            "options": ["India", "China", "Japan", "UK"],
                            "answer": "China",
                            "passage_id": "p1"
                        },
                        {
                            "id": "q3",
                            "type": "MatchingHeadings",
                            "prompt": "Match the paragraph with the heading.",
                            "options": ["Origins", "Trade Expansion", "Cultural Impact"],
                            "answer": "Origins",
                            "passage_id": "p1"
                        },
                        {
                            "id": "q4",
                            "type": "FillInTheBlanks",
                            "prompt": "Tea has been consumed for _____.",
                            "answer": "centuries",
                            "passage_id": "p1"
                        }
                    ]
                }
            ]
        }
        with open(TESTS_FILE, "w", encoding="utf-8") as f:
            json.dump(sample, f, ensure_ascii=False, indent=2)
    with open(TESTS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return [ReadingTest(**t) for t in data.get("tests", [])]

async def _seed_tests_if_empty() -> None:
    db = _get_db()
    if db is None:
        return
    count = await db.reading_tests.count_documents({})
    if count == 0:
        tests = [t.model_dump() for t in load_tests()]
        if tests:
            await db.reading_tests.insert_many(tests)

async def _ensure_seed_once() -> None:
    # Run seeding once at startup
    db = _get_db()
    if db is not None:
        await _seed_tests_if_empty()

async def get_test_by_id(test_id: str) -> Optional[ReadingTest]:
    print(f"🔍 get_test_by_id çağrıldı: {test_id}")
    print(f"ℹ️ Testler artık MongoDB'de kaydedilmiyor - sadece anlık AI'dan geliyor")
    print(f"❌ Test bulunamadı: {test_id} - Testler anlık olarak üretiliyor")
    return None

def strip_answers(test: ReadingTest) -> Dict[str, Any]:
    test_dict = test.model_dump()
    for q in test_dict["questions"]:
        if "answer" in q:
            q.pop("answer")
    return test_dict

def _levenshtein(a: str, b: str) -> int:
    a = a or ""
    b = b or ""
    la, lb = len(a), len(b)
    if la == 0:
        return lb
    if lb == 0:
        return la
    dp = list(range(lb + 1))
    for i in range(1, la + 1):
        prev = dp[0]
        dp[0] = i
        for j in range(1, lb + 1):
            tmp = dp[j]
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[j] = min(
                dp[j] + 1,        # deletion
                dp[j - 1] + 1,    # insertion
                prev + cost       # substitution
            )
            prev = tmp
    return dp[lb]

def _similarity(a: str, b: str) -> float:
    a_norm = str(a).strip().lower()
    b_norm = str(b).strip().lower()
    if not a_norm and not b_norm:
        return 1.0
    dist = _levenshtein(a_norm, b_norm)
    max_len = max(1, max(len(a_norm), len(b_norm)))
    return max(0.0, 1.0 - dist / max_len)

def compute_raw_score(test: ReadingTest, user_answers: Dict[str, Any]) -> Dict[str, Any]:
    results = {}
    correct = 0
    partial = 0.0
    total = len(test.questions)
    for q in test.questions:
        ua = user_answers.get(q.id)
        is_correct = False
        
        # correct_answer alanını kontrol et (yeni format)
        correct_answer = getattr(q, 'correct_answer', None) or getattr(q, 'answer', None)
        
        if ua is not None and correct_answer is not None:
            if isinstance(correct_answer, list):
                is_correct = set(map(str, ua)) == set(map(str, correct_answer))
            else:
                # Multiple Choice için index kontrolü
                if q.type == "Multiple Choice" and isinstance(correct_answer, int):
                    try:
                        user_choice = int(ua) if str(ua).isdigit() else -1
                        is_correct = user_choice == correct_answer
                    except:
                        is_correct = False
                else:
                    # Diğer soru tipleri için string karşılaştırma
                    is_correct = str(ua).strip().lower() == str(correct_answer).strip().lower()
                    
                # grant small partial credit for near-miss on FillInTheBlanks
                if not is_correct and q.type in ["Fill in the blanks", "FillInTheBlanks"]:
                    sim = _similarity(str(ua), str(correct_answer))
                    # consider >=0.8 as correct, otherwise accumulate partial ratio
                    if sim >= 0.8:
                        is_correct = True
                    else:
                        partial += max(0.0, min(0.5, (sim - 0.5) * 2))  # 0..0.5 partial
                        
        results[q.id] = {"correct_answer": correct_answer, "user_answer": ua, "is_correct": is_correct}
        if is_correct:
            correct += 1
    return {"correct": correct, "partial": round(partial, 2), "total": total, "details": results}

def estimate_band_from_raw(raw_correct: int) -> float:
    # IELTS Academic Reading Band Score Conversion Table
    # Based on official IELTS scoring system
    band_scores = {
        40: 9.0, 39: 9.0, 38: 8.5, 37: 8.5, 36: 8.0, 35: 8.0,
        34: 7.5, 33: 7.5, 32: 7.0, 31: 7.0, 30: 7.0, 29: 6.5,
        28: 6.5, 27: 6.5, 26: 6.0, 25: 6.0, 24: 6.0, 23: 5.5,
        22: 5.5, 21: 5.5, 20: 5.0, 19: 5.0, 18: 4.5, 17: 4.5,
        16: 4.0, 15: 4.0, 14: 4.0, 13: 3.5, 12: 3.5, 11: 3.0,
        10: 3.0, 9: 3.0, 8: 2.5, 7: 2.5, 6: 2.0, 5: 2.0,
        4: 1.5, 3: 1.5, 2: 1.0, 1: 1.0, 0: 0.0
    }
    
    # Clamp the score between 0-40
    clamped_score = max(0, min(40, raw_correct))
    return band_scores.get(clamped_score, 1.0)

async def ai_feedback(test: ReadingTest, score_summary: Dict[str, Any]) -> AIScoreFeedback:
    api_key = os.getenv("GEMINI_API_KEY", "")
    # Placeholder: if no key, return heuristic feedback
    correct = score_summary["correct"]
    total = score_summary["total"]
    band = estimate_band_from_raw(correct)
    if not api_key:
        strengths = []
        improvements = []
        accuracy = correct / max(1, total)
        if accuracy >= 0.75:
            strengths.append("Metin detaylarını doğru yakalıyorsunuz.")
        else:
            improvements.append("True/False/Not Given sorularında ifadeyi metinle birebir kıyaslayın.")
        if accuracy < 0.5:
            improvements.append("Zaman yönetimi ve skimming/scanning stratejilerini çalışın.")
        tips = [
            "Paragraf başlıklarını önce okuyup ana fikri belirleyin.",
            "Önce soru tipini analiz edip anahtar kelimeleri işaretleyin.",
            "Synonym ve parafrase dikkat edin; tuzaklara düşmeyin.",
        ]
        return AIScoreFeedback(band_estimate=band, strengths=strengths, improvements=improvements, tips=tips)
    # AI path: use Gemini to produce strengths/improvements/tips
    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = (
            "You are an IELTS Reading examiner. Given a test summary, provide concise feedback "
            "in Turkish with 3 strengths, 3 improvements, and 3 tips. Keep it short and actionable.\n\n"
            f"Summary: correct={score_summary['correct']} of {score_summary['total']} (scaled)."
        )
        resp = await model.generate_content_async(prompt)  # type: ignore
        text = (resp.text or "").strip()
        strengths = []
        improvements = []
        tips = []
        # naive split
        for line in text.splitlines():
            ln = line.strip("- •* ")
            if not ln:
                continue
            if len(strengths) < 3:
                strengths.append(ln)
            elif len(improvements) < 3:
                improvements.append(ln)
            elif len(tips) < 3:
                tips.append(ln)
        return AIScoreFeedback(
            band_estimate=band,
            strengths=strengths[:3] or ["Okuma stratejileri iyi."],
            improvements=improvements[:3] or ["Metinle ifadeyi karşılaştırın."],
            tips=tips[:3] or ["Zaman yönetimine dikkat."],
        )
    except Exception:
        # fallback to heuristic text
        return AIScoreFeedback(
            band_estimate=band,
            strengths=["AI entegrasyonu kullanılabilir."],
            improvements=["Daha detaylı analiz eklenecek."],
            tips=["Gerçek sınavlardan pratik yapın."],
        )

@app.get("/tests")
async def list_tests():
    db = _get_db()
    tests: List[ReadingTest] = []
    if db is not None:
        await _ensure_seed_once()
        cursor = db.reading_tests.find({}, {"_id": 0})
        docs = await cursor.to_list(length=1000)
        tests = [ReadingTest(**d) for d in docs]
    else:
        tests = load_tests()
    return {"tests": [strip_answers(t) for t in tests]}

@app.get("/tests/{test_id}")
async def get_test(test_id: str):
    print(f"🔍 Test ID aranıyor: {test_id}")
    print(f"ℹ️ Testler artık MongoDB'de kaydedilmiyor - sadece anlık AI'dan geliyor")
    print(f"❌ Test bulunamadı: {test_id} - Testler anlık olarak üretiliyor")
    raise HTTPException(status_code=404, detail="Test bulunamadı - Testler anlık olarak üretiliyor")

@app.post("/submit")
async def submit_answers(payload: SubmitAnswersRequest):
    print(f"🔍 Submit endpoint çağrıldı")
    print(f"📋 Test ID: {payload.test_id}")
    print(f"📝 Cevaplar sayısı: {len(payload.answers)}")
    print(f"📊 Test data var mı: {hasattr(payload, 'test_data')}")
    print(f"📊 Test data değeri: {payload.test_data is not None if hasattr(payload, 'test_data') else 'N/A'}")
    
    # Test artık MongoDB'de değil - frontend'den gelen test verilerini kullan
    if not hasattr(payload, 'test_data') or not payload.test_data:
        print(f"❌ Test verisi bulunamadı")
        raise HTTPException(status_code=400, detail="Test verisi bulunamadı - frontend'den test verisi gönderilmeli")
    
    # Frontend'den gelen test verisini ReadingTest objesine çevir
    try:
        print(f"🔄 Test verisi ReadingTest objesine çevriliyor...")
        test = ReadingTest(**payload.test_data)
        print(f"✅ Test verisi başarıyla çevrildi")
    except Exception as e:
        print(f"❌ Test verisi çevirme hatası: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Test verisi formatı hatalı: {str(e)}")
    
    print(f"🔄 Puanlama başlıyor...")
    raw = compute_raw_score(test, payload.answers)
    print(f"📊 Ham puan: {raw}")
    # Include partial credit when scaling
    effective_correct = raw["correct"] + raw.get("partial", 0.0)
    
    # Test tipini kontrol et - practice test mi yoksa full test mi?
    is_practice_test = test.id.startswith("practice-")
    
    if is_practice_test:
        # Practice test için 13 soru varsayıyoruz
        scale_factor = 13 / max(1, raw["total"]) if raw["total"] < 13 else 1.0
        scaled_correct = int(round(effective_correct * scale_factor))
        band = estimate_band_from_raw(scaled_correct)
        feedback = await ai_feedback(test, {"correct": scaled_correct, "total": 13})
        total_questions = 13
    else:
        # IELTS reading toplam 40 soru varsayıyoruz
        scale_factor = 40 / max(1, raw["total"]) if raw["total"] < 40 else 1.0
        scaled_correct = int(round(effective_correct * scale_factor))
        band = estimate_band_from_raw(scaled_correct)
        feedback = await ai_feedback(test, {"correct": scaled_correct, "total": 40})
        total_questions = 40

    # Save submission if DB available
    db = _get_db()
    if db is not None:
        doc = {
            "test_id": payload.test_id,
            "user_id": payload.user_id,
            "answers": payload.answers,
            "raw": raw,
            "scaled": {"correct": scaled_correct, "total": total_questions},
        }
        await db.reading_submissions.insert_one(doc)
    
    # Dashboard için puan kaydetme
    print(f"🔍 Dashboard kaydetme başlıyor...")
    print(f"📋 User ID: {payload.user_id}")
    print(f"📊 Band Score: {band}")
    print(f"📝 Test Type: {'practice' if is_practice_test else 'full'}")
    
    try:
        import httpx
        dashboard_url = "http://localhost:8000/api/save-score"
        
        # Test tipini belirle
        test_type = "reading_practice" if is_practice_test else "reading_full"
        
        score_data = {
            "module": test_type,
            "band_score": float(band),
            "raw_score": raw["correct"],
            "total_questions": raw["total"],
            "topic": "Reading Test",
            "difficulty": "practice" if is_practice_test else "full",
            "test_date": datetime.datetime.now().isoformat(),
            "detailed_results": {
                "feedback": feedback.model_dump(),
                "scaled_correct": scaled_correct,
                "scaled_total": total_questions
            }
        }
        
        print(f"📦 Score Data: {score_data}")
        
        async with httpx.AsyncClient() as client:
            # Authorization header ekle
            headers = {}
            if payload.user_id:
                # JWT token oluştur (basit bir yaklaşım)
                import jwt
                import os
                secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-here")
                token = jwt.encode(
                    {"sub": payload.user_id, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)},
                    secret_key,
                    algorithm="HS256"
                )
                headers["Authorization"] = f"Bearer {token}"
                print(f"🔐 User ID: {payload.user_id} - Dashboard'a kaydediliyor...")
                print(f"🎫 Token: {token[:50]}...")
            else:
                print(f"⚠️ User ID bulunamadı - Dashboard'a kaydedilemiyor")
                print(f"⚠️ Payload: {payload}")
                return
            
            response = await client.post(dashboard_url, json=score_data, headers=headers)
            if response.status_code == 200:
                print(f"✅ Reading puanı dashboard'a kaydedildi: {band}")
            else:
                print(f"⚠️ Dashboard'a kaydetme başarısız: {response.status_code} - {response.text}")
                
    except Exception as e:
        print(f"⚠️ Dashboard kaydetme hatası: {str(e)}")

    return {
        "test_id": payload.test_id,
        "raw": raw,
        "scaled": {"correct": scaled_correct, "total": total_questions},
        "band_estimate": band,
        "feedback": feedback.model_dump(),
    }

@app.post("/tests")
async def create_test(test: ReadingTest):
    db = _get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Veritabanı bağlı değil")
    # Upsert by id
    await db.reading_tests.update_one({"id": test.id}, {"$set": test.model_dump()}, upsert=True)
    return {"ok": True, "id": test.id}

@app.post("/generate-practice")
async def generate_practice_test(request: Dict[str, Any]):
    """Reading pratik testi - 1 metin, 13 soru"""
    try:
        # Gemini API key kontrolü
        api_key = os.getenv("GEMINI_API_KEY", "YENİ_API_KEY_BURAYA")
        if not api_key:
            raise HTTPException(status_code=500, detail="Gemini API key bulunamadı")
        
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Test ID oluştur
        import uuid
        test_id = f"practice-{uuid.uuid4().hex[:8]}"
        
        # Reading pratik test üret
        prompt = """
IELTS Reading pratik testi oluştur. Format şöyle olmalı:

1 akademik metin (1200-1500 kelime):
- Genel akademik konu veya bilimsel makale

Toplam 13 soru, çeşitli tiplerde:
- Multiple Choice (4 şıklı) - 5-6 soru
- True/False/Not Given - 3-4 soru
- Fill in the blanks - 3-4 soru

ÖNEMLİ: Short answer questions SORMAYIN! Sadece yukarıdaki 3 tip soru kullanın.

Metin için:
- Başlık
- Uzun akademik seviyede metin (1200+ kelime)
- Kelime sayısı bilgisi

Her soru için:
- Soru metni
- Tip bilgisi
- Doğru cevap
- Passage ID (p1)

JSON formatında döndür:
{
  "id": "TEST_ID_PLACEHOLDER",
  "source": "IELTS Reading Practice Test",
  "passages": [
    {
      "id": "p1",
      "title": "Metin Başlığı",
      "text": "Uzun metin içeriği... (1200+ kelime)",
      "word_count": 1250
    }
  ],
  "questions": [
     {
       "id": "q1",
       "type": "Multiple Choice",
       "prompt": "Soru metni",
       "options": ["A) Seçenek 1", "B) Seçenek 2", "C) Seçenek 3", "D) Seçenek 4"],
       "correct_answer": 0,
       "passage_id": "p1"
     },
     {
       "id": "q2",
       "type": "True/False/Not Given",
       "prompt": "Soru metni",
       "correct_answer": "True",
       "passage_id": "p1"
     },
     {
       "id": "q3",
       "type": "Fill in the blanks",
       "prompt": "Cümle _____ ile tamamlanır.",
       "correct_answer": "kelime",
       "passage_id": "p1"
     }
  ]
}

 KRİTİK: Her soru için "correct_answer" alanı ZORUNLU! Boş cevap kabul edilmez!
- Multiple Choice: INDEX numarası (0, 1, 2, 3)
- True/False/Not Given: "True", "False", veya "Not Given"
- Fill in the blanks: Doğru kelime/cümle

ÖNEMLİ FORMAT KURALLARI:
- options alanı MUTLAKA string array olmalı: ["A) Seçenek 1", "B) Seçenek 2", "C) Seçenek 3", "D) Seçenek 4"]
- Dictionary formatı YASAK: [{"A": "Seçenek 1"}, {"B": "Seçenek 2"}] ❌
- passage_id alanı MUTLAKA string olmalı: "p1" (array değil!)

ÖRNEK CEVAPLAR:
- Multiple Choice: 2 (üçüncü seçenek için)
- True/False: "False"
- Fill in blanks: "mitigate"

KRİTİK KURALLAR:
- SADECE JSON döndür, başka hiçbir metin ekleme
- JSON'u ```json ile sarmalama
- Toplam 13 soru üret
- Soru ID'leri: q1, q2, q3... q13
- JSON formatına dikkat et, virgül hataları yapma
- passage_id alanı MUTLAKA string olmalı: "p1" (array değil!)
"""
        
        # Test ID'yi prompt'a ekle
        final_prompt = prompt.replace("TEST_ID_PLACEHOLDER", test_id)
        response = await model.generate_content_async(final_prompt)
        content = response.text.strip()
        
        # Debug: AI'dan gelen ham veriyi kontrol et
        print(f"🤖 AI'dan gelen ham veri (ilk 500 karakter): {content[:500]}...")
        
        # JSON parse et - trailing comma ve diğer hataları düzelt
        try:
            # ```json wrapper'ını temizle
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            
            # JSON temizleme - trailing comma'ları kaldır
            import re
            # Dizi sonundaki virgülleri kaldır: ], ] -> ]
            content = re.sub(r',\s*]', ']', content)
            # Obje sonundaki virgülleri kaldır: }, } -> }
            content = re.sub(r',\s*}', '}', content)
            
            # Daha agresif temizleme - bozuk karakterleri düzelt
            content = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', content)
            
            # JSON'u parse et
            test_data = json.loads(content)
            
            # Debug: Test verisini kontrol et
            print(f"🔍 Test verisi alındı: {test_data.get('id', 'NO_ID')}")
            if "questions" in test_data:
                print(f"📝 Toplam soru sayısı: {len(test_data['questions'])}")
                if test_data["questions"]:
                    first_q = test_data["questions"][0]
                    print(f"🔍 İlk soru: {first_q.get('id', 'NO_ID')}")
                    print(f"🔍 İlk sorunun cevabı: {first_q.get('answer', 'NO_ANSWER')}")
                    print(f"🔍 İlk sorunun tipi: {first_q.get('type', 'NO_TYPE')}")
                    print(f"🔍 İlk sorunun seçenekleri: {first_q.get('options', 'NO_OPTIONS')}")
            
            # Soru ID'lerini düzelt - sıralı yap (q1, q2, q3... q13)
            if "questions" in test_data:
                for i, question in enumerate(test_data["questions"], 1):
                    question["id"] = f"q{i}"
                    
                    # Options formatını düzelt (AI bazen dictionary gönderiyor)
                    if "options" in question and question["options"]:
                        if isinstance(question["options"], list) and len(question["options"]) > 0:
                            if isinstance(question["options"][0], dict):
                                # Dictionary formatından string array'e çevir
                                fixed_options = []
                                for opt_dict in question["options"]:
                                    for key, value in opt_dict.items():
                                        fixed_options.append(f"{key}) {value}")
                                question["options"] = fixed_options
                                print(f"🔧 Soru {i} options düzeltildi: {len(fixed_options)} seçenek")
                    
                    # passage_id array ise string'e çevir
                    if "passage_id" in question and isinstance(question["passage_id"], list):
                        # Array'in ilk elemanını kullan veya boş ise p1
                        question["passage_id"] = question["passage_id"][0] if question["passage_id"] else "p1"
                        print(f"🔧 Soru {i} passage_id düzeltildi: {question['passage_id']}")
                    
                    # correct_answer varsa answer'a da kopyala (geriye uyumluluk için)
                    if "correct_answer" in question and question["correct_answer"] is not None:
                        question["answer"] = question["correct_answer"]
                        print(f"✅ Soru {i} cevabı var: {question.get('correct_answer')}")
                    elif not question.get("answer"):
                        print(f"⚠️ Soru {i} cevabı boş!")
                        print(f"   Soru tipi: {question.get('type', 'NO_TYPE')}")
                        print(f"   Soru metni: {question.get('prompt', 'NO_PROMPT')[:100]}...")
                        print(f"   Seçenekler: {question.get('options', 'NO_OPTIONS')}")
                        print(f"   ❌ AI'dan boş cevap geldi - bu düzeltilmeli!")
            
            return test_data
            
        except json.JSONDecodeError as e:
            print(f"JSON parsing hatası: {str(e)}")
            print(f"Hata pozisyonu: Line {e.lineno}, Column {e.colno}")
            print(f"Hatalı JSON içeriği (ilk 1000 karakter): {content[:1000]}...")
            
            # Hata pozisyonu civarındaki içeriği göster
            if e.lineno and e.colno:
                lines = content.split('\n')
                if e.lineno <= len(lines):
                    error_line = lines[e.lineno - 1] if e.lineno > 0 else ""
                    print(f"Hatalı satır ({e.lineno}): {error_line}")
                    if e.lineno > 1:
                        print(f"Önceki satır ({e.lineno - 1}): {lines[e.lineno - 2] if e.lineno > 1 else ''}")
                    if e.lineno < len(lines):
                        print(f"Sonraki satır ({e.lineno + 1}): {lines[e.lineno] if e.lineno < len(lines) else ''}")
            
            raise HTTPException(status_code=500, detail=f"AI yanıtı JSON formatında değil: {str(e)}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test üretme hatası: {str(e)}")

@app.post("/generate-ielts-academic")
async def generate_ielts_academic_test(request: Dict[str, Any]):
    """IELTS Academic Reading formatında test üret"""
    try:
        # Gemini API key kontrolü
        api_key = os.getenv("GEMINI_API_KEY", "YENİ_API_KEY_BURAYA")
        if not api_key:
            raise HTTPException(status_code=500, detail="Gemini API key bulunamadı")
        
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        # Test ID oluştur
        import uuid
        test_id = f"ielts-academic-{uuid.uuid4().hex[:8]}"
        
        # IELTS Academic Reading test üret
        prompt = """
IELTS Academic Reading testi oluştur. Format şöyle olmalı:

3 akademik metin (her biri 1200-1500 kelime):
1. Genel akademik konu (13 soru)
2. İş dünyası/Eğitim konusu (13 soru) 
3. Bilimsel/Akademik konu (14 soru)

Toplam 40 soru, çeşitli tiplerde:
- Multiple Choice (4 şıklı)
- True/False/Not Given
- Fill in the blanks
- Matching headings
- Matching information

ÖNEMLİ: Short answer questions SORMAYIN! Sadece yukarıdaki 5 tip soru kullanın.

Her metin için:
- Başlık
- Uzun akademik seviyede metin (1200+ kelime)
- Kelime sayısı bilgisi

Her soru için:
- Soru metni
- Tip bilgisi
- Doğru cevap
- Passage ID (p1, p2, p3)

JSON formatında döndür:
{
  "id": "TEST_ID_PLACEHOLDER",
  "source": "IELTS Academic Reading Test",
  "passages": [
    {
      "id": "p1",
      "title": "Metin Başlığı",
      "text": "Uzun metin içeriği... (1200+ kelime)",
      "word_count": 1250
    },
    {
      "id": "p2", 
      "title": "İkinci Metin Başlığı",
      "text": "Uzun metin içeriği... (1200+ kelime)",
      "word_count": 1300
    },
    {
      "id": "p3",
      "title": "Üçüncü Metin Başlığı", 
      "text": "Uzun metin içeriği... (1200+ kelime)",
      "word_count": 1280
    }
  ],
        "questions": [
            {
       "id": "q1",
       "type": "Multiple Choice",
       "prompt": "Soru metni",
       "options": ["A) Seçenek 1", "B) Seçenek 2", "C) Seçenek 3", "D) Seçenek 4"],
       "correct_answer": 0,
       "passage_id": "p1"
     },
     {
       "id": "q2",
       "type": "True/False/Not Given",
       "prompt": "Soru metni",
       "correct_answer": "True",
       "passage_id": "p1"
     },
     {
       "id": "q3",
       "type": "Fill in the blanks",
       "prompt": "Cümle _____ ile tamamlanır.",
       "correct_answer": "kelime",
       "passage_id": "p1"
     }
  ]
}

 KRİTİK: Her soru için "correct_answer" alanı ZORUNLU! Boş cevap kabul edilmez!
- Multiple Choice: INDEX numarası (0, 1, 2, 3)
- True/False/Not Given: "True", "False", veya "Not Given"
- Fill in the blanks: Doğru kelime/cümle
- Matching: Eşleşen kelime/ifade

ÖNEMLİ FORMAT KURALLARI:
- options alanı MUTLAKA string array olmalı: ["A) Seçenek 1", "B) Seçenek 2", "C) Seçenek 3", "D) Seçenek 4"]
- Dictionary formatı YASAK: [{"A": "Seçenek 1"}, {"B": "Seçenek 2"}] ❌

ÖRNEK CEVAPLAR:
- Multiple Choice: 2 (üçüncü seçenek için)
- True/False: "False"
- Fill in blanks: "mitigate"
- Matching: "Climate change"

KRİTİK KURALLAR:
- SADECE JSON döndür, başka hiçbir metin ekleme
- JSON'u ```json ile sarmalama
- Her metin için 13-14 soru üret
- Soru ID'leri: q1, q2, q3... q40
- JSON formatına dikkat et, virgül hataları yapma
- passage_id alanı MUTLAKA string olmalı: "p1", "p2", "p3" (array değil!)
"""
        
        # Test ID'yi prompt'a ekle
        final_prompt = prompt.replace("TEST_ID_PLACEHOLDER", test_id)
        response = await model.generate_content_async(final_prompt)
        content = response.text.strip()
        
        # Debug: AI'dan gelen ham veriyi kontrol et
        print(f"🤖 AI'dan gelen ham veri (ilk 500 karakter): {content[:500]}...")
        
        # JSON parse et - trailing comma ve diğer hataları düzelt
        try:
            # ```json wrapper'ını temizle
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            
            # JSON temizleme - trailing comma'ları kaldır
            import re
            # Dizi sonundaki virgülleri kaldır: ], ] -> ]
            content = re.sub(r',\s*]', ']', content)
            # Obje sonundaki virgülleri kaldır: }, } -> }
            content = re.sub(r',\s*}', '}', content)
            
            # Daha agresif temizleme - bozuk karakterleri düzelt
            content = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', content)
            
            # JSON'u parse et
            test_data = json.loads(content)
            
            # Debug: Test verisini kontrol et
            print(f"🔍 Test verisi alındı: {test_data.get('id', 'NO_ID')}")
            if "questions" in test_data:
                print(f"📝 Toplam soru sayısı: {len(test_data['questions'])}")
                # İlk sorunun cevabını kontrol et
                if test_data["questions"]:
                    first_q = test_data["questions"][0]
                    print(f"🔍 İlk soru: {first_q.get('id', 'NO_ID')}")
                    print(f"🔍 İlk sorunun cevabı: {first_q.get('answer', 'NO_ANSWER')}")
                    print(f"🔍 İlk sorunun tipi: {first_q.get('type', 'NO_TYPE')}")
                    print(f"🔍 İlk sorunun seçenekleri: {first_q.get('options', 'NO_OPTIONS')}")
            
            # Soru ID'lerini düzelt - sıralı yap (q1, q2, q3... q40)
            if "questions" in test_data:
                for i, question in enumerate(test_data["questions"], 1):
                    question["id"] = f"q{i}"
                    
                    # Options formatını düzelt (AI bazen dictionary gönderiyor)
                    if "options" in question and question["options"]:
                        if isinstance(question["options"], list) and len(question["options"]) > 0:
                            if isinstance(question["options"][0], dict):
                                # Dictionary formatından string array'e çevir
                                fixed_options = []
                                for opt_dict in question["options"]:
                                    for key, value in opt_dict.items():
                                        fixed_options.append(f"{key}) {value}")
                                question["options"] = fixed_options
                                print(f"🔧 Soru {i} options düzeltildi: {len(fixed_options)} seçenek")
                    
                    # passage_id array ise string'e çevir
                    if "passage_id" in question and isinstance(question["passage_id"], list):
                        # Array'in ilk elemanını kullan veya boş ise p1
                        question["passage_id"] = question["passage_id"][0] if question["passage_id"] else "p1"
                        print(f"🔧 Soru {i} passage_id düzeltildi: {question['passage_id']}")
                    
                    # correct_answer varsa answer'a da kopyala (geriye uyumluluk için)
                    if "correct_answer" in question and question["correct_answer"] is not None:
                        question["answer"] = question["correct_answer"]
                        print(f"✅ Soru {i} cevabı var: {question.get('correct_answer')}")
                    elif not question.get("answer"):
                        print(f"⚠️ Soru {i} cevabı boş!")
                        print(f"   Soru tipi: {question.get('type', 'NO_TYPE')}")
                        print(f"   Soru metni: {question.get('prompt', 'NO_PROMPT')[:100]}...")
                        print(f"   Seçenekler: {question.get('options', 'NO_OPTIONS')}")
                        print(f"   ❌ AI'dan boş cevap geldi - bu düzeltilmeli!")
            
            # Test'i veritabanına kaydetme - sadece anlık AI'dan gelsin
            # db = _get_db()
            # if db is not None:
            #     await db.reading_tests.update_one(
            #         {"id": test_data["id"]}, 
            #         {"$set": test_data}, 
            #         upsert=True
            #     )
            
            return test_data
            
        except json.JSONDecodeError as e:
            print(f"JSON parsing hatası: {str(e)}")
            print(f"Hata pozisyonu: Line {e.lineno}, Column {e.colno}")
            print(f"Hatalı JSON içeriği (ilk 1000 karakter): {content[:1000]}...")
            
            # Hata pozisyonu civarındaki içeriği göster
            if e.lineno and e.colno:
                lines = content.split('\n')
                if e.lineno <= len(lines):
                    error_line = lines[e.lineno - 1] if e.lineno > 0 else ""
                    print(f"Hatalı satır ({e.lineno}): {error_line}")
                    if e.lineno > 1:
                        print(f"Önceki satır ({e.lineno - 1}): {lines[e.lineno - 2] if e.lineno > 1 else ''}")
                    if e.lineno < len(lines):
                        print(f"Sonraki satır ({e.lineno + 1}): {lines[e.lineno] if e.lineno < len(lines) else ''}")
            
            raise HTTPException(status_code=500, detail=f"AI yanıtı JSON formatında değil: {str(e)}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test üretme hatası: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
