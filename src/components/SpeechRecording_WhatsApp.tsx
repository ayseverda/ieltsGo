import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mic, Square, Send, RotateCcw, Loader2 } from 'lucide-react';

interface Topic {
  id: string;
  title: string;
  description: string;
  icon: string;
  prompt: string;
}

interface ConversationMessage {
  id: string;
  type: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const topics: Topic[] = [
  {
    id: 'technology',
    title: 'Technology & Society',
    description: 'Technology\'nin toplum üzerindeki etkilerini tartışın',
    icon: '💻',
    prompt: 'Hello! I\'m excited to discuss technology with you. How do you think social media has changed the way people communicate with each other?'
  },
  {
    id: 'media',
    title: 'Media & Communication',
    description: 'Medya ve iletişim konularını keşfedin',
    icon: '📺',
    prompt: 'Hello! Let\'s talk about media and communication. Where do you usually get your news from, and how do you decide if a news source is trustworthy?'
  },
  {
    id: 'health',
    title: 'Health & Lifestyle',
    description: 'Sağlık ve yaşam tarzı konularını konuşun',
    icon: '🏃‍♂️',
    prompt: 'Hello! I\'d love to discuss health and lifestyle with you. What does a typical healthy day look like in your routine?'
  },
  {
    id: 'ai',
    title: 'Artificial Intelligence',
    description: 'Yapay zeka ve geleceği hakkında sohbet edin',
    icon: '🤖',
    prompt: 'Hello! AI is such a fascinating topic. Have you used any AI tools recently? What\'s your opinion on how AI might change our daily lives?'
  },
  {
    id: 'interviews',
    title: 'Job Interviews',
    description: 'İş görüşmesi pratiği yapın',
    icon: '💼',
    prompt: 'Hello! Welcome to this practice interview session. Let\'s start - could you please introduce yourself and tell me a bit about your background?'
  }
];

interface SpeechRecordingProps {}

const SpeechRecording: React.FC<SpeechRecordingProps> = () => {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [error, setError] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check for microphone access on component mount
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        stream.getTracks().forEach(track => track.stop());
      })
      .catch(err => {
        setError('Mikrofon erişimi mevcut değil. Lütfen tarayıcı ayarlarından mikrofon iznini kontrol edin.');
      });
  }, []);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, isProcessing]);

  const selectTopic = (topic: Topic) => {
    setSelectedTopic(topic);
    const aiMessage: ConversationMessage = {
      id: Date.now().toString(),
      type: 'ai',
      text: topic.prompt,
      timestamp: new Date()
    };
    setConversationHistory([aiMessage]);
  };

  const backToTopics = () => {
    setSelectedTopic(null);
    setConversationHistory([]);
    setError('');
  };

  const resetSession = () => {
    setConversationHistory(selectedTopic ? [{
      id: Date.now().toString(),
      type: 'ai',
      text: selectedTopic.prompt,
      timestamp: new Date()
    }] : []);
    setError('');
  };

  const startRecording = async () => {
    setError('');
    audioChunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        processRecording();
      };
      
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
    } catch (error) {
      setError('Mikrofon erişimi başarısız. Lütfen mikrofon izni verin.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processRecording = async () => {
    setIsProcessing(true);
    setError('');
    
    try {
      if (audioChunksRef.current.length === 0) {
        throw new Error('Ses kaydedilemedi');
      }
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      if (audioBlob.size < 100) {
        throw new Error('Ses dosyası çok küçük');
      }
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64Audio = base64data.split(',')[1];
        
        // Speech to text
        const sttResponse = await fetch('http://localhost:8000/api/speaking/speech-to-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio_data: base64Audio,
            format: 'webm'
          }),
        });
        
        if (!sttResponse.ok) {
          throw new Error(`STT hatası: ${sttResponse.status}`);
        }
        
        const sttData = await sttResponse.json();
        const userText = sttData.text || '';
        
        if (!userText.trim()) {
          throw new Error('Konuşma algılanamadı');
        }
        
        // Add user message to conversation
        const userMessage: ConversationMessage = {
          id: Date.now().toString(),
          type: 'user',
          text: userText,
          timestamp: new Date()
        };
        
        const updatedHistory = [...conversationHistory, userMessage];
        setConversationHistory(updatedHistory);
        
        // Get AI response
        const aiResponse = await fetch('http://localhost:8000/api/speaking/ai-response', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: userText,
            topic: selectedTopic?.id || '',
            topicTitle: selectedTopic?.title || '',
            topicDescription: selectedTopic?.description || '',
            conversationHistory: updatedHistory,
            isFirstMessage: updatedHistory.length <= 1
          }),
        });
        
        if (!aiResponse.ok) {
          throw new Error(`AI hatası: ${aiResponse.status}`);
        }
        
        const aiData = await aiResponse.json();
        const aiText = aiData.response || 'Yanıt alınamadı';
        
        // Add AI message to conversation
        const aiMessage: ConversationMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          text: aiText,
          timestamp: new Date()
        };
        
        setConversationHistory([...updatedHistory, aiMessage]);
        
      };
      
      reader.readAsDataURL(audioBlob);
      
    } catch (error) {
      setError(`Hata: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const playAIResponse = async (text: string) => {
    if (!text || isPlayingAudio) return;
    
    setIsPlayingAudio(true);
    
    try {
      const ttsResponse = await fetch('http://localhost:8000/api/speaking/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice_id: 'EXAVITQu4vr4xnSDxMaL'
        }),
      });
      
      if (ttsResponse.ok) {
        const audioBlob = await ttsResponse.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        }
      }
    } catch (error) {
      console.error('TTS error:', error);
      setIsPlayingAudio(false);
    }
  };

  // Topic selection screen
  if (!selectedTopic) {
    return (
      <div className="container">
        <div className="card">
          <div className="mb-4">
            <Link to="/speaking" className="btn mb-2">
              <ArrowLeft style={{ marginRight: '8px' }} />
              Speaking Modülüne Dön
            </Link>
            <h1 className="module-header">
              <Mic />
              Konuşma Konusu Seçin
            </h1>
            <p style={{ color: '#666', marginTop: '10px' }}>
              AI öğretmen ile pratik yapmak istediğiniz konuyu seçin
            </p>
          </div>

          <div className="grid">
            {topics.map((topic) => (
              <div key={topic.id} className="card" style={{ cursor: 'pointer' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>{topic.icon}</span>
                  {topic.title}
                </h3>
                <p style={{ color: '#666', margin: '10px 0' }}>{topic.description}</p>
                <button 
                  className="btn" 
                  onClick={() => selectTopic(topic)}
                  style={{ 
                    backgroundColor: '#4CAF50', 
                    color: 'white',
                    border: 'none'
                  }}
                >
                  Bu Konuyu Seç
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Full screen chat interface - WhatsApp style
  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#e5ddd5',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Chat Header - WhatsApp green */}
      <div style={{
        padding: '15px 20px',
        backgroundColor: '#075e54',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={backToTopics}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '5px',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ArrowLeft size={24} />
          </button>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>
            👩‍🏫
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>AI Teacher</h3>
            <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
              {selectedTopic.title}
            </p>
          </div>
        </div>
        <button 
          onClick={resetSession}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            borderRadius: '20px',
            padding: '8px 15px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
        >
          <RotateCcw size={16} />
          Sıfırla
        </button>
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23e5ddd5' fill-opacity='0.1'%3E%3Cpath d='M20 20c0-11.046-8.954-20-20-20v20h20z'/%3E%3C/g%3E%3C/svg%3E")`,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {conversationHistory.map((message, index) => (
          <div key={message.id} style={{
            display: 'flex',
            justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: '8px',
            animation: 'messageSlideIn 0.3s ease-out'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              maxWidth: '75%',
              flexDirection: message.type === 'user' ? 'row-reverse' : 'row'
            }}>
              {/* Avatar for AI messages only */}
              {message.type === 'ai' && (
                <div 
                  onClick={() => playAIResponse(message.text)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#075e54',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    color: 'white',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  title="Sesli dinle"
                >
                  👩‍🏫
                  {isPlayingAudio && (
                    <div style={{
                      position: 'absolute',
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      border: '2px solid #25d366',
                      animation: 'soundWave 1.5s infinite'
                    }} />
                  )}
                </div>
              )}

              {/* Message Bubble */}
              <div style={{
                padding: '10px 15px',
                borderRadius: message.type === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                backgroundColor: message.type === 'user' ? '#dcf8c6' : 'white',
                color: '#303030',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                position: 'relative',
                wordWrap: 'break-word',
                maxWidth: '100%',
                minWidth: '60px'
              }}>
                <p style={{ 
                  margin: 0, 
                  lineHeight: '1.4',
                  fontSize: '15px'
                }}>
                  {message.text}
                </p>
                <div style={{
                  fontSize: '11px',
                  color: '#667781',
                  marginTop: '5px',
                  textAlign: 'right'
                }}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isProcessing && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginBottom: '8px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              maxWidth: '75%'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#075e54',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                color: 'white',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}>
                👩‍🏫
              </div>
              <div style={{
                padding: '10px 15px',
                borderRadius: '18px 18px 18px 4px',
                backgroundColor: 'white',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '3px',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#90cdf4',
                    animation: 'typing 1.4s infinite'
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#90cdf4',
                    animation: 'typing 1.4s infinite 0.2s'
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#90cdf4',
                    animation: 'typing 1.4s infinite 0.4s'
                  }} />
                </div>
                <span style={{ fontSize: '14px', color: '#667781' }}>yazıyor...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Area */}
      <div style={{
        padding: '10px 15px',
        backgroundColor: '#f0f2f5',
        borderTop: '1px solid #e9edef',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        {/* Voice Message Button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isRecording ? '#ff4444' : '#25d366',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            if (!isProcessing) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
          }}
        >
          {isRecording ? <Square size={22} /> : <Mic size={22} />}
        </button>

        {/* Status Text Input */}
        <div style={{
          flex: 1,
          backgroundColor: 'white',
          borderRadius: '25px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          fontSize: '15px',
          color: '#667781',
          minHeight: '24px'
        }}>
          {isRecording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4444' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#ff4444',
                animation: 'pulse 1s infinite'
              }} />
              Konuşuyor... (durdurmak için butona tekrar basın)
            </div>
          ) : isProcessing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={16} />
              Ses işleniyor ve AI yanıtı hazırlanıyor...
            </div>
          ) : (
            'Sesli mesaj göndermek için mikrofon butonuna basın'
          )}
        </div>

        {/* Send Button (disabled for now) */}
        <button
          disabled
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#e9edef',
            color: '#8696a0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'not-allowed',
            flexShrink: 0
          }}
        >
          <Send size={20} />
        </button>
      </div>

      {/* Error Toast */}
      {error && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#ff4444',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          maxWidth: '90%',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlayingAudio(false)}
        style={{ display: 'none' }}
      />

      <style>{`
        @keyframes messageSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes soundWave {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.8); opacity: 0; }
        }

        @keyframes typing {
          0%, 60%, 100% { 
            transform: translateY(0); 
            opacity: 0.4;
          }
          30% { 
            transform: translateY(-10px); 
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SpeechRecording;