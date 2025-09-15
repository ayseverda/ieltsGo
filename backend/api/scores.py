from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient
import jwt
import os

router = APIRouter()

# MongoDB connection
MONGODB_URI = "mongodb://127.0.0.1:27017"
client = AsyncIOMotorClient(MONGODB_URI)
db = client.ieltsgo

# JWT Secret (same as auth.py)
JWT_SECRET = "your-secret-key-here"
JWT_ALGORITHM = "HS256"

# Pydantic models
class ScoreData(BaseModel):
    module: str  # "listening", "reading", "writing", "speaking"
    band_score: float
    raw_score: int
    total_questions: int
    topic: str
    difficulty: str
    accent: Optional[str] = None
    test_date: datetime
    detailed_results: Optional[Dict[str, Any]] = None

class SaveScoreRequest(BaseModel):
    module: str
    band_score: float
    raw_score: int
    total_questions: int
    topic: str
    difficulty: str
    accent: Optional[str] = None
    detailed_results: Optional[Dict[str, Any]] = None

class UserStatsResponse(BaseModel):
    listening: Dict[str, Any]
    reading: Dict[str, Any]
    writing: Dict[str, Any]
    speaking: Dict[str, Any]
    overall: Dict[str, Any]

# JWT Token verification
def verify_token(token: str) -> str:
    """Verify JWT token and return user_id"""
    try:
        print(f"🔍 Token decode ediliyor...")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        print(f"📋 Token payload: {payload}")
        
        # auth.py'de 'sub' field'ı kullanılıyor, 'user_id' değil
        user_id = payload.get("sub") or payload.get("user_id")
        print(f"👤 User ID: {user_id}")
        
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token - no user_id")
        return user_id
    except jwt.ExpiredSignatureError:
        print("⏰ Token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        print(f"❌ Invalid token: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# Dependency to get current user from token
async def get_current_user(authorization: str = Header(None)) -> str:
    print(f"🔐 Authorization header kontrolü: {authorization}")
    
    if not authorization:
        print("❌ Authorization header yok")
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    if not authorization.startswith("Bearer "):
        print("❌ Bearer prefix yok")
        raise HTTPException(status_code=401, detail="Authorization header must start with 'Bearer '")
    
    token = authorization.split(" ")[1]
    print(f"🎫 Token: {token[:20]}...")
    
    try:
        print(f"🔄 verify_token fonksiyonuna gidiliyor...")
        user_id = verify_token(token)
        print(f"✅ Token doğrulandı, User ID: {user_id}")
        return user_id
    except HTTPException as e:
        print(f"❌ HTTP Exception: {e.detail}")
        raise
    except Exception as e:
        print(f"❌ Genel hata: {e}")
        raise HTTPException(status_code=401, detail=f"Token doğrulama hatası: {str(e)}")

@router.post("/save-score")
async def save_score(request: SaveScoreRequest, user_id: str = Depends(get_current_user)):
    """
    Kullanıcının test puanını kaydet
    """
    try:
        print(f"🎯 Puan kaydetme isteği alındı:")
        print(f"   User ID: {user_id}")
        print(f"   Module: {request.module}")
        print(f"   Band Score: {request.band_score}")
        print(f"   Topic: {request.topic}")
        
        # Score document oluştur
        score_doc = {
            "user_id": user_id,
            "module": request.module,
            "band_score": request.band_score,
            "raw_score": request.raw_score,
            "total_questions": request.total_questions,
            "topic": request.topic,
            "difficulty": request.difficulty,
            "accent": request.accent,
            "test_date": datetime.now(),
            "detailed_results": request.detailed_results
        }
        
        print(f"📝 Veritabanına kaydediliyor: {score_doc}")
        
        # Veritabanına kaydet
        result = await db.scores.insert_one(score_doc)
        
        print(f"✅ Puan başarıyla kaydedildi. ID: {result.inserted_id}")
        
        return {
            "success": True,
            "message": f"{request.module.title()} puanı kaydedildi",
            "score_id": str(result.inserted_id),
            "user_id": user_id
        }
        
    except Exception as e:
        print(f"❌ Puan kaydetme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Puan kaydetme hatası: {str(e)}")

@router.get("/user-stats", response_model=UserStatsResponse)
async def get_user_stats(user_id: str = Depends(get_current_user)):
    """
    Kullanıcının tüm modül istatistiklerini getir
    """
    try:
        print(f"📊 İstatistik isteği alındı - User ID: {user_id}")
        
        # Tüm puanları getir
        scores_cursor = db.scores.find({"user_id": user_id}).sort("test_date", -1)
        scores = await scores_cursor.to_list(length=None)
        
        print(f"📈 Bulunan puan sayısı: {len(scores)}")
        for score in scores:
            print(f"   - {score['module']}: {score['band_score']} ({score['topic']})")
        
        # Modüllere göre grupla
        module_stats = {}
        for module in ["listening", "reading", "writing", "speaking"]:
            # Reading için hem reading_practice hem reading_full'ü dahil et
            if module == "reading":
                module_scores = [s for s in scores if s["module"] in ["reading", "reading_practice", "reading_full"]]
            else:
                module_scores = [s for s in scores if s["module"] == module]
            
            if module_scores:
                band_scores = [s["band_score"] for s in module_scores]
                module_stats[module] = {
                    "test_count": len(module_scores),
                    "average": round(sum(band_scores) / len(band_scores), 1),
                    "best": round(max(band_scores), 1),
                    "latest": round(module_scores[0]["band_score"], 1),
                    "recent_scores": [round(s["band_score"], 1) for s in module_scores[:5]]  # Son 5 test
                }
            else:
                module_stats[module] = {
                    "test_count": 0,
                    "average": 0.0,
                    "best": 0.0,
                    "latest": 0.0,
                    "recent_scores": []
                }
        
        # Genel istatistikler
        all_band_scores = [s["band_score"] for s in scores]
        if all_band_scores:
            overall_stats = {
                "total_tests": len(scores),
                "average_band": round(sum(all_band_scores) / len(all_band_scores), 1),
                "best_band": round(max(all_band_scores), 1),
                "estimated_ielts": round(sum(all_band_scores) / len(all_band_scores), 1)
            }
        else:
            overall_stats = {
                "total_tests": 0,
                "average_band": 0.0,
                "best_band": 0.0,
                "estimated_ielts": 0.0
            }
        
        return UserStatsResponse(
            listening=module_stats["listening"],
            reading=module_stats["reading"],
            writing=module_stats["writing"],
            speaking=module_stats["speaking"],
            overall=overall_stats
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"İstatistik getirme hatası: {str(e)}")

@router.get("/recent-scores/{module}")
async def get_recent_scores(module: str, user_id: str = Depends(get_current_user)):
    """
    Belirli modül için son 10 test puanını getir
    """
    try:
        scores_cursor = db.scores.find(
            {"user_id": user_id, "module": module}
        ).sort("test_date", -1).limit(10)
        
        scores = await scores_cursor.to_list(length=10)
        
        return {
            "module": module,
            "scores": [
                {
                    "band_score": score["band_score"],
                    "topic": score["topic"],
                    "difficulty": score["difficulty"],
                    "test_date": score["test_date"],
                    "raw_score": score["raw_score"],
                    "total_questions": score["total_questions"]
                }
                for score in scores
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Son puanlar getirme hatası: {str(e)}")

@router.delete("/delete-score/{score_id}")
async def delete_score(score_id: str, user_id: str = Depends(get_current_user)):
    """
    Belirli bir test puanını sil
    """
    try:
        from bson import ObjectId
        
        result = await db.scores.delete_one({
            "_id": ObjectId(score_id),
            "user_id": user_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Puan bulunamadı")
        
        return {"success": True, "message": "Puan silindi"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Puan silme hatası: {str(e)}")

@router.get("/test-connection")
async def test_connection():
    """
    Bağlantı testi - Authentication gerektirmez
    """
    try:
        # Veritabanı bağlantısını test et
        await db.command("ping")
        
        # Tüm puanları say
        total_scores = await db.scores.count_documents({})
        
        return {
            "success": True,
            "message": "Veritabanı bağlantısı başarılı",
            "total_scores": total_scores,
            "database": "ieltsgo",
            "collection": "scores"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Veritabanı bağlantı hatası: {str(e)}",
            "error": str(e)
        }

