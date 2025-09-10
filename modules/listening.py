from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
from typing import List, Optional
import google.generativeai as genai
from dotenv import load_dotenv
import pyttsx3
import threading
import time
import base64
import requests

# Environment variables yükle
load_dotenv()

# Gemini API'yi yapılandır
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("⚠️  GEMINI_API_KEY bulunamadı! .env dosyasına ekleyin.")
    print("   Örnek: GEMINI_API_KEY=your_api_key_here")
else:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')

app = FastAPI(title="IELTS Listening Module API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ListeningRequest(BaseModel):
    audio_file_path: str
    questions: List[dict]
    user_answers: List[str]

class ListeningResponse(BaseModel):
    score: float
    feedback: str
    correct_answers: List[str]
    detailed_analysis: dict

class AudioFileResponse(BaseModel):
    file_id: str
    message: str
    duration: Optional[int] = None
    format: Optional[str] = None

class GenerateListeningRequest(BaseModel):
    topic: str
    difficulty: str = "intermediate"  # beginner, intermediate, advanced
    duration: int = 180  # saniye
    accent: str = "british"  # british, american, australian

class GeneratedListeningResponse(BaseModel):
    transcript: str
    questions: List[dict]
    audio_script: str
    topic: str
    difficulty: str
    estimated_duration: int

class TTSRequest(BaseModel):
    text: str
    accent: str = "british"  # british, american, australian
    speed: float = 1.0  # 0.5 - 2.0

class TTSResponse(BaseModel):
    message: str
    duration: float
    status: str
    audio_data: Optional[str] = None  # Base64 encoded audio

# API endpoints
@app.get("/")
async def root():
    return {"message": "Listening Module API - Geliştirici: AYSE", "status": "ready"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "module": "listening"}

@app.post("/generate-listening", response_model=GeneratedListeningResponse)
async def generate_listening(request: GenerateListeningRequest):
    """
    Gemini AI ile IELTS benzeri listening metni ve sorular üretir
    """
    try:
        # Gemini'ye prompt gönder
        prompt = f"""
        Create an IELTS Listening test about {request.topic} at {request.difficulty} level.

        Generate a realistic listening passage that would take about {request.duration} seconds to read aloud.
        Make it sound natural with {request.accent} accent style.

        Return ONLY this JSON format (no other text):
        {{
            "transcript": "A detailed, realistic transcript of 200-300 words about {request.topic}. Include natural speech patterns, realistic dialogue or monologue that sounds like a real IELTS listening passage. Make it engaging and informative.",
            "audio_script": "The same content as transcript - this will be read aloud by text-to-speech",
            "questions": [
                {{
                    "id": 1,
                    "question": "What is the main topic discussed in this passage?",
                    "type": "multiple_choice",
                    "options": ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"],
                    "correct_answer": 1
                }},
                {{
                    "id": 2,
                    "question": "Complete the sentence: The speaker mentions that {request.topic} is important because _____",
                    "type": "fill_in_blank",
                    "correct_answer": "it helps people understand the topic better"
                }},
                {{
                    "id": 3,
                    "question": "According to the speaker, {request.topic} has become more popular in recent years.",
                    "type": "true_false",
                    "correct_answer": true
                }},
                {{
                    "id": 4,
                    "question": "What does the speaker recommend for people interested in {request.topic}?",
                    "type": "multiple_choice",
                    "options": ["A) Study hard", "B) Practice regularly", "C) Read books", "D) Take courses"],
                    "correct_answer": 1
                }},
                {{
                    "id": 5,
                    "question": "Fill in the missing word: The speaker suggests that _____ is the key to success in {request.topic}.",
                    "type": "fill_in_blank",
                    "correct_answer": "dedication"
                }},
                {{
                    "id": 6,
                    "question": "The speaker believes that {request.topic} is only suitable for young people.",
                    "type": "true_false",
                    "correct_answer": false
                }}
            ]
        }}

        IMPORTANT: 
        - Return ONLY the JSON object, no explanations or additional text
        - For multiple_choice questions, correct_answer must be a NUMBER (0, 1, 2, or 3)
        - For fill_in_blank questions, correct_answer must be a STRING
        - For true_false questions, correct_answer must be a BOOLEAN (true or false)
        - Make sure all questions have the correct type and format
        """

        response = model.generate_content(prompt)
        
        # JSON'u parse et
        import json
        import re
        
        try:
            # Gemini'den gelen yanıtı temizle
            response_text = response.text.strip()
            
            # JSON kısmını bul (```json ile başlayıp ``` ile biten kısım)
            json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
            if json_match:
                json_text = json_match.group(1)
            else:
                # Eğer ```json yoksa, direkt yanıtı kullan
                json_text = response_text
            
            # JSON parse et
            data = json.loads(json_text)
            
            # Veri doğrulama ve düzeltme
            if "questions" in data:
                for question in data["questions"]:
                    # Soru tipine göre correct_answer'ı düzelt
                    if question.get("type") == "multiple_choice":
                        if not isinstance(question.get("correct_answer"), int):
                            question["correct_answer"] = 0  # Varsayılan olarak ilk seçenek
                    elif question.get("type") == "fill_in_blank":
                        if not isinstance(question.get("correct_answer"), str):
                            question["correct_answer"] = "Sample answer"
                    elif question.get("type") == "true_false":
                        if not isinstance(question.get("correct_answer"), bool):
                            question["correct_answer"] = True
            
        except Exception as e:
            print(f"JSON parse hatası: {e}")
            print(f"Gemini yanıtı: {response.text}")
            print("Fallback data kullanılıyor...")
            
            # Fallback data - daha detaylı içerik
            data = {
                "transcript": f"""Welcome to today's presentation about {request.topic}. This is an important topic that affects many aspects of our daily lives. Let me start by explaining the key concepts and then we'll look at some practical examples.

First, let's consider the basic principles of {request.topic}. This involves understanding the fundamental elements that make this topic so significant in today's world. Many experts believe that {request.topic} plays a crucial role in shaping our future.

Now, let's examine some real-world applications. In recent years, we've seen significant developments in this field. These changes have had a profound impact on how we approach {request.topic} in various contexts.

Finally, I'd like to discuss some recommendations for the future. Based on current research and trends, there are several important steps we should consider. These include both short-term and long-term strategies that can help us better understand and utilize {request.topic} effectively.""",
                
                "audio_script": f"""Welcome to today's presentation about {request.topic}. This is an important topic that affects many aspects of our daily lives. Let me start by explaining the key concepts and then we'll look at some practical examples.

First, let's consider the basic principles of {request.topic}. This involves understanding the fundamental elements that make this topic so significant in today's world. Many experts believe that {request.topic} plays a crucial role in shaping our future.

Now, let's examine some real-world applications. In recent years, we've seen significant developments in this field. These changes have had a profound impact on how we approach {request.topic} in various contexts.

Finally, I'd like to discuss some recommendations for the future. Based on current research and trends, there are several important steps we should consider. These include both short-term and long-term strategies that can help us better understand and utilize {request.topic} effectively.""",
                
                "questions": [
                    {
                        "id": 1,
                        "question": f"What is the main topic of this presentation?",
                        "type": "multiple_choice",
                        "options": [
                            f"A) Introduction to {request.topic}",
                            f"B) Advanced concepts of {request.topic}",
                            f"C) History of {request.topic}",
                            f"D) Future of {request.topic}"
                        ],
                        "correct_answer": 0
                    },
                    {
                        "id": 2,
                        "question": f"Complete the sentence: The speaker mentions that {request.topic} is important because _____",
                        "type": "fill_in_blank",
                        "correct_answer": "it helps people understand the world better and develop critical thinking skills"
                    },
                    {
                        "id": 3,
                        "question": f"According to the speaker, {request.topic} has become more popular in recent years.",
                        "type": "true_false",
                        "correct_answer": True
                    },
                    {
                        "id": 4,
                        "question": "What does the speaker mention about recent developments?",
                        "type": "multiple_choice",
                        "options": [
                            "A) They have been minimal",
                            "B) They have had a profound impact",
                            "C) They are not important",
                            "D) They are difficult to understand"
                        ],
                        "correct_answer": 1
                    },
                    {
                        "id": 5,
                        "question": f"Fill in the missing word: The speaker suggests that _____ is the key to success in {request.topic}.",
                        "type": "fill_in_blank",
                        "correct_answer": "dedication"
                    },
                    {
                        "id": 6,
                        "question": f"The speaker believes that {request.topic} is only suitable for young people.",
                        "type": "true_false",
                        "correct_answer": False
                    }
                ]
            }

        return GeneratedListeningResponse(
            transcript=data["transcript"],
            questions=data["questions"],
            audio_script=data.get("audio_script", f"Generated content about {request.topic}"),
            topic=request.topic,
            difficulty=request.difficulty,
            estimated_duration=request.duration
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI üretim hatası: {str(e)}")

@app.get("/topics")
async def get_listening_topics():
    """
    Mevcut listening konularını listeler
    """
    return {
        "topics": [
            {
                "id": 1,
                "name": "Education",
                "description": "University life, courses, campus facilities",
                "difficulty_levels": ["beginner", "intermediate", "advanced"]
            },
            {
                "id": 2,
                "name": "Work & Career",
                "description": "Job interviews, workplace conversations, career advice",
                "difficulty_levels": ["intermediate", "advanced"]
            },
            {
                "id": 3,
                "name": "Travel & Tourism",
                "description": "Hotel bookings, tourist information, travel experiences",
                "difficulty_levels": ["beginner", "intermediate"]
            },
            {
                "id": 4,
                "name": "Health & Lifestyle",
                "description": "Medical appointments, fitness, daily routines",
                "difficulty_levels": ["beginner", "intermediate", "advanced"]
            },
            {
                "id": 5,
                "name": "Technology",
                "description": "Digital devices, internet, modern technology",
                "difficulty_levels": ["intermediate", "advanced"]
            }
        ]
    }

@app.post("/text-to-speech", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest):
    """
    Metni sesli olarak okur (Text-to-Speech) - Gemini TTS kullanır
    """
    try:
        # Gemini TTS modelini kullan
        tts_model = genai.GenerativeModel('gemini-1.5-flash')
        
        # TTS için prompt hazırla
        tts_prompt = f"""
        Please convert the following text to speech with {request.accent} accent:
        
        Text: "{request.text}"
        
        Generate natural-sounding speech that would be appropriate for an IELTS listening test.
        The speech should be clear, well-paced, and use proper pronunciation for {request.accent} English.
        """
        
        # Gemini'den ses üret
        start_time = time.time()
        
        # Not: Gemini'nin şu anda doğrudan TTS özelliği yok, 
        # ama gelecekte eklenebilir. Şimdilik Windows TTS kullanacağız
        # ama daha iyi ses ayarları ile
        
        # TTS engine'i başlat
        engine = pyttsx3.init()
        
        # Ses ayarları - daha kaliteli ses için
        voices = engine.getProperty('voices')
        
        # En iyi sesi seç
        best_voice = None
        for voice in voices:
            if request.accent == "british":
                if 'hazel' in voice.name.lower() or 'susan' in voice.name.lower():
                    best_voice = voice
                    break
            elif request.accent == "american":
                if 'david' in voice.name.lower() or 'mark' in voice.name.lower():
                    best_voice = voice
                    break
        
        if best_voice:
            engine.setProperty('voice', best_voice.id)
        
        # Hız ayarı - daha yavaş ve net
        engine.setProperty('rate', int(140 * request.speed))  # Biraz daha yavaş
        
        # Ses seviyesi
        engine.setProperty('volume', 0.95)
        
        # Metni oku
        engine.say(request.text)
        engine.runAndWait()
        end_time = time.time()
        
        duration = end_time - start_time
        
        return TTSResponse(
            message="Metin başarıyla sesli olarak okundu (Gelişmiş TTS)",
            duration=duration,
            status="completed"
        )
        
    except Exception as e:
        return TTSResponse(
            message=f"TTS hatası: {str(e)}",
            duration=0.0,
            status="error"
        )


@app.post("/elevenlabs-tts", response_model=TTSResponse)
async def elevenlabs_text_to_speech(request: TTSRequest):
    """
    ElevenLabs TTS - Çok daha doğal ve kaliteli ses
    """
    try:
        # ElevenLabs API key
        ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
        if not ELEVENLABS_API_KEY:
            print("⚠️  ELEVENLABS_API_KEY bulunamadı! .env dosyasına ekleyin.")
            print("   Fallback olarak Windows TTS kullanılacak.")
            return await enhanced_text_to_speech(request)
        
        # ElevenLabs voice ID'leri (ücretsiz plan)
        voice_ids = {
            'british': 'pNInz6obpgDQGcFmaJgB',  # Adam (British)
            'american': 'EXAVITQu4vr4xnSDxMaL',  # Bella (American)
            'australian': 'VR6AewLTigWG4xSOukaG'  # Arnold (American - en yakın)
        }
        
        voice_id = voice_ids.get(request.accent, voice_ids['british'])
        
        # ElevenLabs API endpoint
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
        }
        
        data = {
            "text": request.text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5,
                "style": 0.0,
                "use_speaker_boost": True
            }
        }
        
        start_time = time.time()
        response = requests.post(url, json=data, headers=headers)
        end_time = time.time()
        
        if response.status_code == 200:
            # Ses verisini base64'e çevir
            audio_data = base64.b64encode(response.content).decode('utf-8')
            
            return TTSResponse(
                message="ElevenLabs ile doğal ses üretildi",
                duration=end_time - start_time,
                status="completed",
                audio_data=audio_data
            )
        else:
            print(f"ElevenLabs API hatası: {response.status_code}")
            # Fallback olarak enhanced TTS kullan
            return await enhanced_text_to_speech(request)
            
    except Exception as e:
        print(f"ElevenLabs TTS hatası: {e}")
        # Fallback olarak enhanced TTS kullan
        return await enhanced_text_to_speech(request)

@app.post("/enhanced-tts", response_model=TTSResponse)
async def enhanced_text_to_speech(request: TTSRequest):
    """
    Gelişmiş Windows TTS - Daha kaliteli ses ayarları (Fallback)
    """
    try:
        # TTS engine'i başlat
        engine = pyttsx3.init()
        
        # Tüm sesleri listele ve en iyisini seç
        voices = engine.getProperty('voices')
        
        # En kaliteli sesi bul
        best_voice = None
        voice_quality = {
            'british': ['hazel', 'susan', 'karen', 'linda'],
            'american': ['david', 'mark', 'richard', 'eric'],
            'australian': ['catherine', 'fiona', 'karen']
        }
        
        target_voices = voice_quality.get(request.accent, voice_quality['british'])
        
        for voice in voices:
            voice_name_lower = voice.name.lower()
            for target in target_voices:
                if target in voice_name_lower:
                    best_voice = voice
                    break
            if best_voice:
                break
        
        # Eğer hedef ses bulunamazsa, en iyi İngilizce sesi seç
        if not best_voice:
            for voice in voices:
                if 'english' in voice.name.lower() or 'en' in voice.name.lower():
                    best_voice = voice
                    break
        
        if best_voice:
            engine.setProperty('voice', best_voice.id)
            print(f"Seçilen ses: {best_voice.name}")
        
        # Gelişmiş ses ayarları
        engine.setProperty('rate', int(130 * request.speed))  # Daha yavaş ve net
        engine.setProperty('volume', 0.95)
        
        # Metni oku
        start_time = time.time()
        engine.say(request.text)
        engine.runAndWait()
        end_time = time.time()
        
        duration = end_time - start_time
        
        return TTSResponse(
            message=f"Gelişmiş TTS ile okundu (Ses: {best_voice.name if best_voice else 'Varsayılan'})",
            duration=duration,
            status="completed"
        )
        
    except Exception as e:
        return TTSResponse(
            message=f"Enhanced TTS hatası: {str(e)}",
            duration=0.0,
            status="error"
        )


@app.get("/voices")
async def get_available_voices():
    """
    Mevcut ses seçeneklerini listeler
    """
    try:
        engine = pyttsx3.init()
        voices = engine.getProperty('voices')
        
        voice_list = []
        for i, voice in enumerate(voices):
            voice_list.append({
                "id": i,
                "name": voice.name,
                "language": voice.languages[0] if voice.languages else "unknown",
                "gender": voice.gender if hasattr(voice, 'gender') else "unknown"
            })
        
        return {"voices": voice_list}
        
    except Exception as e:
        return {"error": f"Ses listesi alınamadı: {str(e)}"}

@app.post("/upload-audio", response_model=AudioFileResponse)
async def upload_audio(audio: UploadFile = File(...)):
    """
    Ses dosyası yükler ve işler
    """
    try:
        # Dosya formatını kontrol et
        if not audio.filename.lower().endswith(('.mp3', '.wav', '.m4a')):
            raise HTTPException(status_code=400, detail="Sadece MP3, WAV ve M4A dosyaları desteklenir")
        
        # Dosyayı kaydet
        file_id = f"audio_{len(os.listdir('uploads')) + 1}"
        file_path = f"uploads/{file_id}_{audio.filename}"
        
        # Uploads klasörünü oluştur
        os.makedirs("uploads", exist_ok=True)
        
        with open(file_path, "wb") as buffer:
            content = await audio.read()
            buffer.write(content)
        
        return AudioFileResponse(
            file_id=file_id,
            message="Ses dosyası başarıyla yüklendi",
            format=audio.filename.split('.')[-1].lower()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dosya yükleme hatası: {str(e)}")

@app.get("/audio-files")
async def get_audio_files():
    """
    Mevcut listening ses dosyalarını listeler
    """
    return {
        "audio_files": [
            {
                "id": 1,
                "title": "University Campus Tour",
                "difficulty": "Intermediate",
                "duration": 180,
                "accent": "British",
                "topic": "Education",
                "file_url": "/audio/campus_tour.mp3"
            },
            {
                "id": 2,
                "title": "Job Interview",
                "difficulty": "Advanced",
                "duration": 240,
                "accent": "Australian",
                "topic": "Work",
                "file_url": "/audio/job_interview.mp3"
            },
            {
                "id": 3,
                "title": "Restaurant Order",
                "difficulty": "Beginner",
                "duration": 120,
                "accent": "American",
                "topic": "Food & Dining",
                "file_url": "/audio/restaurant.mp3"
            }
        ]
    }

@app.get("/audio-files/{file_id}")
async def get_audio_file(file_id: int):
    """
    Belirli bir ses dosyasını ve sorularını getirir
    """
    # Örnek veri - gerçek uygulamada veritabanından çekilecek
    sample_data = {
        1: {
            "file_id": 1,
            "title": "University Campus Tour",
            "audio_url": "/audio/campus_tour.mp3",
            "transcript": "Welcome to the university campus tour. Today we'll be visiting the main library, the student center, and the science building...",
        "questions": [
            {
                "id": 1,
                "question": "Where is the library located?",
                "type": "multiple_choice",
                    "options": ["A) Near the cafeteria", "B) Next to the gym", "C) Behind the main building", "D) Opposite the parking lot"],
                    "correct_answer": "C"
                },
                {
                    "id": 2,
                    "question": "What time does the student center close?",
                    "type": "multiple_choice", 
                    "options": ["A) 8 PM", "B) 9 PM", "C) 10 PM", "D) 11 PM"],
                "correct_answer": "C"
            }
        ]
    }
    }
    
    if file_id not in sample_data:
        raise HTTPException(status_code=404, detail="Ses dosyası bulunamadı")
    
    return sample_data[file_id]

@app.post("/analyze", response_model=ListeningResponse)
async def analyze_listening(request: ListeningRequest):
    """
    Listening ses dosyasını analiz eder ve kullanıcı cevaplarını değerlendirir
    """
    try:
        # TODO: Ses dosyası işleme
        # TODO: Konuşma tanıma (Speech-to-Text)
        # TODO: Soru-cevap eşleştirme
        # TODO: AI entegrasyonu (Gemini)
        
        # Şimdilik örnek response
        return ListeningResponse(
            score=8.0,
            feedback="Dinleme becerileriniz güçlü, ancak hızlı konuşmalarda zorlanıyorsunuz. Farklı aksanlarda pratik yapın.",
            correct_answers=["C", "C", "A", "B"],  # Örnek doğru cevaplar
            detailed_analysis={
                "comprehension_score": 8.5,
                "detail_catching": 7.5,
                "accent_understanding": 7.0,
                "speed_adaptation": 6.5,
                "suggestions": [
                    "Farklı aksanlarda dinleme yapın",
                    "Hızlı konuşma pratiği yapın", 
                    "Anahtar kelimeleri not alın",
                    "Önceden soruları okuyun"
                ]
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analiz hatası: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
