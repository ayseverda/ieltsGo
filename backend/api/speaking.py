from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import re
import json
from collections import Counter
import httpx

router = APIRouter()

# Pydantic models
class MessageCreate(BaseModel):
    topicId: str
    topicTitle: str
    message: str

class GrammarError(BaseModel):
    error: str
    suggestion: str
    position: int

class Analysis(BaseModel):
    grammarErrors: List[GrammarError]
    vocabularyLevel: str
    sentenceStructure: str
    wordCount: int
    complexityScore: int
    overallScore: int
    improvements: List[str]

class MessageAnalysis(BaseModel):
    id: str
    userId: str
    topicId: str
    topicTitle: str
    message: str
    timestamp: datetime
    analysis: Analysis

class TopicStats(BaseModel):
    topicId: str
    topicTitle: str
    messageCount: int
    averageScore: float
    commonErrors: List[str]
    icon: str

# Mock database - gerçek uygulamada MongoDB kullanılacak
mock_messages_db = []
mock_users_db = {"user123": {"id": "user123", "name": "Test User"}}

# Initialize with some test data
def initialize_test_data():
    """Initialize mock database with test data"""
    if len(mock_messages_db) == 0:  # Only add if empty
        test_messages = [
            {
                "id": "msg_1",
                "userId": "user123",
                "topicId": "health",
                "topicTitle": "Health & Lifestyle",
                "message": "I eating egg every morning",
                "timestamp": "2025-09-14T10:00:00",
                "analysis": {
                    "grammarErrors": [
                        {
                            "error": "Verb tense error",
                            "suggestion": "'I eat eggs every morning' olmalı",
                            "position": 0
                        }
                    ],
                    "vocabularyLevel": "beginner",
                    "sentenceStructure": "simple",
                    "wordCount": 5,
                    "complexityScore": 25,
                    "overallScore": 75,
                    "improvements": [
                        "Present tense kullanımına dikkat edin",
                        "Daha uzun ve detaylı cümleler kurmaya çalışın"
                    ]
                }
            },
            {
                "id": "msg_2",
                "userId": "user123",
                "topicId": "education",
                "topicTitle": "Eğitim ve Öğrenme",
                "message": "I think education is very important for everyone. We should always try to learn new things because knowledge is power.",
                "timestamp": "2025-09-14T10:05:00",
                "analysis": {
                    "grammarErrors": [],
                    "vocabularyLevel": "intermediate",
                    "sentenceStructure": "complex",
                    "wordCount": 18,
                    "complexityScore": 75,
                    "overallScore": 95,
                    "improvements": []
                }
            },
            {
                "id": "msg_3",
                "userId": "user123",
                "topicId": "technology",
                "topicTitle": "Teknoloji ve Gelecek",
                "message": "Technology changes our lives. I dont know how we lived without smartphones before.",
                "timestamp": "2025-09-14T10:10:00",
                "analysis": {
                    "grammarErrors": [
                        {
                            "error": "Kesme işareti eksik",
                            "suggestion": "'don't' şeklinde yazılmalıdır",
                            "position": 29
                        }
                    ],
                    "vocabularyLevel": "intermediate",
                    "sentenceStructure": "compound",
                    "wordCount": 14,
                    "complexityScore": 60,
                    "overallScore": 85,
                    "improvements": [
                        "Kesme işaretlerine dikkat edin"
                    ]
                }
            }
        ]
        mock_messages_db.extend(test_messages)

# Initialize test data when module loads
initialize_test_data()

def analyze_message(message: str) -> Analysis:
    """Mesajı analiz eder ve Analysis nesnesi döndürür"""
    
    # Kelime sayısı
    word_count = len(message.split())
    
    # Gelişmiş gramer hata tespiti
    grammar_errors = []
    message_lower = message.lower()
    
    # 1. Kesme işareti hataları
    if re.search(r'\bdont\b', message_lower):
        grammar_errors.append(GrammarError(
            error="Kesme işareti eksik: dont",
            suggestion="'don't' şeklinde yazılmalıdır",
            position=message_lower.find('dont')
        ))
    
    if re.search(r'\bcant\b', message_lower):
        grammar_errors.append(GrammarError(
            error="Kesme işareti eksik: cant",
            suggestion="'can't' şeklinde yazılmalıdır",
            position=message_lower.find('cant')
        ))
    
    if re.search(r'\bwont\b', message_lower):
        grammar_errors.append(GrammarError(
            error="Kesme işareti eksik: wont",
            suggestion="'won't' şeklinde yazılmalıdır",
            position=message_lower.find('wont')
        ))
    
    if re.search(r'\bisnt\b', message_lower):
        grammar_errors.append(GrammarError(
            error="Kesme işareti eksik: isnt",
            suggestion="'isn't' şeklinde yazılmalıdır",
            position=message_lower.find('isnt')
        ))
    
    # 2. Subject-Verb Agreement hataları
    if re.search(r'\bi eating\b', message_lower):
        grammar_errors.append(GrammarError(
            error="Yanlış verb formu: I eating",
            suggestion="'I am eating' veya 'I eat' olmalıdır",
            position=message_lower.find('i eating')
        ))
    
    if re.search(r'\bhe/she/it eat\b', message_lower):
        grammar_errors.append(GrammarError(
            error="3. tekil şahıs verb hatası",
            suggestion="'eats' olmalıdır",
            position=message_lower.find('eat')
        ))
    
    # 3. Article hataları
    if re.search(r'\ba apple\b', message_lower):
        grammar_errors.append(GrammarError(
            error="Yanlış article: a apple",
            suggestion="'an apple' olmalıdır",
            position=message_lower.find('a apple')
        ))
    
    if re.search(r'\ba egg\b', message_lower):
        grammar_errors.append(GrammarError(
            error="Yanlış article: a egg",
            suggestion="'an egg' olmalıdır",
            position=message_lower.find('a egg')
        ))
    
    # 4. Preposition hataları
    if re.search(r'\bin the morning\b', message_lower) and 'every morning' not in message_lower:
        # Bu aslında doğru, sadece örnek
        pass
    
    # 5. Tense hataları
    if re.search(r'\bi go yesterday\b', message_lower):
        grammar_errors.append(GrammarError(
            error="Tense hatası: I go yesterday",
            suggestion="'I went yesterday' olmalıdır",
            position=message_lower.find('i go yesterday')
        ))
    
    # 6. Büyük harf hataları
    if re.search(r'(?:^|\.\s+)[a-z]', message):
        grammar_errors.append(GrammarError(
            error="Cümle başında küçük harf",
            suggestion="Cümle büyük harfle başlamalıdır",
            position=0
        ))
    
    # 7. Tekil/çoğul hataları
    if re.search(r'\bmany egg\b', message_lower):
        grammar_errors.append(GrammarError(
            error="Tekil/çoğul hatası: many egg",
            suggestion="'many eggs' olmalıdır",
            position=message_lower.find('many egg')
        ))
    
    # 8. Modal verb hataları
    if re.search(r'\bcan to\b', message_lower):
        grammar_errors.append(GrammarError(
            error="Modal verb hatası: can to",
            suggestion="'can' veya 'to' kullanın, ikisini birlikte değil",
            position=message_lower.find('can to')
        ))
    
    # 9. Word order hataları
    if re.search(r'\bevery morning i\b', message_lower):
        grammar_errors.append(GrammarError(
            error="Kelime sırası hatası",
            suggestion="'I ... every morning' daha doğal olur",
            position=message_lower.find('every morning i')
        ))
    
    # Kelime düzeyi analizi (basit)
    advanced_words = ['consequently', 'furthermore', 'nevertheless', 'sophisticated', 'comprehensive']
    intermediate_words = ['however', 'therefore', 'although', 'regarding', 'consider']
    
    vocabulary_level = "beginner"
    if any(word in message.lower() for word in advanced_words):
        vocabulary_level = "advanced"
    elif any(word in message.lower() for word in intermediate_words):
        vocabulary_level = "intermediate"
    
    # Cümle yapısı analizi
    sentence_structure = "simple"
    if len(message.split('.')) > 2 or 'because' in message.lower() or 'although' in message.lower():
        sentence_structure = "complex"
    elif 'and' in message.lower() or 'but' in message.lower():
        sentence_structure = "compound"
    
    # Karmaşıklık skoru
    complexity_score = min(100, (word_count * 2) + (len(set(message.lower().split())) * 3))
    if vocabulary_level == "advanced":
        complexity_score += 20
    elif vocabulary_level == "intermediate":
        complexity_score += 10
    
    # Genel skor hesaplama
    overall_score = 100 - (len(grammar_errors) * 15)  # Her hata için -15 puan
    if vocabulary_level == "advanced":
        overall_score += 10
    elif vocabulary_level == "intermediate":
        overall_score += 5
    
    if sentence_structure == "complex":
        overall_score += 10
    elif sentence_structure == "compound":
        overall_score += 5
    
    overall_score = max(0, min(100, overall_score))
    
    # Gelişim önerileri
    improvements = []
    if len(grammar_errors) > 0:
        improvements.append("Gramer kurallarına dikkat edin ve cümlelerinizi kontrol edin")
    if word_count < 10:
        improvements.append("Daha uzun ve detaylı cümleler kurmaya çalışın")
    if vocabulary_level == "beginner":
        improvements.append("Kelime dağarcığınızı geliştirmek için daha fazla okuma yapın")
    if sentence_structure == "simple":
        improvements.append("Bağlaçlar kullanarak daha karmaşık cümle yapıları oluşturun")
    
    return Analysis(
        grammarErrors=grammar_errors,
        vocabularyLevel=vocabulary_level,
        sentenceStructure=sentence_structure,
        wordCount=word_count,
        complexityScore=complexity_score,
        overallScore=overall_score,
        improvements=improvements
    )

@router.post("/api/speaking/save-message")
async def save_message(message_data: MessageCreate):
    """Kullanıcı mesajını analiz ederek veritabanına kaydeder"""
    try:
        # Mesajı analiz et
        analysis = analyze_message(message_data.message)
        
        # Yeni mesaj objesi oluştur
        new_message = {
            "id": f"msg_{len(mock_messages_db) + 1}",
            "userId": "user123",  # Gerçek uygulamada JWT'den gelecek
            "topicId": message_data.topicId,
            "topicTitle": message_data.topicTitle,
            "message": message_data.message,
            "timestamp": datetime.now(),
            "analysis": analysis.dict()
        }
        
        # Mock veritabanına ekle
        mock_messages_db.append(new_message)
        
        return JSONResponse(
            status_code=201,
            content={
                "success": True,
                "message": "Mesaj başarıyla kaydedildi ve analiz edildi",
                "analysis": analysis.dict()
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mesaj kaydedilirken hata: {str(e)}")

@router.get("/api/speaking/user-messages")
async def get_user_messages(userId: str = "user123"):
    """Kullanıcının tüm mesajlarını analiz bilgileriyle döndürür"""
    try:
        user_messages = [msg for msg in mock_messages_db if msg["userId"] == userId]
        
        # Timestamp'leri string'e çevir (JSON serializasyon için)
        for msg in user_messages:
            if isinstance(msg["timestamp"], datetime):
                msg["timestamp"] = msg["timestamp"].isoformat()
        
        return JSONResponse(
            status_code=200,
            content=user_messages
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mesajlar yüklenirken hata: {str(e)}")

@router.get("/api/speaking/topic-stats")
async def get_topic_stats(userId: str = "user123"):
    """Kullanıcının konu bazlı istatistiklerini döndürür"""
    try:
        user_messages = [msg for msg in mock_messages_db if msg["userId"] == userId]
        
        if not user_messages:
            return JSONResponse(status_code=200, content=[])
        
        # Konu bazlı gruplama
        topic_groups = {}
        for msg in user_messages:
            topic_id = msg["topicId"]
            if topic_id not in topic_groups:
                topic_groups[topic_id] = {
                    "topicId": topic_id,
                    "topicTitle": msg["topicTitle"],
                    "messages": [],
                    "scores": [],
                    "errors": []
                }
            
            topic_groups[topic_id]["messages"].append(msg)
            topic_groups[topic_id]["scores"].append(msg["analysis"]["overallScore"])
            
            # Hataları topla
            for error in msg["analysis"]["grammarErrors"]:
                topic_groups[topic_id]["errors"].append(error["error"])
        
        # İstatistikleri hesapla
        stats = []
        topic_icons = {
            "education": "🎓",
            "technology": "💻", 
            "environment": "🌱",
            "health": "🏥",
            "travel": "✈️",
            "work": "💼",
            "family": "👨‍👩‍👧‍👦",
            "hobbies": "🎨",
            "food": "🍽️",
            "sports": "⚽"
        }
        
        for topic_id, data in topic_groups.items():
            # En sık karşılaşılan hataları bul
            error_counter = Counter(data["errors"])
            common_errors = [error for error, count in error_counter.most_common(5)]
            
            stats.append(TopicStats(
                topicId=topic_id,
                topicTitle=data["topicTitle"],
                messageCount=len(data["messages"]),
                averageScore=sum(data["scores"]) / len(data["scores"]) if data["scores"] else 0,
                commonErrors=common_errors,
                icon=topic_icons.get(topic_id.lower(), "💬")
            ))
        
        # Mesaj sayısına göre sırala
        stats.sort(key=lambda x: x.messageCount, reverse=True)
        
        return JSONResponse(
            status_code=200,
            content=[stat.dict() for stat in stats]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"İstatistikler yüklenirken hata: {str(e)}")

# Test verileri ekleme endpoint'i (sadece geliştirme için)
@router.post("/api/speaking/add-test-data")
async def add_test_data():
    """Test verileri ekler"""
    test_messages = [
        {
            "topicId": "health",
            "topicTitle": "Health & Lifestyle", 
            "message": "I eating egg every morning"  # Gramer hatası: I eating
        },
        {
            "topicId": "education",
            "topicTitle": "Eğitim ve Öğrenme",
            "message": "i think education is very important. I dont know why some people ignore it."  # Küçük harf + dont
        },
        {
            "topicId": "technology", 
            "topicTitle": "Teknoloji ve Gelecek",
            "message": "Technology changes our lives. I cant imagine life without smartphones."  # cant hatası
        },
        {
            "topicId": "environment",
            "topicTitle": "Çevre ve Doğa",
            "message": "We need to protect environment for future generations. Global warming is a egg problem."  # a egg hatası
        },
        {
            "topicId": "education",
            "topicTitle": "Eğitim ve Öğrenme", 
            "message": "Online learning became popular during pandemic. however, I still prefer face-to-face education."  # küçük however
        },
        {
            "topicId": "technology",
            "topicTitle": "Teknoloji ve Gelecek",
            "message": "Artificial intelligence will change many job in the future. People should learn new skills."  # many job (tekil)
        }
    ]
    
    for msg_data in test_messages:
        message_create = MessageCreate(**msg_data)
        await save_message(message_create)
    
    return JSONResponse(
        status_code=201,
        content={
            "success": True,
            "message": f"{len(test_messages)} test mesajı eklendi"
        }
    )