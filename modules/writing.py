from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
from dotenv import load_dotenv

try:
    import google.generativeai as genai
except Exception:
    genai = None

app = FastAPI(title="IELTS Writing Module API", version="1.0.0")

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
    return {"message": "Writing Module API - Geliştirici: DUYGU", "status": "ready"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "module": "writing"}


# ---------- Model & Config ----------
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyCYeBOoGsW1du63HlKZ7W0AtknImO9Y1fo")

if genai and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


class EvaluateRequest(BaseModel):
    essay: str
    topic: str | None = None
    mode: str | None = None
    task: str | None = None
    letterType: str | None = None


def _build_prompt(essay: str, topic: str | None, mode: str | None, task: str | None, letter_type: str | None) -> str:
    konu_bilgi = f"Konu: {topic}\n\n" if topic else ""
    context = ""
    if mode == "academic":
        if task == "task1":
            context = (
                "Bu IELTS Academic Writing Task 1 değerlendirmesidir. Adaydan grafik/tabloda verilen bilgiyi 150 kelime civarında nesnel biçimde özetlemesi beklenir. "
            )
        else:
            context = (
                "Bu IELTS Academic Writing Task 2 değerlendirmesidir. Adaydan 250 kelime civarında argüman geliştirmesi beklenir. "
            )
    elif mode == "general":
        if task == "task1":
            context = (
                f"Bu IELTS General Training Task 1 mektup değerlendirmesidir. Mektup türü: {letter_type or 'belirsiz'}. Uygun hitap, ton ve yapı beklenir. "
            )
        else:
            context = (
                "Bu IELTS General Training Task 2 essay değerlendirmesidir. Günlük yaşam/toplumsal konu üzerine görüş yazısı beklenir. "
            )
    return (
        context + "You are an IELTS writing examiner. Evaluate the following essay based on these criteria: \n"
        "1. Task Achievement\n2. Coherence & Cohesion\n3. Lexical Resource\n4. Grammatical Range & Accuracy\n\n"
        "When giving feedback, be SPECIFIC and ACTIONABLE for the student. Provide concrete examples, sample sentences, stronger lexical choices, and clear next steps.\n"
        "Provide the output in the following strict JSON format (keys must match exactly), all comments in Turkish:\n"
        "{\n  \"overall_band\": 0-9,\n  \"criteria\": {\n    \"Task Achievement\": 0-9,\n    \"Coherence & Cohesion\": 0-9,\n    \"Lexical Resource\": 0-9,\n    \"Grammatical Range & Accuracy\": 0-9\n  },\n  \"strengths\": [\"list of strengths\"],\n  \"weaknesses\": [\"list of weaknesses\"],\n  \"suggestions\": [\"list of suggestions\"]\n}\n\n"
        "Return only JSON without any explanation or code block fences.\n\n"
        + konu_bilgi + "Essay:\n" + essay
    )


@app.post("/evaluate")
async def evaluate_writing(payload: EvaluateRequest):
    if not payload.essay or len(payload.essay.strip()) < 30:
        raise HTTPException(status_code=400, detail="Lütfen en az birkaç cümleden oluşan bir essay girin.")

    if not genai or not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI anahtarı bulunamadı. Lütfen .env içine geçerli GEMINI_API_KEY girin ve servisi yeniden başlatın.")

    def generate_with_fallback(prompt: str) -> str:
        # Force a single, widely-available model to avoid 404 issues on some accounts
        name = "gemini-1.5-flash"
        try:
            model = genai.GenerativeModel(name)
            resp = model.generate_content(prompt)
            return resp.text or "{}"
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini hatası: {str(e)}")

    prompt = _build_prompt(payload.essay, payload.topic, payload.mode, payload.task, payload.letterType)
    text = generate_with_fallback(prompt)

    # Güvenli JSON parse: Model bazen kod bloğu ekleyebilir
    import json, re

    cleaned = text.strip()
    cleaned = re.sub(r"^```(json)?", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"```$", "", cleaned)
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
    except Exception:
        # Fallback: minimal cevap üret
        data = {"overall_band": 6, "raw": cleaned}

    return data


@app.get("/topic")
async def generate_topic(mode: str | None = None, task: str | None = None, letterType: str | None = None):
    """Konu üretir: Gemini varsa ondan, yoksa sabit listeden rastgele."""
    presets = [
        "Some people think that public transport should be free. To what extent do you agree or disagree?",
        "Many believe that technology is making people less social. Discuss both views and give your opinion.",
        "Should governments invest more in space exploration or in solving problems on Earth?",
        "It is better for children to grow up in the countryside than in a big city. Do you agree or disagree?",
        "In some countries, tourists have to pay more than locals for the same attractions. Is this a positive or negative development?",
    ]

    import random

    if not genai or not GEMINI_API_KEY:
        return {"topic": random.choice(presets)}

    try:
        suggestion = ""
        try:
            model = genai.GenerativeModel("gemini-1.5-flash", generation_config={
                "temperature": 0.9,
                "top_p": 0.9,
                "top_k": 40
            })
            if mode == "general" and task == "task1":
                prompt = (
                    f"Generate ONE varied IELTS General Training Task 1 letter scenario in English (no preface). Include recipient and purpose. Letter type: {letterType or 'unspecified'}. Keep it one sentence. Always produce a different realistic scenario." )
            elif mode == "academic" and task == "task1":
                prompt = (
                    "Generate ONE concise IELTS Academic Writing Task 1 description in English (no preface). It should describe what a chart/table/diagram shows, e.g. 'The bar chart compares...' or 'The table shows...'."
                )
            else:
                if mode == "academic" and task == "task2":
                    prompt = (
                        "Suggest ONE IELTS Academic Writing Task 2 topic in English (no preface). "
                        "The topic must be academic/abstract and policy- or research-oriented: science, technology regulation, climate policy, macroeconomics, higher education, bioethics, AI governance, public health, or international relations. "
                        "Avoid lifestyle/personal routine/leisure topics (e.g., hobbies, daily habits). "
                        "Use academic phrasing such as 'To what extent', 'Critically evaluate', 'Discuss both views', 'Assess the impacts'. "
                        "Limit to 12–22 words; do not add explanations."
                    )
                else:
                    prompt = (
                        "Suggest ONE varied IELTS General Training Task 2 topic in English (no preface). "
                        "Make it about daily life and society (workplace, culture, community, lifestyle)."
                    )
            resp = model.generate_content(prompt)
            suggestion = (resp.text or "").strip().strip("` ")
        except Exception:
            suggestion = ""
        if not suggestion:
            suggestion = random.choice(presets)
        return {"topic": suggestion}
    except Exception:
        return {"topic": random.choice(presets)}


@app.get("/visual")
async def generate_visual():
    """Academic Task 1 için görsel şema üretir. Basit üç tür: table | bar | pie."""
    import random
    kinds = ["table", "bar", "pie"]
    kind = random.choice(kinds)

    if kind == "table":
    return {
            "type": "table",
            "columns": ["Year", "Category A", "Category B"],
            "rows": [[2018, 30, 20], [2022, 45, 35]]
        }
    if kind == "bar":
        return {
            "type": "bar",
            "labels": ["A", "B", "C", "D"],
            "values": [12, 25, 18, 30]
        }
    return {
        "type": "pie",
        "labels": ["Online", "In-person", "Hybrid"],
        "values": [50, 30, 20]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
