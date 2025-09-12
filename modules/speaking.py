import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn
import io
import tempfile
import base64
import json
import requests
import speech_recognition as sr
from pydub import AudioSegment
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import Google Generative AI with error handling
try:
    import google.generativeai as genai
    GOOGLE_AI_AVAILABLE = True
    print("Google Generative AI successfully imported.")
except ImportError as e:
    print(f"Warning: google-generativeai import error: {e}. AI response functionality will be limited.")
    GOOGLE_AI_AVAILABLE = False

app = FastAPI(title="IELTS Speaking Module API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
GOOGLE_AI_API_KEY = os.getenv("GOOGLE_AI_API_KEY", "AIzaSyC2RqFc-JViNGLpEgggguo8WXvC8xCIbjw")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "sk_2071d4401f89225130f1fb87ecb91fdec71daf184fc5cf77")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")  # Default Bella voice

# Initialize Google AI if available
if GOOGLE_AI_AVAILABLE:
    try:
        api_key = GEMINI_API_KEY or GOOGLE_AI_API_KEY
        if not api_key:
            print("⚠️  GEMINI_API_KEY bulunamadı! .env dosyasına ekleyin.")
            print("   Örnek: GEMINI_API_KEY=your_api_key_here")
            GOOGLE_AI_AVAILABLE = False
        else:
            genai.configure(api_key=api_key)
            print(f"Google Generative AI successfully configured with API key.")
    except Exception as e:
        print(f"Error configuring Google Generative AI: {e}")
        GOOGLE_AI_AVAILABLE = False

class SpeechRequest(BaseModel):
    audio_data: str  # Base64 encoded audio
    format: str = "webm"

class TextRequest(BaseModel):
    text: str

class TTSRequest(BaseModel):
    text: str
    voice_id: str = ELEVENLABS_VOICE_ID

# API endpoints
@app.get("/")
async def root():
    return {"message": "Speaking Module API - Geliştirici: GÜLSO", "status": "ready"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "module": "speaking"}

@app.post("/speech-to-text")
async def speech_to_text(request: SpeechRequest):
    """
    Convert speech audio to text using Google Speech Recognition
    """
    try:
        # Validate input
        if not request.audio_data:
            raise HTTPException(status_code=422, detail="Audio data is required")
        
        # Decode base64 audio data
        try:
            audio_data = base64.b64decode(request.audio_data)
        except Exception as e:
            raise HTTPException(status_code=422, detail="Invalid base64 audio data")
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{request.format}") as temp_audio:
            temp_audio.write(audio_data)
            temp_audio_path = temp_audio.name
        
        try:
            # Convert to WAV if not already
            if request.format != "wav":
                try:
                    print(f"Converting {request.format} to WAV format...")
                    audio = AudioSegment.from_file(temp_audio_path, format=request.format)
                    wav_path = temp_audio_path.replace(f".{request.format}", ".wav")
                    audio.export(wav_path, format="wav")
                    os.unlink(temp_audio_path)
                    temp_audio_path = wav_path
                    print(f"Converted to WAV: {temp_audio_path}")
                except Exception as e:
                    print(f"Error converting audio: {str(e)}")
                    raise HTTPException(status_code=500, detail=f"Error converting audio: {str(e)}")
            
            # Use speech recognition with adjusted settings
            recognizer = sr.Recognizer()
            recognizer.energy_threshold = 300  # Lower threshold for detecting speech
            recognizer.dynamic_energy_threshold = True
            recognizer.pause_threshold = 0.8  # Shorter pause threshold
            
            print(f"Processing audio file: {temp_audio_path}")
            
            with sr.AudioFile(temp_audio_path) as source:
                print("Adjusting for ambient noise...")
                recognizer.adjust_for_ambient_noise(source, duration=0.5)
                print("Recording audio data...")
                audio_data = recognizer.record(source)
                print(f"Audio duration: approximately {len(audio_data.frame_data) / (audio_data.sample_rate * audio_data.sample_width)} seconds")
                
                print("Recognizing speech...")
                text = ""
                try:
                    text = recognizer.recognize_google(audio_data, language='en-US')
                    print(f"Recognized text: {text}")
                except sr.UnknownValueError:
                    print("Could not understand audio - no speech detected")
                    raise HTTPException(status_code=422, detail="Could not understand audio - please speak clearly")
                except sr.RequestError as e:
                    print(f"Could not request results from Google Speech Recognition service: {e}")
                    raise HTTPException(status_code=500, detail=f"Speech recognition service error: {str(e)}")
            
            # Validate that we got some text
            if not text or text.strip() == "":
                raise HTTPException(status_code=422, detail="No speech detected in audio")
            
            return {"text": text, "success": True}
            
        finally:
            # Cleanup temporary file
            if os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)
                
    except HTTPException:
        raise
    except sr.UnknownValueError:
        raise HTTPException(status_code=422, detail="Could not understand audio - please speak clearly")
    except sr.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Speech recognition service error: {str(e)}")
    except Exception as e:
        print(f"Speech to Text Error: {str(e)}")  # Log for debugging
        raise HTTPException(status_code=500, detail=f"Speech to text error: {str(e)}")

@app.post("/ai-response")
async def get_ai_response(request: TextRequest):
    """
    Get AI response for English learning conversation
    """
    try:
        # Validate input
        if not request.text or request.text.strip() == "":
            raise HTTPException(status_code=422, detail="Text input is required and cannot be empty")
        
        # Try to use Google AI if available
        if GOOGLE_AI_AVAILABLE:
            try:
                print(f"Using Google Generative AI to respond to: '{request.text}'")
                
                # Create the prompt for English learning conversation
                prompt = f"""
                You are an English conversation partner for IELTS speaking practice. The student said: "{request.text}"
                
                Please respond as a helpful English tutor would:
                1. Acknowledge what they said
                2. Provide a natural, encouraging response
                3. Maybe ask a follow-up question to continue the conversation
                4. Keep your response conversational and not too long (2-3 sentences max)
                5. If they made any obvious grammar or vocabulary mistakes, gently correct them in a natural way
                
                Focus on helping them practice speaking English naturally.
                """
                
                # Configure the model - using the newer API format
                generation_config = {
                    "temperature": 0.7,
                    "max_output_tokens": 150,
                }
                
                # In newer version we use 'gemini-pro' model
                print(f"Creating Gemini Pro model...")
                model = genai.GenerativeModel(model_name="gemini-pro")
                
                # Generate content
                print(f"Sending prompt to Gemini: {prompt[:50]}...")
                response = model.generate_content(prompt)
                
                print(f"Response received from Gemini: {response}")
                
                if hasattr(response, 'text') and response.text:
                    print(f"AI generated response: {response.text}")
                    return {"response": response.text, "success": True}
                elif hasattr(response, 'parts') and response.parts:
                    response_text = ''.join(part.text for part in response.parts if hasattr(part, 'text'))
                    print(f"AI generated response from parts: {response_text}")
                    return {"response": response_text, "success": True}
                else:
                    print("AI returned empty response, using fallback")
                    # If AI returns empty, we'll fall through to fallback
            except Exception as e:
                print(f"Google AI error: {str(e)}. Using fallback response.")
                # Continue to fallback if Google AI fails
        else:
            print("Google AI not available, using fallback response system")
            
        # Fallback responses if Google AI is not available or fails
        fallback_responses = {
            "hello": "Hello there! It's great to hear from you. How are you feeling about your IELTS preparation today?",
            "hi": "Hi! Nice to meet you. What topics are you most interested in practicing for your IELTS speaking test?",
            "how are you": "I'm doing well, thank you for asking! How about you? Are you feeling confident about your English speaking skills?",
            "yes": "That's great! Confidence is key in the IELTS speaking test. Would you like to practice describing a place you've visited recently?",
            "no": "That's okay. Everyone has different comfort levels with speaking. Let's start with something simple - can you tell me about your favorite hobby?",
            "thank you": "You're welcome! Remember that practice makes perfect. Is there any particular part of the IELTS speaking test you find challenging?",
            "thanks": "No problem at all! Is there a specific topic you'd like to discuss next?",
            "goodbye": "Goodbye! Remember to practice speaking English whenever you can. I look forward to our next conversation!",
            "bye": "Bye for now! Keep practicing your English speaking skills daily. You're doing great!"
        }
        
        # Check for matches in fallback responses
        text_lower = request.text.lower()
        for key, response in fallback_responses.items():
            if key in text_lower:
                print(f"Using fallback response for: '{key}'")
                return {"response": response, "success": True}
        
        # Default response if no match found
        default_response = f"Thank you for saying '{request.text}'. That's interesting! Could you tell me more about that topic? I'm here to help you practice your English speaking skills."
        print(f"Using default fallback response")
        return {"response": default_response, "success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"AI Response Error: {str(e)}")  # Log for debugging
        raise HTTPException(status_code=500, detail=f"AI response error: {str(e)}")

@app.post("/text-to-speech")
async def text_to_speech(request: TTSRequest):
    """
    Convert text to speech using ElevenLabs API
    """
    try:
        # ElevenLabs API endpoint
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{request.voice_id}"
        
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
                "similarity_boost": 0.5
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=data, headers=headers, timeout=30.0)
            
            if response.status_code == 200:
                # Return audio as base64
                audio_base64 = base64.b64encode(response.content).decode('utf-8')
                return {"audio_data": audio_base64, "success": True}
            else:
                raise HTTPException(status_code=response.status_code, detail="TTS API error")
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text to speech error: {str(e)}")

@app.get("/voices")
async def get_available_voices():
    """
    Get available voices from ElevenLabs
    """
    try:
        url = "https://api.elevenlabs.io/v1/voices"
        headers = {"xi-api-key": ELEVENLABS_API_KEY}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to get voices")
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Get voices error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8004)
