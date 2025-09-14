import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mic, Square, Send, RotateCcw, Loader2, Volume2 } from 'lucide-react';

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
  
  // Session bazlı puanlama için state'ler
  const [sessionScores, setSessionScores] = useState<number[]>([]);
  const [sessionMessages, setSessionMessages] = useState<string[]>([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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

  // Web Audio API fallback function
  const playWithWebAudio = async (audioBlob: Blob) => {
    try {
      console.log('Web Audio API ile çalma başlatılıyor...');
      
      // AudioContext oluştur
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Blob'u ArrayBuffer'a çevir
      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log('ArrayBuffer oluşturuldu:', arrayBuffer.byteLength);
      
      // Audio buffer'a decode et
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('Audio buffer decode edildi:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels
      });
      
      // Audio source oluştur
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      // Bittiğinde cleanup
      source.onended = () => {
        console.log('Web Audio API çalma tamamlandı');
        setIsPlayingAudio(false);
        audioContext.close();
      };
      
      // Çalmaya başla
      console.log('Web Audio API ile çalma başlatılıyor...');
      source.start(0);
      console.log('Web Audio API çalma başlatıldı!');
      
    } catch (webAudioError) {
      console.error('Web Audio API hatası:', webAudioError);
      setIsPlayingAudio(false);
      
      // Son çare: Manual download
      console.log('Manual download deneniyor...');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(audioBlob);
      link.download = 'tts_audio_manual.wav';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('Audio dosyası manuel olarak indirildi');
    }
  };

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
    
    // Session'ı başlat
    setSessionStarted(true);
    setSessionScores([]);
    setSessionMessages([]);
    console.log('🎤 Yeni speaking session başlatıldı:', topic.title);
  };

  const backToTopics = () => {
    console.log('🔄 backToTopics çağrıldı', {
      sessionStarted: sessionStarted,
      sessionScoresLength: sessionScores.length,
      sessionScores: sessionScores
    });
    
    // Session bitir ve puanı kaydet
    if (sessionStarted && sessionScores.length > 0) {
      console.log('💾 Session bitiyor, puan kaydediliyor...');
      saveSessionScore();
    } else {
      console.log('📊 Session bitiyor ama puan yok, kaydetme atlanıyor');
    }
    
    setSelectedTopic(null);
    setConversationHistory([]);
    setError('');
    setSessionStarted(false);
    setSessionScores([]);
    setSessionMessages([]);
  };

  const resetSession = () => {
    console.log('🔄 resetSession çağrıldı', {
      sessionStarted: sessionStarted,
      sessionScoresLength: sessionScores.length,
      sessionScores: sessionScores
    });
    
    // Session bitir ve puanı kaydet
    if (sessionStarted && sessionScores.length > 0) {
      console.log('💾 Session sıfırlanıyor, puan kaydediliyor...');
      saveSessionScore();
    } else {
      console.log('📊 Session sıfırlanıyor ama puan yok, kaydetme atlanıyor');
    }
    
    const newHistory: ConversationMessage[] = selectedTopic ? [{
      id: Date.now().toString(),
      type: 'ai' as const,
      text: selectedTopic.prompt,
      timestamp: new Date()
    }] : [];
    
    setConversationHistory(newHistory);
    setError('');
    
    // Yeni session başlat
    setSessionScores([]);
    setSessionMessages([]);
    console.log('🔄 Speaking session sıfırlandı');
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

  // Save message to backend for analysis
  const saveMessageToBackend = async (message: string) => {
    try {
      console.log('💾 Speaking - Mesaj kaydetme başlatılıyor...', {
        topic: selectedTopic?.title,
        messageLength: message.length
      });
      
      const token = localStorage.getItem('token');
      console.log('🔑 Speaking - Token kontrolü:', token ? 'Token var' : 'Token yok');
      
      if (!token) {
        console.log('❌ Speaking - Kullanıcı giriş yapmamış, mesaj kaydedilmiyor');
        return;
      }

      const response = await fetch('http://localhost:8000/api/speaking/save-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          topicId: selectedTopic?.id || 'unknown',
          topicTitle: selectedTopic?.title || 'Unknown Topic',
          message: message
        }),
      });

      console.log('📥 Speaking - Backend yanıtı:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`Backend kayıt hatası: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Speaking - Mesaj başarıyla kaydedildi:', data);
      
      // Session'a puan ekle (hemen kaydetme, session bitince kaydedeceğiz)
      if (data.analysis && data.analysis.overallScore) {
        const newScore = data.analysis.overallScore;
        console.log(`📊 Session puanı ekleniyor: ${newScore}/100`);
        
        setSessionScores(prev => {
          const updated = [...prev, newScore];
          console.log(`📊 Session scores güncellendi:`, updated);
          return updated;
        });
        
        setSessionMessages(prev => {
          const updated = [...prev, message];
          console.log(`📝 Session messages güncellendi:`, updated.length, 'mesaj');
          return updated;
        });
        
        console.log(`✅ Session puanı eklendi: ${newScore}/100`);
        console.log('⏳ Session devam ediyor, puan henüz kaydedilmiyor...');
      } else {
        console.log('❌ Analysis veya overallScore bulunamadı:', data);
      }
      
    } catch (error) {
      console.error('❌ Speaking - Mesaj kaydedilemedi:', error);
      throw error;
    }
  };

  const saveSessionScore = async () => {
    console.log('🔍 saveSessionScore çağrıldı', {
      sessionScores: sessionScores,
      sessionScoresLength: sessionScores.length,
      selectedTopic: selectedTopic?.title
    });
    
    if (sessionScores.length === 0) {
      console.log('📊 Session puanı yok, kaydetme atlanıyor');
      return;
    }

    try {
      // Session ortalaması hesapla
      const averageScore = sessionScores.reduce((sum, score) => sum + score, 0) / sessionScores.length;
      const bandScore = averageScore / 10; // 0-100'den 0-9'a çevir
      
      console.log('💾 Speaking Session puanı kaydediliyor...', {
        mesajSayısı: sessionScores.length,
        ortalamaPuan: averageScore,
        bandScore: bandScore,
        topic: selectedTopic?.title,
        sessionScores: sessionScores
      });
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ Speaking - Kullanıcı giriş yapmamış, puan kaydedilmiyor');
        return;
      }

      const response = await fetch('http://localhost:8000/api/save-score', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          module: 'speaking',
          band_score: bandScore,
          raw_score: Math.round(averageScore),
          total_questions: sessionScores.length,
          topic: selectedTopic?.title || 'Unknown Topic',
          difficulty: 'intermediate',
          accent: null,
          detailed_results: {
            session_scores: sessionScores,
            session_messages: sessionMessages,
            average_score: averageScore,
            topicId: selectedTopic?.id
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Speaking Session puanı başarıyla kaydedildi:', result);
      } else {
        const errorText = await response.text();
        console.error('❌ Speaking Session puan kaydetme hatası:', errorText);
      }
    } catch (error) {
      console.error('❌ Speaking Session puan kaydetme hatası:', error);
    }
  };

  // Bu fonksiyon artık kullanılmıyor - session bazlı puanlama kullanıyoruz
  // const saveSpeakingScoreToDatabase = async (scoreData: any) => { ... }

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
        
        // Save user message to backend for analysis
        try {
          await saveMessageToBackend(userText);
        } catch (saveError) {
          console.warn('Mesaj kaydedilemedi:', saveError);
          // Don't break the conversation flow, just log the error
        }      };
      
      reader.readAsDataURL(audioBlob);
      
    } catch (error) {
      setError(`Hata: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const playAIResponse = async (text: string) => {
    if (!text || isPlayingAudio) {
      console.log('TTS çalıştırılamıyor:', { text: !!text, isPlayingAudio });
      return;
    }
    
    console.log('TTS başlatılıyor...', { text, isPlayingAudio });
    setIsPlayingAudio(true);
    
    try {
      console.log('TTS isteği gönderiliyor:', text);
      
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
      
      console.log('TTS yanıt durumu:', ttsResponse.status, ttsResponse.statusText);
      console.log('TTS yanıt headers:', Object.fromEntries(ttsResponse.headers.entries()));
      
      if (ttsResponse.ok) {
        // Backend JSON response olarak base64 audio data dönüyor
        const ttsData = await ttsResponse.json();
        console.log('TTS JSON response alındı:', { 
          hasAudioData: !!ttsData.audio_data,
          dataLength: ttsData.audio_data?.length || 0 
        });
        
        if (ttsData.audio_data) {
          try {
            // Base64 audio data'yı binary'ye çevir
            const binaryString = atob(ttsData.audio_data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            // MP3 blob oluştur (backend MP3 dönüyor)
            const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
            console.log('Audio blob oluşturuldu:', { 
              size: audioBlob.size, 
              type: audioBlob.type 
            });
            
            if (audioBlob.size > 0) {
              const audioUrl = URL.createObjectURL(audioBlob);
              console.log('Audio URL oluşturuldu:', audioUrl);
              
              // Browser codec desteğini kontrol et
              const audio = new Audio();
              const mp3Support = audio.canPlayType('audio/mpeg');
              const wavSupport = audio.canPlayType('audio/wav');
              
              console.log('Browser audio format support:', {
                mp3: mp3Support,
                wav: wavSupport
              });
              
              // Audio element oluştur
              audio.preload = 'auto';
              audio.volume = 1.0;
              audio.src = audioUrl;
              
              console.log('Audio element oluşturuldu ve src atandı');
              console.log('Audio properties:', {
                src: audio.src,
                volume: audio.volume,
                muted: audio.muted,
                paused: audio.paused
              });
              
              // Event listeners ekle
              audio.onloadstart = () => console.log('Audio yükleme başladı');
              audio.oncanplay = () => console.log('Audio çalmaya hazır');
              audio.onplay = () => console.log('Audio çalmaya başladı');
              audio.onended = () => {
                console.log('Audio tamamlandı');
                setIsPlayingAudio(false);
                URL.revokeObjectURL(audioUrl);
              };
              audio.onerror = (e) => {
                console.error('Audio çalma hatası:', e);
                setIsPlayingAudio(false);
                URL.revokeObjectURL(audioUrl);
                
                // Fallback: Web Audio API ile dene
                console.log('Web Audio API ile deneniyor...');
                playWithWebAudio(audioBlob);
              };
              
              try {
                console.log('Audio play() çağrılıyor...');
                await audio.play();
                console.log('Audio play() başarılı!');
              } catch (playError) {
                console.error('Audio play() hatası:', playError);
                setIsPlayingAudio(false);
                URL.revokeObjectURL(audioUrl);
                
                // Fallback: Web Audio API
                console.log('Fallback: Web Audio API kullanılıyor...');
                playWithWebAudio(audioBlob);
              }
            } else {
              console.error('Audio blob size 0');
              setIsPlayingAudio(false);
            }
          } catch (base64Error) {
            console.error('Base64 decode hatası:', base64Error);
            setIsPlayingAudio(false);
          }
        } else {
          console.error('Audio data bulunamadı');
          setIsPlayingAudio(false);
        }
      } else {
        const errorText = await ttsResponse.text();
        console.error('TTS API hatası:', ttsResponse.status, errorText);
        setIsPlayingAudio(false);
      }
    } catch (error) {
      console.error('TTS bağlantı hatası:', error);
      setIsPlayingAudio(false);
    }
  };

  // Son AI mesajını bul ve seslendir
  const playLastAIMessage = async () => {
    const lastAiMessage = conversationHistory
      .slice()
      .reverse()
      .find(msg => msg.type === 'ai');
    
    if (lastAiMessage) {
      console.log('Son AI mesajı seslendirilecek:', lastAiMessage.text);
      
      // Audio context ile önce initialize et
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log('AudioContext activated for playback');
        }
      } catch (err) {
        console.warn('AudioContext uyarısı:', err);
      }
      
      playAIResponse(lastAiMessage.text);
    } else {
      console.log('Seslendirilecek AI mesajı bulunamadı');
    }
  };

  // Test için basit mesaj seslendirme
  

  // Debug: TTS dosyasını download et
  

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

  // Centered chat interface - App themed style
  return (
    <div className="App" style={{ 
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div className="container">
        <div style={{ 
          width: '100%', 
          maxWidth: window.innerWidth > 768 ? '45%' : '80%', 
          margin: '0 auto',
          height: 'calc(100vh - 40px)', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: 'var(--card-bg)',
          borderRadius: '15px',
          boxShadow: 'var(--card-shadow)',
          overflow: 'hidden'
        }}>
      {/* Navigation Bar - App themed */}
      <div style={{
        padding: '15px 20px',
        backgroundColor: 'var(--card-bg)',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
      }}>
        <Link 
          to="/speaking" 
          className="btn"
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ArrowLeft size={16} />
          Speaking Modülü
        </Link>
        <Link 
          to="/dashboard" 
          className="btn btn-secondary"
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ArrowLeft size={16} />
          Ana Sayfa
        </Link>
      </div>

      {/* Chat Header - App themed */}
      <div style={{
        padding: '15px 20px',
        backgroundColor: 'var(--accent)',
        background: 'linear-gradient(135deg, var(--accent) 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={backToTopics}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>
            🤖
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>AI Teacher</h3>
            <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
              {selectedTopic.title}
            </p>
          </div>
        </div>
        <button 
          onClick={resetSession}
          className="btn"
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            padding: '8px 15px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
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
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        position: 'relative'
      }}>
        {/* Seslendir Butonu - Sağ üst köşe */}
        {conversationHistory.some(msg => msg.type === 'ai') && (
          <button
            onClick={playLastAIMessage}
            disabled={isPlayingAudio}
            style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              width: '45px',
              height: '45px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: isPlayingAudio ? '#ff4757' : 'var(--accent)',
              background: isPlayingAudio ? '#ff4757' : 'linear-gradient(135deg, var(--accent) 0%, #764ba2 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isPlayingAudio ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 10,
              opacity: isPlayingAudio ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!isPlayingAudio) {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            }}
            title={isPlayingAudio ? 'Ses çalınıyor...' : 'Son AI mesajını seslendir'}
          >
            {isPlayingAudio ? (
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid white',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              <Volume2 size={20} />
            )}
          </button>
        )}
        {/* Session Info */}
        {sessionStarted && (
          <div style={{
            padding: '8px 16px',
            backgroundColor: '#e3f2fd',
            borderBottom: '1px solid #bbdefb',
            fontSize: '12px',
            color: '#1976d2',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>🎤 Speaking Session: {selectedTopic?.title}</span>
            <span>Mesajlar: {sessionScores.length} | Ortalama: {sessionScores.length > 0 ? Math.round(sessionScores.reduce((sum, score) => sum + score, 0) / sessionScores.length) : 0}/100</span>
          </div>
        )}

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
                  style={{
                    width: '45px',
                    height: '45px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent)',
                    background: 'linear-gradient(135deg, var(--accent) 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    flexShrink: 0,
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    border: '2px solid rgba(255,255,255,0.2)'
                  }}
                >
                  🤖
                </div>
              )}

              {/* Message Bubble */}
              <div style={{
                padding: '12px 16px',
                borderRadius: message.type === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                backgroundColor: message.type === 'user' ? 'var(--accent)' : 'var(--card-bg)',
                background: message.type === 'user' ? 'linear-gradient(135deg, var(--accent) 0%, #764ba2 100%)' : 'var(--card-bg)',
                color: message.type === 'user' ? 'white' : 'var(--text)',
                boxShadow: 'var(--card-shadow)',
                position: 'relative',
                wordWrap: 'break-word',
                maxWidth: '100%',
                minWidth: '60px',
                border: message.type === 'ai' ? '1px solid #e5e7eb' : 'none'
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
                width: '45px',
                height: '45px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                background: 'linear-gradient(135deg, var(--accent) 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                color: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                border: '2px solid rgba(255,255,255,0.2)'
              }}>
                🤖
              </div>
              <div style={{
                padding: '12px 16px',
                borderRadius: '18px 18px 18px 4px',
                backgroundColor: 'var(--card-bg)',
                border: '1px solid #e5e7eb',
                boxShadow: 'var(--card-shadow)',
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
        padding: '15px 20px',
        backgroundColor: 'var(--card-bg)',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        {/* Voice Message Button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isRecording ? '#ff4757' : 'var(--accent)',
            background: isRecording ? '#ff4757' : 'linear-gradient(135deg, var(--accent) 0%, #764ba2 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            if (!isProcessing) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
        >
          {isRecording ? <Square size={22} /> : <Mic size={22} />}
        </button>

        {/* Status Text Input */}
        <div style={{
          flex: 1,
          backgroundColor: 'var(--bg)',
          border: '1px solid #e5e7eb',
          borderRadius: '25px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          fontSize: '15px',
          color: 'var(--muted-text)',
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
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#e5e7eb',
            color: '#9ca3af',
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
      </div>
    </div>
  );
};

export default SpeechRecording;