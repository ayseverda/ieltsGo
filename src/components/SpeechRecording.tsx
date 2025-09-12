import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mic, Square, Volume2, Loader2 } from 'lucide-react';

interface SpeechRecordingProps {}

const SpeechRecording: React.FC<SpeechRecordingProps> = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [error, setError] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Check for microphone access on component mount
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        // Release the stream right away, we just want to check access
        stream.getTracks().forEach(track => track.stop());
      })
      .catch(err => {
        setError('Mikrofon erişimi mevcut değil. Lütfen tarayıcı ayarlarından mikrofon iznini kontrol edin.');
      });
  }, []);

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Clear previous chunks
      audioChunksRef.current = [];
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm' // Explicitly set mime type
      });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Audio chunk received, size:', event.data.size);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        console.log('Recording stopped, processing...');
        processRecording();
      };
      
      // Start recording and collect data every 1 second (1000ms)
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      console.log('Recording started...');
    } catch (error) {
      console.error('Start recording error:', error);
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
      // Check if we have audio chunks
      if (audioChunksRef.current.length === 0) {
        throw new Error('Ses kaydedilemedi, ses parçaları bulunamadı');
      }
      
      // Convert audio to base64
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Debug: Check audio blob size
      console.log('Audio Blob size:', audioBlob.size, 'bytes');
      if (audioBlob.size < 100) { // Arbitrary small size threshold
        throw new Error('Ses dosyası çok küçük, kayıt düzgün yapılmamış olabilir');
      }
      
      const base64Audio = await blobToBase64(audioBlob);
      console.log('Base64 audio length:', base64Audio.length);
      
      console.log('Sending audio to speech-to-text API...');
      
      // Send to speech-to-text API
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
      
      const sttResponseText = await sttResponse.text();
      console.log('STT Response status:', sttResponse.status);
      console.log('STT Response text:', sttResponseText);
      
      if (!sttResponse.ok) {
        throw new Error(`Ses tanıma başarısız: ${sttResponse.status} - ${sttResponseText}`);
      }
      
      const sttResult = JSON.parse(sttResponseText);
      console.log('STT Result:', sttResult);
      
      if (!sttResult.text || sttResult.text.trim() === '') {
        throw new Error('Ses tanıma boş metin döndürdü');
      }
      
      setTranscribedText(sttResult.text);
      
      console.log('Sending text to AI response API:', sttResult.text);
      
      // Get AI response
      const aiResponse = await fetch('http://localhost:8000/api/speaking/ai-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: sttResult.text
        }),
      });
      
      const aiResponseText = await aiResponse.text();
      console.log('AI Response status:', aiResponse.status);
      console.log('AI Response text:', aiResponseText);
      
      if (!aiResponse.ok) {
        throw new Error(`AI yanıtı alınamadı: ${aiResponse.status} - ${aiResponseText}`);
      }
      
      const aiResult = JSON.parse(aiResponseText);
      console.log('AI Result:', aiResult);
      
      if (!aiResult.response) {
        throw new Error('AI boş yanıt döndürdü');
      }
      
      setAiResponse(aiResult.response);
      
    } catch (error) {
      console.error('Process recording error:', error);
      setError(error instanceof Error ? error.message : 'İşlem başarısız');
    } finally {
      setIsProcessing(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Base64 dönüşümü başarısız'));
        }
      };
      reader.onerror = () => reject(new Error('Dosya okuma hatası'));
      reader.readAsDataURL(blob);
    });
  };

  const playAIResponse = async () => {
    if (!aiResponse) return;
    
    setIsPlayingAudio(true);
    setError('');
    
    try {
      const ttsResponse = await fetch('http://localhost:8000/api/speaking/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: aiResponse
        }),
      });
      
      if (!ttsResponse.ok) {
        throw new Error('Ses sentezi başarısız');
      }
      
      const ttsResult = await ttsResponse.json();
      
      // Convert base64 to audio and play
      const binaryString = atob(ttsResult.audio_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
      }
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ses çalma başarısız');
      setIsPlayingAudio(false);
    }
  };

  const resetSession = () => {
    setTranscribedText('');
    setAiResponse('');
    setError('');
    setIsProcessing(false);
    setIsPlayingAudio(false);
  };

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
            Konuşma Kaydı
          </h1>
        </div>

        {error && (
          <div style={{ 
            backgroundColor: '#fee', 
            color: '#c33', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '20px' 
          }}>
            {error}
          </div>
        )}

        <div className="grid">
          {/* Recording Section */}
          <div className="card">
            <h3>🎤 Kayıt</h3>
            <p>
              {isRecording ? 'Kayıt yapılıyor...' : 'Konuşmanızı kaydetmek için başlat düğmesine basın'}
            </p>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {!isRecording ? (
                <button 
                  className="btn" 
                  onClick={startRecording}
                  disabled={isProcessing}
                >
                  <Mic style={{ marginRight: '8px' }} />
                  Kayda Başla
                </button>
              ) : (
                <button 
                  className="btn btn-danger" 
                  onClick={stopRecording}
                  style={{ backgroundColor: '#dc3545', color: 'white' }}
                >
                  <Square style={{ marginRight: '8px' }} />
                  Kaydı Durdur
                </button>
              )}
              
              {isProcessing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={20} />
                  <span>İşleniyor...</span>
                </div>
              )}
            </div>
          </div>

          {/* Transcription Section */}
          <div className="card">
            <h3>📝 Konuşmanız</h3>
            {transcribedText ? (
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '15px', 
                borderRadius: '8px',
                minHeight: '80px'
              }}>
                <p><strong>Söylediğiniz:</strong></p>
                <p>"{transcribedText}"</p>
              </div>
            ) : (
              <p>Henüz kayıt yapılmadı.</p>
            )}
          </div>

          {/* AI Response Section */}
          <div className="card">
            <h3>🤖 AI Yanıtı</h3>
            {aiResponse ? (
              <div>
                <div style={{ 
                  backgroundColor: '#e8f5e8', 
                  padding: '15px', 
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <p><strong>AI Öğretmen:</strong></p>
                  <p>{aiResponse}</p>
                </div>
                
                <button 
                  className="btn btn-secondary" 
                  onClick={playAIResponse}
                  disabled={isPlayingAudio}
                >
                  <Volume2 style={{ marginRight: '8px' }} />
                  {isPlayingAudio ? 'Oynatılıyor...' : 'Sesli Dinle'}
                </button>
              </div>
            ) : (
              <p>AI yanıtı için önce bir kayıt yapın.</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button 
            className="btn btn-success" 
            onClick={resetSession}
            disabled={isRecording || isProcessing}
          >
            Yeni Konuşma Başlat
          </button>
        </div>

        {/* Hidden audio element for playback */}
        <audio
          ref={audioRef}
          onEnded={() => setIsPlayingAudio(false)}
          style={{ display: 'none' }}
        />
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .btn-danger {
          background-color: #dc3545 !important;
          color: white !important;
          border-color: #dc3545 !important;
        }
        
        .btn-danger:hover {
          background-color: #c82333 !important;
          border-color: #bd2130 !important;
        }
      `}</style>
    </div>
  );
};

export default SpeechRecording;
