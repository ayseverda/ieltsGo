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
from datetime import datetime

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
GOOGLE_AI_API_KEY = os.getenv("GOOGLE_AI_API_KEY", "AIzaSyALnio3_6NHRJ2wPrDqQyALBQKvvCkO7rw")
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
                    """,
                    'daily-life': f"""
                    You are an IELTS speaking examiner focusing on DAILY LIFE & ROUTINES topics.
                    
                    Key areas to explore:
                    - Morning and evening routines
                    - Work-life balance and time management
                    - Leisure activities and hobbies
                    - Household chores and responsibilities
                    - Weekend activities and relaxation
                    - Daily transportation and commuting
                    - Shopping and errands
                    - Meals and eating habits
                    
                    Ask follow-up questions about: Their typical weekday vs weekend, how they manage their time, favorite leisure activities, household responsibilities, commuting experiences, shopping preferences, meal planning.
                    
                    Be a friendly conversation partner who can discuss everyday life naturally and help them practice describing routines and daily activities.
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
            },
            'daily-life': {
                "hello": "Hello! Let's talk about daily life and routines. What does your typical weekday morning look like?",
                "routine": "That sounds like a good routine! How different is your weekend schedule compared to weekdays?",
                "work": "Work-life balance is so important. How do you usually unwind after a busy day?",
                "hobbies": "That's interesting! How do you make time for your hobbies during the week?",
                "yes": "That's great! What's your favorite part of your daily routine?",
                "no": "That's understandable. What would you like to change about your current daily routine?"
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

class SpeakingTestRequest(BaseModel):
    part1_count: int = 4
    part3_count: int = 3
    difficulty: str = "intermediate"

class SpeakingEvaluationRequest(BaseModel):
    part1_answers: list[str]
    part2_answer: str
    part3_answers: list[str]
    questions: dict

class SessionEvaluationRequest(BaseModel):
    conversation_history: list[dict]
    topic: str
    session_messages: list[str]

@app.post("/generate-test")
async def generate_speaking_test(request: SpeakingTestRequest):
    """
    Generate IELTS Speaking test questions using AI
    """
    try:
        if not GOOGLE_AI_AVAILABLE:
            raise HTTPException(status_code=500, detail="AI service not available")
        
        # Generate Part 1 questions
        part1_prompt = f"""Generate {request.part1_count} IELTS Speaking Part 1 questions about personal topics. 
        Each question should be suitable for {request.difficulty} level students.
        Return as JSON array with this format:
        [
            {{"question": "What is your hometown like?"}},
            {{"question": "Do you prefer living in a city or countryside?"}},
            ...
        ]"""
        
        model = genai.GenerativeModel('gemini-1.5-flash')
        part1_response = model.generate_content(part1_prompt)
        part1_text = part1_response.text.strip()
        
        # Clean and parse Part 1
        import re
        part1_text = re.sub(r"^```(json)?", "", part1_text, flags=re.IGNORECASE)
        part1_text = re.sub(r"```$", "", part1_text)
        part1_text = part1_text.strip()
        
        try:
            part1_questions = json.loads(part1_text)
        except json.JSONDecodeError as e:
            print(f"Part1 JSON parse error: {e}")
            print(f"Part1 text: {part1_text}")
            # Fallback: Create simple questions
            part1_questions = [
                {"question": "What is your hometown like?"},
                {"question": "Do you prefer living in a city or countryside?"},
                {"question": "What do you like to do in your free time?"},
                {"question": "Tell me about your favorite season."}
            ]
        
        # Generate Part 2 (Cue Card)
        part2_prompt = f"""Generate an IELTS Speaking Part 2 cue card topic with 4 bullet points.
        Make it suitable for {request.difficulty} level students.
        Return as JSON with this format:
        {{
            "topic": "Describe a memorable trip you have taken",
            "bullets": [
                "Where you went",
                "Who you went with", 
                "What you did there",
                "And explain why it was memorable"
            ]
        }}"""
        
        part2_response = model.generate_content(part2_prompt)
        part2_text = part2_response.text.strip()
        
        # Clean and parse Part 2
        part2_text = re.sub(r"^```(json)?", "", part2_text, flags=re.IGNORECASE)
        part2_text = re.sub(r"```$", "", part2_text)
        part2_text = part2_text.strip()
        
        try:
            part2_data = json.loads(part2_text)
        except json.JSONDecodeError as e:
            print(f"Part2 JSON parse error: {e}")
            print(f"Part2 text: {part2_text}")
            # Fallback: Create simple cue card
            part2_data = {
                "topic": "Describe a memorable trip you have taken",
                "bullets": [
                    "Where you went",
                    "Who you went with", 
                    "What you did there",
                    "And explain why it was memorable"
                ]
            }
        
        # Generate Part 3 questions
        part3_prompt = f"""Generate {request.part3_count} IELTS Speaking Part 3 discussion questions 
        related to the Part 2 topic: "{part2_data['topic']}".
        Make them suitable for {request.difficulty} level students and more abstract/discussion-based.
        Return as JSON array with this format:
        [
            {{"question": "How has tourism changed in your country over the years?"}},
            {{"question": "What are the benefits and drawbacks of international travel?"}},
            ...
        ]"""
        
        part3_response = model.generate_content(part3_prompt)
        part3_text = part3_response.text.strip()
        
        # Clean and parse Part 3
        part3_text = re.sub(r"^```(json)?", "", part3_text, flags=re.IGNORECASE)
        part3_text = re.sub(r"```$", "", part3_text)
        part3_text = part3_text.strip()
        
        try:
            part3_questions = json.loads(part3_text)
        except json.JSONDecodeError as e:
            print(f"Part3 JSON parse error: {e}")
            print(f"Part3 text: {part3_text}")
            # Fallback: Create simple questions
            part3_questions = [
                {"question": "How has tourism changed in your country over the years?"},
                {"question": "What are the benefits and drawbacks of international travel?"},
                {"question": "Do you think traveling helps people understand different cultures?"}
            ]
        
        return {
            "part1": part1_questions,
            "part2": part2_data,
            "part3": part3_questions
        }
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Speaking test generation error: {str(e)}")
        print(f"Error details: {error_details}")
        raise HTTPException(status_code=500, detail=f"Test generation error: {str(e)}")

@app.post("/evaluate")
async def evaluate_speaking(request: SpeakingEvaluationRequest):
    """
    Evaluate IELTS Speaking test responses using AI
    """
    try:
        if not GOOGLE_AI_AVAILABLE:
            raise HTTPException(status_code=500, detail="AI service not available")
        
        # Combine all answers for evaluation
        all_answers = []
        
        # Part 1 answers
        for i, answer in enumerate(request.part1_answers):
            if answer.strip():
                all_answers.append(f"Part 1 Question {i+1}: {answer}")
        
        # Part 2 answer
        if request.part2_answer.strip():
            all_answers.append(f"Part 2: {request.part2_answer}")
        
        # Part 3 answers
        for i, answer in enumerate(request.part3_answers):
            if answer.strip():
                all_answers.append(f"Part 3 Question {i+1}: {answer}")
        
        if not all_answers:
            raise HTTPException(status_code=400, detail="No answers provided for evaluation")
        
        combined_text = "\n".join(all_answers)
        
        # Create evaluation prompt
        evaluation_prompt = f"""You are an IELTS Speaking examiner. Evaluate this student's speaking performance based on the 4 IELTS criteria:

Student's responses:
{combined_text}

Please evaluate according to IELTS Speaking band descriptors and provide:

1. FLUENCY AND COHERENCE (0-9)
2. LEXICAL RESOURCE (0-9) 
3. GRAMMATICAL RANGE AND ACCURACY (0-9)
4. PRONUNCIATION (0-9)

For each criterion, provide:
- Band score (0-9)
- Detailed feedback explaining strengths and areas for improvement

Return as JSON with this exact format:
{{
    "fluency_coherence": {{
        "band": 6,
        "feedback": "Detailed feedback here..."
    }},
    "lexical_resource": {{
        "band": 6,
        "feedback": "Detailed feedback here..."
    }},
    "grammar": {{
        "band": 6,
        "feedback": "Detailed feedback here..."
    }},
    "pronunciation": {{
        "band": 6,
        "feedback": "Detailed feedback here..."
    }},
    "overall_band": 6.0,
    "general_feedback": "Overall performance summary and recommendations"
}}"""

        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(evaluation_prompt)
        response_text = response.text.strip()
        
        # Clean and parse response
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        evaluation_result = json.loads(response_text)
        
        # Add additional metadata
        evaluation_result["total_answers"] = len([a for a in request.part1_answers + [request.part2_answer] + request.part3_answers if a.strip()])
        evaluation_result["timestamp"] = str(datetime.now())
        
        return evaluation_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation error: {str(e)}")

@app.post("/evaluate-session")
async def evaluate_speaking_session(request: SessionEvaluationRequest):
    """
    Evaluate complete speaking session conversation using AI
    """
    try:
        if not GOOGLE_AI_AVAILABLE:
            raise HTTPException(status_code=500, detail="AI service not available")
        
        # Combine all user messages from the session
        user_messages = []
        for msg in request.session_messages:
            if msg.strip():
                user_messages.append(msg.strip())
        
        if not user_messages:
            raise HTTPException(status_code=400, detail="No user messages provided for evaluation")
        
        # Create conversation context
        conversation_context = f"Topic: {request.topic}\n\n"
        conversation_context += "Student's responses during the session:\n"
        for i, msg in enumerate(user_messages, 1):
            conversation_context += f"{i}. {msg}\n"
        
        # Create comprehensive evaluation prompt
        evaluation_prompt = f"""You are an IELTS Speaking examiner. Evaluate this student's overall speaking performance during a conversation session about "{request.topic}".

{conversation_context}

Please evaluate the student's performance across the entire session according to IELTS Speaking band descriptors and provide:

1. FLUENCY AND COHERENCE (0-9)
2. LEXICAL RESOURCE (0-9) 
3. GRAMMATICAL RANGE AND ACCURACY (0-9)
4. PRONUNCIATION (0-9)

Consider the student's:
- Consistency across all responses
- Development of ideas throughout the session
- Use of linking words and discourse markers
- Vocabulary range and accuracy
- Grammatical structures and accuracy
- Overall communication effectiveness

For each criterion, provide:
- Band score (0-9)
- Detailed feedback explaining strengths and areas for improvement

Return as JSON with this exact format:
{{
    "fluency_coherence": {{
        "band": 6,
        "feedback": "Detailed feedback here..."
    }},
    "lexical_resource": {{
        "band": 6,
        "feedback": "Detailed feedback here..."
    }},
    "grammar": {{
        "band": 6,
        "feedback": "Detailed feedback here..."
    }},
    "pronunciation": {{
        "band": 6,
        "feedback": "Detailed feedback here..."
    }},
    "overall_band": 6.0,
    "general_feedback": "Overall performance summary and recommendations",
    "session_summary": {{
        "total_messages": {len(user_messages)},
        "topic_engagement": "How well the student engaged with the topic",
        "improvement_areas": ["Area 1", "Area 2"],
        "strengths": ["Strength 1", "Strength 2"]
    }}
}}"""

        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(evaluation_prompt)
        response_text = response.text.strip()
        
        # Clean and parse response
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        evaluation_result = json.loads(response_text)
        
        # Add additional metadata
        evaluation_result["topic"] = request.topic
        evaluation_result["timestamp"] = str(datetime.now())
        evaluation_result["session_type"] = "practice_conversation"
        
        return evaluation_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Session evaluation error: {str(e)}")

@app.post("/evaluate-general-test")
async def evaluate_general_test(request: dict):
    """
    Genel IELTS deneme sınavı için detaylı değerlendirme yap
    """
    try:
        results = request.get('results', {})
        overall_score = request.get('overall_score', 0)
        evaluation_prompt = request.get('evaluation_prompt', '')
        
        if not GOOGLE_AI_AVAILABLE:
            # Fallback: Basit değerlendirme
            return {
                "detailed_evaluation": f"IELTS Genel Deneme Sonucunuz: {overall_score:.1f}/9. Reading: {results.get('reading', 0)}, Speaking: {results.get('speaking', 0)}. Diğer modüller henüz tamamlanmadı.",
                "module_evaluations": {
                    "reading": {
                        "score": results.get('reading', 0),
                        "feedback": f"Reading modülünde {results.get('reading', 0)}/9 puan aldınız."
                    },
                    "listening": {
                        "score": results.get('listening', 0),
                        "feedback": "Listening modülü henüz test edilmedi."
                    },
                    "writing": {
                        "score": results.get('writing', 0),
                        "feedback": "Writing modülü henüz test edilmedi."
                    },
                    "speaking": {
                        "score": results.get('speaking', 0),
                        "feedback": f"Speaking modülünde {results.get('speaking', 0)}/9 puan aldınız."
                    }
                },
                "recommendations": [
                    "Reading modülünde daha fazla pratik yapın.",
                    "Speaking modülünde akıcılık çalışın.",
                    "Listening ve Writing modüllerini de tamamlayın."
                ]
            }
        
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(evaluation_prompt)
            
            if hasattr(response, 'text') and response.text:
                # JSON parse et
                import json
                import re
                
                text = response.text.strip()
                cleaned = re.sub(r"^```(json)?", "", text, flags=re.IGNORECASE)
                cleaned = re.sub(r"```$", "", cleaned)
                cleaned = cleaned.strip()
                
                try:
                    evaluation_data = json.loads(cleaned)
                    return evaluation_data
                except Exception:
                    # JSON parse hatası durumunda fallback
                    return {
                        "detailed_evaluation": f"IELTS Genel Deneme Sonucunuz: {overall_score:.1f}/9. Reading: {results.get('reading', 0)}, Speaking: {results.get('speaking', 0)}. Diğer modüller henüz tamamlanmadı.",
                        "module_evaluations": {
                            "reading": {
                                "score": results.get('reading', 0),
                                "feedback": f"Reading modülünde {results.get('reading', 0)}/9 puan aldınız."
                            },
                            "listening": {
                                "score": results.get('listening', 0),
                                "feedback": "Listening modülü henüz test edilmedi."
                            },
                            "writing": {
                                "score": results.get('writing', 0),
                                "feedback": "Writing modülü henüz test edilmedi."
                            },
                            "speaking": {
                                "score": results.get('speaking', 0),
                                "feedback": f"Speaking modülünde {results.get('speaking', 0)}/9 puan aldınız."
                            }
                        },
                        "recommendations": [
                            "Reading modülünde daha fazla pratik yapın.",
                            "Speaking modülünde akıcılık çalışın.",
                            "Listening ve Writing modüllerini de tamamlayın."
                        ]
                    }
            else:
                raise Exception("AI returned empty response")
                
        except Exception as e:
            print(f"AI evaluation error: {str(e)}")
            # AI hatası durumunda fallback
            return {
                "detailed_evaluation": f"IELTS Genel Deneme Sonucunuz: {overall_score:.1f}/9. Reading: {results.get('reading', 0)}, Speaking: {results.get('speaking', 0)}. Diğer modüller henüz tamamlanmadı.",
                "module_evaluations": {
                    "reading": {
                        "score": results.get('reading', 0),
                        "feedback": f"Reading modülünde {results.get('reading', 0)}/9 puan aldınız."
                    },
                    "listening": {
                        "score": results.get('listening', 0),
                        "feedback": "Listening modülü henüz test edilmedi."
                    },
                    "writing": {
                        "score": results.get('writing', 0),
                        "feedback": "Writing modülü henüz test edilmedi."
                    },
                    "speaking": {
                        "score": results.get('speaking', 0),
                        "feedback": f"Speaking modülünde {results.get('speaking', 0)}/9 puan aldınız."
                    }
                },
                "recommendations": [
                    "Reading modülünde daha fazla pratik yapın.",
                    "Speaking modülünde akıcılık çalışın.",
                    "Listening ve Writing modüllerini de tamamlayın."
                ]
            }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"General test evaluation error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8005)
