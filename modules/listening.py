from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import Response
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

# API Keys - Direkt hardcode
GEMINI_API_KEY = "AIzaSyCYeBOoGsW1du63HlKZ7W0AtknImO9Y1fo"  # Gemini API Key
ELEVENLABS_API_KEY = "sk_f9fb41089e1f4d279108e5bbcaa019f5a95ed0ad40d560be"  # ElevenLabs API Key - https://elevenlabs.io

# Gemini API'yi yapılandır
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

app = FastAPI(title="IELTS Listening Module API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
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

class GenerateIELTSListeningRequest(BaseModel):
    topic: str
    difficulty: str = "intermediate"  # beginner, intermediate, advanced
    accent: str = "british"  # british, american, australian

class GeneratedListeningResponse(BaseModel):
    transcript: str
    questions: List[dict]
    audio_script: str
    topic: str
    difficulty: str
    estimated_duration: int

class IELTSListeningSection(BaseModel):
    id: int
    title: str
    description: str
    audio_script: str
    questions: List[dict]
    duration: int  # dakika

class IELTSListeningResponse(BaseModel):
    sections: List[IELTSListeningSection]
    total_questions: int
    total_duration: int  # dakika
    topic: str
    difficulty: str
    instructions: str

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

@app.post("/generate-ielts-listening", response_model=IELTSListeningResponse)
async def generate_ielts_listening(request: GenerateIELTSListeningRequest):
    """
    Gerçek IELTS Listening formatında 4 bölüm, 40 soru üretir
    """
    try:
        # IELTS Listening formatı için prompt
        prompt = f"""
        Create a complete IELTS Listening test about {request.topic} at {request.difficulty} level.
        
        Generate 4 sections with exactly 40 questions total (10 questions per section):
        
        Section 1: Social context (conversation between 2 people) - 10 questions
        Section 2: Social context (monologue) - 10 questions  
        Section 3: Educational context (conversation between 2-4 people) - 10 questions
        Section 4: Academic context (monologue/lecture) - 10 questions
        
        Each section should have realistic IELTS question types:
        - Multiple choice (A, B, C, D)
        - Fill in the blank (1-3 words)
        - Form completion
        - Note completion
        - Sentence completion
        - True/False/Not Given
        - Matching
        
        Return ONLY this JSON format (no other text):
        {{
            "sections": [
                {{
                    "id": 1,
                    "title": "Section 1: Social Conversation",
                    "description": "A conversation between two people about {request.topic}",
                    "audio_script": "Realistic conversation script (200-300 words) about {request.topic}",
                    "questions": [
                        {{
                            "id": 1,
                            "question": "What is the main topic of the conversation?",
                            "type": "multiple_choice",
                            "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
                            "correct_answer": 0
                        }},
                        {{
                            "id": 2,
                            "question": "Complete the sentence: The speaker mentions that _____ is important.",
                            "type": "fill_in_blank",
                            "correct_answer": "education",
                            "word_limit": 2
                        }}
                    ],
                    "duration": 7
                }},
                {{
                    "id": 2,
                    "title": "Section 2: Social Monologue",
                    "description": "A monologue about {request.topic}",
                    "audio_script": "Realistic monologue script (200-300 words) about {request.topic}",
                    "questions": [
                        {{
                            "id": 11,
                            "question": "According to the speaker, what is the main benefit?",
                            "type": "multiple_choice",
                            "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
                            "correct_answer": 1
                        }}
                    ],
                    "duration": 8
                }},
                {{
                    "id": 3,
                    "title": "Section 3: Educational Discussion",
                    "description": "A discussion about {request.topic} in educational context",
                    "audio_script": "Realistic educational discussion script (250-350 words) about {request.topic}",
                    "questions": [
                        {{
                            "id": 21,
                            "question": "What does the professor recommend?",
                            "type": "multiple_choice",
                            "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
                            "correct_answer": 2
                        }}
                    ],
                    "duration": 8
                }},
                {{
                    "id": 4,
                    "title": "Section 4: Academic Lecture",
                    "description": "An academic lecture about {request.topic}",
                    "audio_script": "Realistic academic lecture script (300-400 words) about {request.topic}",
                    "questions": [
                        {{
                            "id": 31,
                            "question": "According to the lecture, what is the key finding?",
                            "type": "multiple_choice",
                            "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
                            "correct_answer": 3
                        }}
                    ],
                    "duration": 7
                }}
            ],
            "total_questions": 40,
            "total_duration": 30,
            "topic": "{request.topic}",
            "difficulty": "{request.difficulty}",
            "instructions": "You will hear a number of different recordings and you will have to answer questions on what you hear. There will be time for you to read the instructions and questions and you will have a chance to check your work. All the recordings will be played once only. The test is in 4 sections. At the end of the test you will be given 10 minutes to transfer your answers to an answer sheet."
        }}
        
        IMPORTANT: 
        - Return ONLY the JSON object, no explanations
        - Each section must have exactly 10 questions
        - Use realistic IELTS question types
        - Audio scripts should be natural and conversational
        - Questions should test listening comprehension, not reading
        - Make sure all correct_answer values match the question types
        """

        response = model.generate_content(prompt)
        
        # JSON'u parse et
        import json
        import re
        
        try:
            response_text = response.text.strip()
            json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
            if json_match:
                json_text = json_match.group(1)
            else:
                json_text = response_text
            
            data = json.loads(json_text)
            
        except Exception as e:
            print(f"JSON parse hatası: {e}")
            print(f"Gemini yanıtı: {response.text}")
            print("Fallback IELTS data kullanılıyor...")
            
            # Fallback IELTS data
            data = {
                "sections": [
                    {
                        "id": 1,
                        "title": "Section 1: Social Conversation",
                        "description": f"A conversation between two people about {request.topic}",
                        "audio_script": f"Hello, welcome to our information session about {request.topic}. I'm Sarah and this is my colleague Mark. Today we'll be discussing the main aspects of {request.topic} and how it affects our daily lives. Let me start by explaining the basic concepts and then Mark will share some practical examples from his experience.",
                        "questions": [
                            {
                                "id": 1,
                                "question": "What is the main topic of this conversation?",
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
                                "question": f"Complete the sentence: The speakers will discuss _____ aspects of {request.topic}.",
                                "type": "fill_in_blank",
                                "correct_answer": "main",
                                "word_limit": 1
                            },
                            {
                                "id": 3,
                                "question": "Who will share practical examples?",
                                "type": "multiple_choice",
                                "options": ["A) Sarah", "B) Mark", "C) Both speakers", "D) Neither speaker"],
                                "correct_answer": 1
                            },
                            {
                                "id": 4,
                                "question": f"Complete the form: Topic: {request.topic}, Speaker 1: _____, Speaker 2: _____",
                                "type": "form_completion",
                                "correct_answer": "Sarah, Mark",
                                "word_limit": 2
                            },
                            {
                                "id": 5,
                                "question": "The conversation is part of an information session.",
                                "type": "true_false",
                                "correct_answer": True
                            },
                            {
                                "id": 6,
                                "question": "What will be discussed first?",
                                "type": "multiple_choice",
                                "options": ["A) Practical examples", "B) Basic concepts", "C) Advanced topics", "D) Future plans"],
                                "correct_answer": 1
                            },
                            {
                                "id": 7,
                                "question": f"Complete the note: {request.topic} affects our _____ lives.",
                                "type": "note_completion",
                                "correct_answer": "daily",
                                "word_limit": 1
                            },
                            {
                                "id": 8,
                                "question": "How many speakers are there?",
                                "type": "multiple_choice",
                                "options": ["A) One", "B) Two", "C) Three", "D) Four"],
                                "correct_answer": 1
                            },
                            {
                                "id": 9,
                                "question": f"Complete the sentence: Mark will share examples from his _____.",
                                "type": "sentence_completion",
                                "correct_answer": "experience",
                                "word_limit": 1
                            },
                            {
                                "id": 10,
                                "question": "The session is about advanced topics only.",
                                "type": "true_false",
                                "correct_answer": False
                            }
                        ],
                        "duration": 7
                    },
                    {
                        "id": 2,
                        "title": "Section 2: Social Monologue",
                        "description": f"A monologue about {request.topic}",
                        "audio_script": f"Good morning everyone. Today I'd like to talk about {request.topic} and its importance in modern society. This topic has become increasingly relevant over the past decade, and I believe it's essential for everyone to understand its implications. Let me share some key insights and practical advice that you can apply in your daily life.",
                        "questions": [
                            {
                                "id": 11,
                                "question": "What is the main focus of this talk?",
                                "type": "multiple_choice",
                                "options": [
                                    f"A) History of {request.topic}",
                                    f"B) Importance of {request.topic}",
                                    f"C) Problems with {request.topic}",
                                    f"D) Future of {request.topic}"
                                ],
                                "correct_answer": 1
                            },
                            {
                                "id": 12,
                                "question": f"Complete the sentence: {request.topic} has become _____ relevant.",
                                "type": "fill_in_blank",
                                "correct_answer": "increasingly",
                                "word_limit": 1
                            },
                            {
                                "id": 13,
                                "question": "How long has this topic been relevant?",
                                "type": "multiple_choice",
                                "options": ["A) 5 years", "B) 10 years", "C) 15 years", "D) 20 years"],
                                "correct_answer": 1
                            },
                            {
                                "id": 14,
                                "question": "What will the speaker share?",
                                "type": "multiple_choice",
                                "options": ["A) Only problems", "B) Only solutions", "C) Key insights and advice", "D) Historical facts"],
                                "correct_answer": 2
                            },
                            {
                                "id": 15,
                                "question": f"Complete the note: Topic: {request.topic}, Focus: _____ in modern society",
                                "type": "note_completion",
                                "correct_answer": "importance",
                                "word_limit": 1
                            },
                            {
                                "id": 16,
                                "question": "The speaker believes this topic is essential for everyone.",
                                "type": "true_false",
                                "correct_answer": True
                            },
                            {
                                "id": 17,
                                "question": "What can listeners apply?",
                                "type": "multiple_choice",
                                "options": ["A) Only theory", "B) Only practice", "C) Practical advice", "D) Historical knowledge"],
                                "correct_answer": 2
                            },
                            {
                                "id": 18,
                                "question": f"Complete the sentence: The advice can be applied in _____ life.",
                                "type": "sentence_completion",
                                "correct_answer": "daily",
                                "word_limit": 1
                            },
                            {
                                "id": 19,
                                "question": "When is this talk taking place?",
                                "type": "multiple_choice",
                                "options": ["A) Afternoon", "B) Evening", "C) Morning", "D) Night"],
                                "correct_answer": 2
                            },
                            {
                                "id": 20,
                                "question": "The speaker will only discuss theoretical concepts.",
                                "type": "true_false",
                                "correct_answer": False
                            }
                        ],
                        "duration": 8
                    },
                    {
                        "id": 3,
                        "title": "Section 3: Educational Discussion",
                        "description": f"A discussion about {request.topic} in educational context",
                        "audio_script": f"Professor: Welcome to today's seminar on {request.topic}. I'm Professor Johnson and I'm joined by my research assistant, Emma. Today we'll be exploring the educational aspects of {request.topic} and how it's being taught in universities. Emma, could you start by sharing your research findings? Emma: Thank you, Professor. My research shows that students are increasingly interested in {request.topic}, particularly in how it relates to their future careers. I've found that practical applications are more effective than theoretical approaches.",
                        "questions": [
                            {
                                "id": 21,
                                "question": "What is the context of this discussion?",
                                "type": "multiple_choice",
                                "options": [
                                    f"A) Business meeting about {request.topic}",
                                    f"B) Educational seminar about {request.topic}",
                                    f"C) Social gathering about {request.topic}",
                                    f"D) Medical consultation about {request.topic}"
                                ],
                                "correct_answer": 1
                            },
                            {
                                "id": 22,
                                "question": "Who is Professor Johnson?",
                                "type": "multiple_choice",
                                "options": ["A) Student", "B) Research assistant", "C) Professor", "D) Visitor"],
                                "correct_answer": 2
                            },
                            {
                                "id": 23,
                                "question": f"Complete the sentence: Students are _____ interested in {request.topic}.",
                                "type": "fill_in_blank",
                                "correct_answer": "increasingly",
                                "word_limit": 1
                            },
                            {
                                "id": 24,
                                "question": "What does Emma research?",
                                "type": "multiple_choice",
                                "options": ["A) History", "B) Science", "C) Educational aspects", "D) Technology"],
                                "correct_answer": 2
                            },
                            {
                                "id": 25,
                                "question": f"Complete the note: Research focus: How {request.topic} relates to _____ careers",
                                "type": "note_completion",
                                "correct_answer": "future",
                                "word_limit": 1
                            },
                            {
                                "id": 26,
                                "question": "Emma is a student.",
                                "type": "true_false",
                                "correct_answer": False
                            },
                            {
                                "id": 27,
                                "question": "What does Emma find more effective?",
                                "type": "multiple_choice",
                                "options": ["A) Theoretical approaches", "B) Practical applications", "C) Both equally", "D) Neither approach"],
                                "correct_answer": 1
                            },
                            {
                                "id": 28,
                                "question": f"Complete the sentence: The seminar explores _____ aspects of {request.topic}.",
                                "type": "sentence_completion",
                                "correct_answer": "educational",
                                "word_limit": 1
                            },
                            {
                                "id": 29,
                                "question": "How many people are speaking?",
                                "type": "multiple_choice",
                                "options": ["A) One", "B) Two", "C) Three", "D) Four"],
                                "correct_answer": 1
                            },
                            {
                                "id": 30,
                                "question": "The discussion is about teaching methods only.",
                                "type": "true_false",
                                "correct_answer": False
                            }
                        ],
                        "duration": 8
                    },
                    {
                        "id": 4,
                        "title": "Section 4: Academic Lecture",
                        "description": f"An academic lecture about {request.topic}",
                        "audio_script": f"Today's lecture focuses on the academic research surrounding {request.topic}. This is a complex field that has evolved significantly over the past two decades. Recent studies have shown that {request.topic} plays a crucial role in various academic disciplines. The research methodology has become more sophisticated, and we now have access to data that was previously unavailable. This has led to new insights and a better understanding of the fundamental principles underlying {request.topic}.",
                        "questions": [
                            {
                                "id": 31,
                                "question": "What is the main topic of this lecture?",
                                "type": "multiple_choice",
                                "options": [
                                    f"A) History of {request.topic}",
                                    f"B) Academic research about {request.topic}",
                                    f"C) Problems with {request.topic}",
                                    f"D) Future predictions about {request.topic}"
                                ],
                                "correct_answer": 1
                            },
                            {
                                "id": 32,
                                "question": f"Complete the sentence: {request.topic} has evolved _____ over the past two decades.",
                                "type": "fill_in_blank",
                                "correct_answer": "significantly",
                                "word_limit": 1
                            },
                            {
                                "id": 33,
                                "question": "How long has this field been evolving?",
                                "type": "multiple_choice",
                                "options": ["A) 10 years", "B) 15 years", "C) 20 years", "D) 25 years"],
                                "correct_answer": 2
                            },
                            {
                                "id": 34,
                                "question": "What do recent studies show?",
                                "type": "multiple_choice",
                                "options": [
                                    f"A) {request.topic} is unimportant",
                                    f"B) {request.topic} plays a crucial role",
                                    f"C) {request.topic} is declining",
                                    f"D) {request.topic} is too complex"
                                ],
                                "correct_answer": 1
                            },
                            {
                                "id": 35,
                                "question": f"Complete the note: Research methodology has become more _____",
                                "type": "note_completion",
                                "correct_answer": "sophisticated",
                                "word_limit": 1
                            },
                            {
                                "id": 36,
                                "question": "The field is simple and easy to understand.",
                                "type": "true_false",
                                "correct_answer": False
                            },
                            {
                                "id": 37,
                                "question": "What do we now have access to?",
                                "type": "multiple_choice",
                                "options": ["A) Old data only", "B) No data", "C) Previously unavailable data", "D) Limited data"],
                                "correct_answer": 2
                            },
                            {
                                "id": 38,
                                "question": f"Complete the sentence: This has led to new _____ and better understanding.",
                                "type": "sentence_completion",
                                "correct_answer": "insights",
                                "word_limit": 1
                            },
                            {
                                "id": 39,
                                "question": "What is the focus of the lecture?",
                                "type": "multiple_choice",
                                "options": ["A) Practical applications", "B) Academic research", "C) Social aspects", "D) Economic factors"],
                                "correct_answer": 1
                            },
                            {
                                "id": 40,
                                "question": "The research has not provided new insights.",
                                "type": "true_false",
                                "correct_answer": False
                            }
                        ],
                        "duration": 7
                    }
                ],
                "total_questions": 40,
                "total_duration": 30,
                "topic": request.topic,
                "difficulty": request.difficulty,
                "instructions": "You will hear a number of different recordings and you will have to answer questions on what you hear. There will be time for you to read the instructions and questions and you will have a chance to check your work. All the recordings will be played once only. The test is in 4 sections. At the end of the test you will be given 10 minutes to transfer your answers to an answer sheet."
            }

        return IELTSListeningResponse(
            sections=[IELTSListeningSection(**section) for section in data["sections"]],
            total_questions=data["total_questions"],
            total_duration=data["total_duration"],
            topic=data["topic"],
            difficulty=data["difficulty"],
            instructions=data["instructions"]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"IELTS Listening üretim hatası: {str(e)}")

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
        # ElevenLabs API key - direkt dosyadan al
        if not ELEVENLABS_API_KEY or ELEVENLABS_API_KEY == "your_elevenlabs_api_key_here":
            print("⚠️  ELEVENLABS_API_KEY ayarlanmamış! listening.py dosyasına ekleyin.")
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

async def elevenlabs_text_to_speech_func(text: str):
    """
    ElevenLabs API kullanarak metni sese çevirir
    """
    try:
        url = "https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
        }
        data = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
            }
        }
        
        response = requests.post(url, json=data, headers=headers)
        if response.status_code == 200:
            return response.content
        else:
            print(f"ElevenLabs API hatası: {response.status_code}")
            return None
    except Exception as e:
        print(f"ElevenLabs TTS hatası: {e}")
        return None

@app.post("/elevenlabs-text-to-speech")
async def elevenlabs_text_to_speech(request: dict):
    """
    ElevenLabs API kullanarak metni sese çevirir
    """
    try:
        text = request.get("text", "")
        voice = request.get("voice", "Adam")
        accent = request.get("accent", "GB English")
        
        if not text:
            raise HTTPException(status_code=400, detail="Metin boş olamaz")
        
        # ElevenLabs API key kontrolü
        if ELEVENLABS_API_KEY == "your_elevenlabs_api_key_here":
            print("ElevenLabs API key ayarlanmamış, fallback TTS kullanılıyor")
            return await enhanced_text_to_speech(text)
        
        # ElevenLabs API ile ses oluştur
        audio_data = await elevenlabs_text_to_speech_func(text)
        
        if audio_data:
            return Response(content=audio_data, media_type="audio/mpeg")
        else:
            print("ElevenLabs TTS başarısız, fallback TTS kullanılıyor")
            # Fallback TTS
            return await enhanced_text_to_speech(text)
            
    except Exception as e:
        print(f"ElevenLabs TTS hatası: {e}")
        # Fallback TTS
        return await enhanced_text_to_speech(request.get("text", ""))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
