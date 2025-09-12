from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import os
import json
import uvicorn
import asyncio

from dotenv import load_dotenv

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

# API endpoints
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
    answer: Any

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

class AIScoreFeedback(BaseModel):
    band_estimate: float
    strengths: List[str]
    improvements: List[str]
    tips: List[str]

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "reading")
TESTS_FILE = os.path.join(DATA_DIR, "tests.json")

# -------------- MongoDB Setup --------------
load_dotenv()
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
    if not db:
        return
    count = await db.reading_tests.count_documents({})
    if count == 0:
        tests = [t.model_dump() for t in load_tests()]
        if tests:
            await db.reading_tests.insert_many(tests)

async def _ensure_seed_once() -> None:
    # Run seeding once at startup
    db = _get_db()
    if db:
        await _seed_tests_if_empty()

async def get_test_by_id(test_id: str) -> Optional[ReadingTest]:
    db = _get_db()
    if db:
        doc = await db.reading_tests.find_one({"id": test_id})
        if doc:
            return ReadingTest(**{k: v for k, v in doc.items() if k != "_id"})
    # Fallback to file if DB not available
    for t in load_tests():
        if t.id == test_id:
            return t
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
        if ua is not None:
            if isinstance(q.answer, list):
                is_correct = set(map(str, ua)) == set(map(str, q.answer))
            else:
                is_correct = str(ua).strip().lower() == str(q.answer).strip().lower()
                # grant small partial credit for near-miss on FillInTheBlanks
                if not is_correct and q.type == "FillInTheBlanks":
                    sim = _similarity(str(ua), str(q.answer))
                    # consider >=0.8 as correct, otherwise accumulate partial ratio
                    if sim >= 0.8:
                        is_correct = True
                    else:
                        partial += max(0.0, min(0.5, (sim - 0.5) * 2))  # 0..0.5 partial
        results[q.id] = {"correct_answer": q.answer, "user_answer": ua, "is_correct": is_correct}
        if is_correct:
            correct += 1
    return {"correct": correct, "partial": round(partial, 2), "total": total, "details": results}

def estimate_band_from_raw(raw_correct: int) -> float:
    # Simplified mapping for demo purposes
    # IELTS Reading has different mappings; here is a rough heuristic
    percentage = raw_correct / 40 if raw_correct <= 40 else raw_correct
    band = 3.0 + (percentage * 6.0)
    return round(min(9.0, max(1.0, band)), 1)

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
    if db:
        await _ensure_seed_once()
        cursor = db.reading_tests.find({}, {"_id": 0})
        docs = await cursor.to_list(length=1000)
        tests = [ReadingTest(**d) for d in docs]
    else:
        tests = load_tests()
    return {"tests": [strip_answers(t) for t in tests]}

@app.get("/tests/{test_id}")
async def get_test(test_id: str):
    test = await get_test_by_id(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test bulunamadı")
    return strip_answers(test)

@app.post("/submit")
async def submit_answers(payload: SubmitAnswersRequest):
    test = await get_test_by_id(payload.test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test bulunamadı")
    raw = compute_raw_score(test, payload.answers)
    # Include partial credit when scaling
    effective_correct = raw["correct"] + raw.get("partial", 0.0)
    # IELTS reading toplam 40 soru varsayıyoruz; örnek veri 4 soru
    scale_factor = 40 / max(1, raw["total"]) if raw["total"] < 40 else 1.0
    scaled_correct = int(round(effective_correct * scale_factor))
    band = estimate_band_from_raw(scaled_correct)
    feedback = await ai_feedback(test, {"correct": scaled_correct, "total": 40})

    # Save submission if DB available
    db = _get_db()
    if db:
        doc = {
            "test_id": payload.test_id,
            "user_id": payload.user_id,
            "answers": payload.answers,
            "raw": raw,
            "scaled": {"correct": scaled_correct, "total": 40},
        }
        await db.reading_submissions.insert_one(doc)

    return {
        "test_id": payload.test_id,
        "raw": raw,
        "scaled": {"correct": scaled_correct, "total": 40},
        "band_estimate": band,
        "feedback": feedback.model_dump(),
    }

@app.post("/tests")
async def create_test(test: ReadingTest):
    db = _get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Veritabanı bağlı değil")
    # Upsert by id
    await db.reading_tests.update_one({"id": test.id}, {"$set": test.model_dump()}, upsert=True)
    return {"ok": True, "id": test.id}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
