from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
