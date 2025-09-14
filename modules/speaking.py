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
    topic: str = None
    topicTitle: str = None
    topicDescription: str = None
    conversationHistory: list = []
    isFirstMessage: bool = False

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
                print(f"Using Google Generative AI to respond to: '{request.text}' for topic: {request.topic}")
                
                # Build conversation context
                conversation_context = ""
                if request.conversationHistory:
                    conversation_context = "\n\nConversation history:\n"
                    for msg in request.conversationHistory[-4:]:  # Son 4 mesaj
                        role = "Student" if msg['type'] == 'user' else "AI Teacher"
                        conversation_context += f"{role}: {msg['text']}\n"
                
                # Topic-specific prompts with much more detailed context
                topic_prompts = {
                    'technology': f"""
                    You are an IELTS speaking examiner focusing on TECHNOLOGY & SOCIETY topics. 
                    
                    Key areas to explore:
                    - Social media impact on relationships and society
                    - Digital transformation in work and education
                    - Privacy and security concerns in the digital age
                    - Technology addiction and mental health
                    - Future technologies (VR, IoT, blockchain)
                    - Digital divide and inequality
                    
                    Ask follow-up questions about: How technology has changed their daily routine, their opinion on social media's role, concerns about privacy, predictions for future tech developments.
                    
                    Be an expert technology discussion partner who can guide the conversation naturally.
                    """,
                    'media': f"""
                    You are an IELTS speaking examiner focusing on MEDIA & COMMUNICATION topics.
                    
                    Key areas to explore:
                    - Traditional media vs. digital platforms
                    - Journalism quality and fake news
                    - Influence of advertising and marketing
                    - Social media influencers and celebrity culture
                    - News consumption habits
                    - Media literacy and critical thinking
                    
                    Ask follow-up questions about: Their news sources, how they verify information, thoughts on influencer culture, changes in how people communicate, impact of advertising on society.
                    
                    Be an expert media analyst who can engage in sophisticated discussions about communication trends.
                    """,
                    'health': f"""
                    You are an IELTS speaking examiner focusing on HEALTH & LIFESTYLE topics.
                    
                    Key areas to explore:
                    - Work-life balance in modern society
                    - Mental health awareness and stigma
                    - Exercise and fitness trends
                    - Nutrition and diet changes
                    - Healthcare systems and accessibility
                    - Preventive medicine vs. treatment
                    - Stress management techniques
                    
                    Ask follow-up questions about: Their exercise routine, stress management methods, healthy eating habits, work-life balance strategies, healthcare experiences.
                    
                    Be a health and wellness expert who can discuss both physical and mental wellbeing comprehensively.
                    """,
                    'ai': f"""
                    You are an IELTS speaking examiner focusing on ARTIFICIAL INTELLIGENCE topics.
                    
                    Key areas to explore:
                    - Job automation and future of work
                    - AI in education and learning
                    - Ethical concerns and bias in AI
                    - AI in healthcare and diagnosis
                    - Creative AI (art, music, writing)
                    - AI governance and regulation
                    - Human-AI collaboration
                    
                    Ask follow-up questions about: How AI might affect their career, thoughts on AI in education, concerns about AI decision-making, predictions for AI development, ethical boundaries for AI.
                    
                    Be an AI researcher and futurist who can discuss both technical aspects and societal implications of artificial intelligence.
                    """,
                    'interviews': f"""
                    You are a professional HR manager conducting a practice job interview for IELTS speaking preparation.
                    
                    Key areas to explore:
                    - Professional background and experience
                    - Career goals and motivations
                    - Skills and competencies
                    - Workplace challenges and solutions
                    - Leadership and teamwork experiences
                    - Professional development plans
                    
                    Ask follow-up questions about: Their greatest professional achievement, how they handle workplace conflicts, their leadership style, career aspirations, skills they want to develop.
                    
                    Be a professional interviewer who asks realistic job interview questions while maintaining an encouraging atmosphere for IELTS practice.
                    """
                }
                
                topic_prompt = topic_prompts.get(request.topic, "You are a general English conversation partner.")
                
                # Create conversation context
                conversation_context = ""
                if request.conversationHistory:
                    conversation_context = "\n\nConversation so far:\n"
                    for msg in request.conversationHistory[-6:]:  # Son 6 mesaj
                        role = "Student" if msg['type'] == 'user' else "You (AI Teacher)"
                        conversation_context += f"{role}: {msg['text']}\n"
                
                # Create the main prompt
                prompt = f"""
                {topic_prompt}
                
                CURRENT TOPIC: {request.topicTitle or 'General Conversation'}
                
                {conversation_context}
                
                Student just said: "{request.text}"
                
                IMPORTANT INSTRUCTIONS:
                1. Stay completely focused on the topic: {request.topicTitle}
                2. Ask thought-provoking follow-up questions related to this specific topic
                3. Share relevant insights or examples related to {request.topicTitle}
                4. If the student goes off-topic, gently guide them back to {request.topicTitle}
                5. Encourage deeper thinking about the topic with "What do you think about..." or "How do you feel about..." questions
                6. Keep responses to 2-3 sentences maximum
                7. Be natural and conversational, not formal or robotic
                
                Your response should be specifically about {request.topicTitle} and should advance the conversation on this topic.
                """
                
                # Configure the model - using the newer API format
                generation_config = {
                    "temperature": 0.7,
                    "max_output_tokens": 150,
                }
                
                # In newer version we use 'gemini-1.5-flash' model
                print(f"Creating Gemini 1.5 Flash model...")
                model = genai.GenerativeModel(model_name="gemini-1.5-flash")
                
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
            print("Google AI not available, using topic-specific fallback response system")
            
        # Topic-specific fallback responses if Google AI is not available or fails
        topic_fallbacks = {
            'technology': {
                "hello": "Hello! Great to see you're interested in discussing technology. How has technology changed your daily routine over the past few years?",
                "social media": "Social media is such a fascinating topic! What's your take on how it has affected personal relationships?",
                "privacy": "Privacy concerns are very relevant today. Do you worry about your personal data when using online services?",
                "yes": "That's interesting! Can you give me a specific example of how technology has made your life easier or more complicated?",
                "no": "I understand. Sometimes technology can feel overwhelming. What aspect of modern technology concerns you the most?"
            },
            'media': {
                "hello": "Hello! I'm excited to discuss media and communication with you. Where do you usually get your news from?",
                "news": "News consumption has really changed, hasn't it? How do you verify if the information you read online is reliable?",
                "fake news": "Fake news is a real concern. Have you ever encountered information that you later found out was false?",
                "yes": "That's a great point! How do you think traditional newspapers compare to online news sources?",
                "no": "That's understandable. What do you think about the role of social media influencers in spreading information?"
            },
            'health': {
                "hello": "Hello! I'm looking forward to talking about health and lifestyle. What does a healthy day look like for you?",
                "exercise": "Exercise is so important! What's your favorite way to stay physically active?",
                "stress": "Stress management is crucial in today's world. How do you typically unwind after a busy day?",
                "yes": "That's wonderful! What motivates you to maintain healthy habits?",
                "no": "That's honest. What do you think are the biggest barriers to living a healthy lifestyle today?"
            },
            'ai': {
                "hello": "Hello! AI is such an exciting topic. Have you used any AI tools like ChatGPT or voice assistants?",
                "artificial intelligence": "AI is everywhere now! What's your opinion on AI being used in hiring decisions or medical diagnoses?",
                "job": "That's a common concern. Do you think AI will create new types of jobs even as it replaces others?",
                "yes": "Fascinating! What ethical guidelines do you think should govern AI development?",
                "no": "That's a valid perspective. What would need to happen for you to feel more comfortable with AI?"
            },
            'interviews': {
                "hello": "Hello! Welcome to this practice interview. Could you start by telling me about your professional background?",
                "experience": "That sounds valuable! What would you say is your greatest professional strength?",
                "skills": "Excellent! Can you give me an example of a challenging situation you handled at work?",
                "yes": "Great! Where do you see yourself professionally in the next five years?",
                "no": "That's honest. What kind of professional development would you like to pursue?"
            }
        }
        
        current_topic_fallbacks = topic_fallbacks.get(request.topic, {
            "hello": f"Hello! Let's discuss {request.topicTitle}. What are your initial thoughts on this topic?",
            "yes": f"Interesting! Can you elaborate more on your perspective about {request.topicTitle}?",
            "no": f"I see. What aspects of {request.topicTitle} do you find most relevant to your life?"
        })
        
        # Check for matches in topic-specific fallback responses
        text_lower = request.text.lower()
        for key, response in current_topic_fallbacks.items():
            if key in text_lower:
                print(f"Using topic-specific fallback response for: '{key}' in topic: {request.topic}")
                return {"response": response, "success": True}
        
        # Default topic-specific response if no match found
        default_response = f"That's an interesting point about {request.topicTitle}! Could you tell me more about your experience with this? I'd love to hear your perspective."
        print(f"Using default topic-specific fallback response for topic: {request.topic}")
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
    uvicorn.run(app, host="0.0.0.0", port=8005)
