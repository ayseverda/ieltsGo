from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
import hashlib
import secrets
import jwt
import os

router = APIRouter()

# MongoDB connection
MONGODB_URI = "mongodb://127.0.0.1:27017"
client = AsyncIOMotorClient(MONGODB_URI)
db = client.ieltsgo

# JWT Secret (in production, use environment variable)
JWT_SECRET = "your-secret-key-here"
JWT_ALGORITHM = "HS256"

# Pydantic models
class UserRegister(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime
    last_login: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Password hashing
def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed_password

# JWT functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/register", response_model=TokenResponse)
async def register_user(user_data: UserRegister):
    """Register a new user"""
    try:
        # Check if user already exists
        existing_user = await db.users.find_one({"email": user_data.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        # Validate password length
        if len(user_data.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        # Create new user
        user_id = secrets.token_hex(16)
        hashed_password = hash_password(user_data.password)
        
        user_doc = {
            "_id": user_id,
            "name": user_data.name,
            "email": user_data.email,
            "password": hashed_password,
            "created_at": datetime.utcnow(),
            "last_login": datetime.utcnow(),
            "is_active": True
        }
        
        # Save user to database
        await db.users.insert_one(user_doc)
        
        # Create user stats
        await create_default_user_stats(user_id)
        
        # Create access token
        access_token = create_access_token(data={"sub": user_id, "email": user_data.email})
        
        # Return user data without password
        user_response = UserResponse(
            id=user_id,
            name=user_data.name,
            email=user_data.email,
            created_at=user_doc["created_at"],
            last_login=user_doc["last_login"]
        )
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/login", response_model=TokenResponse)
async def login_user(login_data: UserLogin):
    """Login user"""
    try:
        # Find user by email
        user = await db.users.find_one({"email": login_data.email})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Verify password
        if not verify_password(login_data.password, user["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Update last login
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        
        # Create access token
        access_token = create_access_token(data={"sub": user["_id"], "email": user["email"]})
        
        # Return user data without password
        user_response = UserResponse(
            id=user["_id"],
            name=user["name"],
            email=user["email"],
            created_at=user["created_at"],
            last_login=datetime.utcnow()
        )
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@router.get("/me", response_model=UserResponse)
async def get_current_user(token: str = Depends(lambda: None)):
    """Get current user info"""
    try:
        if not token:
            raise HTTPException(status_code=401, detail="No token provided")
        
        # Verify token
        payload = verify_token(token)
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get user from database
        user = await db.users.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Return user data without password
        return UserResponse(
            id=user["_id"],
            name=user["name"],
            email=user["email"],
            created_at=user["created_at"],
            last_login=user["last_login"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user info: {str(e)}")

async def create_default_user_stats(user_id: str):
    """Create default statistics for a new user"""
    stats_doc = {
        "user_id": user_id,
        "listening": {
            "total_tests": 0,
            "average_score": 0.0,
            "best_score": 0.0,
            "total_time": 0,
            "last_test": None
        },
        "reading": {
            "total_tests": 0,
            "average_score": 0.0,
            "best_score": 0.0,
            "total_time": 0,
            "last_test": None
        },
        "writing": {
            "total_essays": 0,
            "average_score": 0.0,
            "best_score": 0.0,
            "total_time": 0,
            "last_essay": None
        },
        "speaking": {
            "total_sessions": 0,
            "average_score": 0.0,
            "best_score": 0.0,
            "total_time": 0,
            "last_session": None
        },
        "overall": {
            "total_tests": 0,
            "ielts_band_score": 0.0,
            "improvement_rate": 0.0,
            "streak": 0
        },
        "updated_at": datetime.utcnow()
    }
    
    await db.user_stats.insert_one(stats_doc)
