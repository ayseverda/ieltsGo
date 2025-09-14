from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uvicorn
from api.auth import router as auth_router
from api.speaking import router as speaking_router

app = FastAPI(title="IELTS Go API Gateway", version="1.0.0")

# Include routers
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(speaking_router, prefix="", tags=["speaking"])

# CORS middleware
# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modül URL'leri
MODULE_URLS = {
    "reading": "http://localhost:8001",
    "writing": "http://localhost:8002", 
    "listening": "http://localhost:8003",
    "speaking": "http://localhost:8005"
}

# API endpoints
@app.get("/")
async def root():
    return {
        "message": "IELTS Go API Gateway'e hoş geldiniz!",
        "modules": {
            "reading": "http://localhost:8001",
            "writing": "http://localhost:8002",
            "listening": "http://localhost:8003", 
            "speaking": "http://localhost:8005"
        }
    }

@app.get("/health")
async def health_check():
    """
    Tüm modüllerin sağlık durumunu kontrol eder
    """
    health_status = {}
    
    async with httpx.AsyncClient() as client:
        for module, url in MODULE_URLS.items():
            try:
                response = await client.get(f"{url}/", timeout=5.0)
                health_status[module] = {
                    "status": "healthy" if response.status_code == 200 else "unhealthy",
                    "url": url
                }
            except Exception as e:
                health_status[module] = {
                    "status": "unhealthy",
                    "url": url,
                    "error": str(e)
                }
    
    return {"health_status": health_status}

@app.post("/api/reading/{endpoint:path}")
async def reading_proxy(endpoint: str, request_data: dict):
    """
    Reading modülüne istekleri yönlendirir
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MODULE_URLS['reading']}/{endpoint}",
                json=request_data,
                timeout=30.0
            )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reading module error: {str(e)}")

@app.post("/api/writing/{endpoint:path}")
async def writing_proxy(endpoint: str, request_data: dict):
    """
    Writing modülüne istekleri yönlendirir
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MODULE_URLS['writing']}/{endpoint}",
                json=request_data,
                timeout=30.0
            )
            return Response(
                content=response.text,
                status_code=response.status_code,
                media_type=response.headers.get("content-type", "application/json")
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Writing module error: {str(e)}")

@app.get("/api/writing/{endpoint:path}")
async def writing_proxy_get(endpoint: str):
    """
    Writing modülüne GET isteklerini yönlendirir (ör: /topic)
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MODULE_URLS['writing']}/{endpoint}",
                timeout=30.0
            )
            return Response(
                content=response.text,
                status_code=response.status_code,
                media_type=response.headers.get("content-type", "application/json")
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Writing module error: {str(e)}")

@app.post("/api/listening/{endpoint:path}")
async def listening_proxy(endpoint: str, request_data: dict):
    """
    Listening modülüne istekleri yönlendirir
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MODULE_URLS['listening']}/{endpoint}",
                json=request_data,
                timeout=30.0
            )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Listening module error: {str(e)}")

@app.post("/api/speaking/{endpoint:path}")
async def speaking_proxy(endpoint: str, request_data: dict):
    """
    Speaking modülüne istekleri yönlendirir
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MODULE_URLS['speaking']}/{endpoint}",
                json=request_data,
                timeout=30.0
            )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speaking module error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
