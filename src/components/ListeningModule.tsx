import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Headphones, Play, Pause, Volume2, Settings, Download } from 'lucide-react';

interface ListeningContent {
  transcript: string;
  questions: Array<{
    id: number;
    question: string;
    type: 'multiple_choice' | 'fill_in_blank' | 'true_false';
    options?: string[];
    correct_answer: number | string | boolean;
  }>;
  audio_script: string;
  topic: string;
  difficulty: string;
  estimated_duration: number;
}

interface TTSResponse {
  message: string;
  duration: number;
  status: string;
  audio_data?: string; // Base64 encoded audio
}

const ListeningModule: React.FC = () => {
  const [listeningContent, setListeningContent] = useState<ListeningContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [selectedTopic, setSelectedTopic] = useState('Education');
  const [selectedDifficulty, setSelectedDifficulty] = useState('intermediate');
  const [selectedAccent, setSelectedAccent] = useState('british');
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: number | string | boolean }>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);

  const topics = [
    'Education', 'Work', 'Travel', 'Health', 'Technology', 'Environment'
  ];

  const difficulties = [
    { value: 'beginner', label: 'Başlangıç' },
    { value: 'intermediate', label: 'Orta' },
    { value: 'advanced', label: 'İleri' }
  ];

  const accents = [
    { value: 'british', label: '🇬🇧 İngiliz (Adam - Doğal)' },
    { value: 'american', label: '🇺🇸 Amerikan (Bella - Doğal)' },
    { value: 'australian', label: '🇦🇺 Avustralya (Arnold - Doğal)' }
  ];

  const generateListening = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('http://localhost:8003/generate-listening', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: selectedTopic,
          difficulty: selectedDifficulty,
          duration: 180,
          accent: selectedAccent
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setListeningContent(data);
        setUserAnswers({});
        setShowResults(false);
        setShowTranscript(false); // Yeni listening oluşturulduğunda metni gizle
      } else {
        alert('Listening içeriği oluşturulamadı!');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Bağlantı hatası!');
    } finally {
      setIsGenerating(false);
    }
  };

  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      // currentTime = 0 kaldırdık, kaldığı yerden devam etsin
      setCurrentAudio(null);
    }
    setIsPlaying(false);
  };

  const playText = async (text: string) => {
    // Eğer zaten çalıyorsa durdur
    if (isPlaying) {
      stopAudio();
      return;
    }

    // Eğer ses zaten yüklenmişse, kaldığı yerden devam et
    if (currentAudio && currentAudio.paused) {
      currentAudio.play();
      setIsPlaying(true);
      return;
    }

    setIsGeneratingAudio(true);
    try {
      // Önce ElevenLabs TTS'i dene (en doğal ses)
      let response = await fetch('http://localhost:8003/elevenlabs-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          accent: selectedAccent,
          speed: 1.0
        }),
      });

      if (response.ok) {
        const data: TTSResponse = await response.json();
        console.log('ElevenLabs TTS Response:', data);
        
        // Eğer audio_data varsa, ses dosyasını oynat
        if (data.audio_data) {
          const audioBlob = new Blob([Uint8Array.from(atob(data.audio_data), c => c.charCodeAt(0))], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          setCurrentAudio(audio);
          
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            setCurrentAudio(null);
            setIsPlaying(false);
          };

          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            setCurrentAudio(null);
            setIsPlaying(false);
            alert('Ses oynatılırken hata oluştu!');
          };

          await audio.play();
          setIsGeneratingAudio(false);
          setIsPlaying(true);
        } else {
          setIsGeneratingAudio(false);
        }
      } else {
        // ElevenLabs TTS çalışmazsa, Enhanced TTS'e geri dön
        response = await fetch('http://localhost:8003/enhanced-tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            accent: selectedAccent,
            speed: 1.0
          }),
        });

        if (response.ok) {
          const data: TTSResponse = await response.json();
          console.log('Enhanced TTS Response:', data);
        } else {
          alert('Ses oynatılamadı!');
        }
        setIsGeneratingAudio(false);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Bağlantı hatası!');
      setIsGeneratingAudio(false);
    }
  };

  const handleAnswerSelect = (questionId: number, answer: number | string | boolean) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const checkAnswers = () => {
    if (!listeningContent) return;

    let correctCount = 0;
    listeningContent.questions.forEach(question => {
      const userAnswer = userAnswers[question.id];
      const correctAnswer = question.correct_answer;
      
      // Farklı soru tiplerini kontrol et
      if (question.type === 'fill_in_blank') {
        // Boşluk doldurma için case-insensitive karşılaştırma
        if (typeof userAnswer === 'string' && typeof correctAnswer === 'string') {
          if (userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()) {
            correctCount++;
          }
        }
      } else {
        // Multiple choice ve true/false için normal karşılaştırma
        if (userAnswer === correctAnswer) {
          correctCount++;
        }
      }
    });

    const calculatedScore = Math.round((correctCount / listeningContent.questions.length) * 100);
    setScore(calculatedScore);
    setShowResults(true);
  };

  return (
    <div className="container">
      <div className="card">
        <div className="mb-4">
          <Link to="/" className="btn mb-2">
            <ArrowLeft style={{ marginRight: '8px' }} />
            Ana Sayfaya Dön
          </Link>
          <h1 className="module-header">
            <Headphones />
            Listening Modülü
          </h1>
        </div>

        {/* Ayarlar */}
        <div className="card mb-4">
          <h3>⚙️ Ayarlar</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div>
              <label>Konu:</label>
              <select 
                value={selectedTopic} 
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="form-control"
              >
                {topics.map(topic => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Zorluk:</label>
              <select 
                value={selectedDifficulty} 
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="form-control"
              >
                {difficulties.map(diff => (
                  <option key={diff.value} value={diff.value}>{diff.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Aksan (ElevenLabs TTS):</label>
              <select 
                value={selectedAccent} 
                onChange={(e) => setSelectedAccent(e.target.value)}
                className="form-control"
              >
                {accents.map(accent => (
                  <option key={accent.value} value={accent.value}>{accent.label}</option>
                ))}
              </select>
              <small style={{ color: '#666', fontSize: '12px' }}>
                Her aksan için özel doğal ses kullanılır
              </small>
            </div>
          </div>
          <button 
            onClick={generateListening} 
            disabled={isGenerating}
            className="btn btn-primary mt-3"
          >
            {isGenerating ? 'Oluşturuluyor...' : '🎧 Yeni Listening Oluştur'}
          </button>
        </div>

        {/* Listening İçeriği */}
        {listeningContent && (
          <div className="card mb-4">
            <h3>📝 {listeningContent.topic} - {listeningContent.difficulty}</h3>
            <p><strong>Tahmini Süre:</strong> {Math.round(listeningContent.estimated_duration / 60)} dakika</p>
            
            <div className="mb-3">
              <button 
                onClick={() => playText(listeningContent.audio_script)}
                disabled={isGeneratingAudio}
                className="btn btn-success"
              >
                {isGeneratingAudio ? (
                  <>⏳ Ses üretiliyor...</>
                ) : isPlaying ? (
                  <><Pause /> Durdur</>
                ) : currentAudio ? (
                  <><Play /> Devam Et</>
                ) : (
                  <><Play /> Dinle</>
                )}
              </button>
              {isGeneratingAudio && (
                <span style={{ marginLeft: '10px', color: '#ffc107', fontSize: '14px' }}>
                  🎵 {selectedAccent === 'british' ? 'İngiliz' : selectedAccent === 'american' ? 'Amerikan' : 'Avustralya'} aksanında ses üretiliyor... (10-15 saniye)
                </span>
              )}
              {isPlaying && (
                <span style={{ marginLeft: '10px', color: '#28a745', fontSize: '14px' }}>
                  🔊 {selectedAccent === 'british' ? 'İngiliz' : selectedAccent === 'american' ? 'Amerikan' : 'Avustralya'} aksanında oynatılıyor...
                </span>
              )}
            </div>

            <div className="mb-4">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <h4 style={{ margin: 0 }}>📄 Metin:</h4>
                <button 
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="btn"
                  style={{ 
                    padding: '5px 15px', 
                    fontSize: '12px',
                    background: showTranscript ? '#dc3545' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {showTranscript ? '👁️ Gizle' : '👁️ Göster'}
                </button>
              </div>
              {showTranscript && (
                <div style={{ 
                  backgroundColor: '#f8f9fa', 
                  padding: '15px', 
                  borderRadius: '8px',
                  border: '1px solid #dee2e6',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {listeningContent.audio_script}
                </div>
              )}
              {!showTranscript && (
                <div style={{ 
                  backgroundColor: '#e9ecef', 
                  padding: '15px', 
                  borderRadius: '8px',
                  border: '1px solid #dee2e6',
                  textAlign: 'center',
                  color: '#6c757d',
                  fontStyle: 'italic'
                }}>
                  Metin gizli - "Göster" butonuna tıklayarak görüntüleyebilirsin
                </div>
              )}
            </div>

            {/* Sorular */}
            <div className="mb-4">
              <h4>❓ Sorular:</h4>
              {listeningContent.questions.map((question, index) => (
                <div key={question.id} className="mb-3" style={{ 
                  padding: '15px', 
                  border: '1px solid #dee2e6', 
                  borderRadius: '8px' 
                }}>
                  <p><strong>{index + 1}. {question.question}</strong></p>
                  
                  {/* Multiple Choice Sorular */}
                  {question.type === 'multiple_choice' && question.options && (
                    <div>
                      {question.options.map((option, optionIndex) => (
                        <label key={optionIndex} style={{ display: 'block', margin: '5px 0' }}>
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={optionIndex}
                            checked={userAnswers[question.id] === optionIndex}
                            onChange={() => handleAnswerSelect(question.id, optionIndex)}
                            style={{ marginRight: '8px' }}
                          />
                          {String.fromCharCode(65 + optionIndex)}. {option}
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Boşluk Doldurma Sorular */}
                  {question.type === 'fill_in_blank' && (
                    <div>
                      <input
                        type="text"
                        value={typeof userAnswers[question.id] === 'string' ? userAnswers[question.id] as string : ''}
                        onChange={(e) => handleAnswerSelect(question.id, e.target.value)}
                        placeholder="Cevabınızı yazın..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px',
                          marginTop: '5px'
                        }}
                      />
                    </div>
                  )}

                  {/* Doğru/Yanlış Sorular */}
                  {question.type === 'true_false' && (
                    <div>
                      <label style={{ display: 'block', margin: '5px 0' }}>
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value="true"
                          checked={userAnswers[question.id] === true}
                          onChange={() => handleAnswerSelect(question.id, true)}
                          style={{ marginRight: '8px' }}
                        />
                        True (Doğru)
                      </label>
                      <label style={{ display: 'block', margin: '5px 0' }}>
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value="false"
                          checked={userAnswers[question.id] === false}
                          onChange={() => handleAnswerSelect(question.id, false)}
                          style={{ marginRight: '8px' }}
                        />
                        False (Yanlış)
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button 
              onClick={checkAnswers}
              className="btn btn-primary"
              disabled={Object.keys(userAnswers).length !== listeningContent.questions.length}
            >
              📊 Cevapları Kontrol Et
            </button>

            {/* Sonuçlar */}
            {showResults && (
              <div className="mt-4" style={{ 
                padding: '20px', 
                backgroundColor: score >= 70 ? '#d4edda' : '#f8d7da',
                border: `1px solid ${score >= 70 ? '#c3e6cb' : '#f5c6cb'}`,
                borderRadius: '8px'
              }}>
                <h4>🎯 Sonuçlar</h4>
                <p><strong>Puanınız:</strong> {score}/100</p>
                <p><strong>Durum:</strong> {score >= 70 ? '✅ Başarılı' : '❌ Tekrar Deneyin'}</p>
                
                <div className="mt-3">
                  <h5>Doğru Cevaplar:</h5>
                  {listeningContent.questions.map((question, index) => {
                    const userAnswer = userAnswers[question.id];
                    const correctAnswer = question.correct_answer;
                    
                    let isCorrect = false;
                    let correctAnswerText = '';
                    
                    if (question.type === 'fill_in_blank') {
                      if (typeof userAnswer === 'string' && typeof correctAnswer === 'string') {
                        isCorrect = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
                      }
                      correctAnswerText = correctAnswer as string;
                    } else if (question.type === 'true_false') {
                      isCorrect = userAnswer === correctAnswer;
                      correctAnswerText = correctAnswer ? 'True' : 'False';
                    } else {
                      isCorrect = userAnswer === correctAnswer;
                      // Multiple choice için doğru seçeneği göster
                      if (question.type === 'multiple_choice') {
                        const correctIndex = correctAnswer as number;
                        if (question.options && question.options.length > 0 && correctIndex >= 0 && correctIndex < question.options.length) {
                          const optionText = question.options[correctIndex];
                          correctAnswerText = `${String.fromCharCode(65 + correctIndex)}. ${optionText}`;
                        } else {
                          // Fallback: sadece harfi göster
                          correctAnswerText = `${String.fromCharCode(65 + correctIndex)}`;
                        }
                      } else {
                        correctAnswerText = `${String.fromCharCode(65 + (correctAnswer as number))}`;
                      }
                    }
                    
                    return (
                      <div key={question.id} style={{ 
                        margin: '5px 0',
                        color: isCorrect ? '#155724' : '#721c24'
                      }}>
                        <strong>{index + 1}.</strong> {isCorrect ? '✅' : '❌'} 
                        Doğru cevap: {correctAnswerText}
                        {!isCorrect && userAnswer !== undefined && (
                          <span style={{ color: '#721c24' }}>
                            {' '}(Senin cevabın: {
                              typeof userAnswer === 'boolean' 
                                ? (userAnswer ? 'True' : 'False')
                                : typeof userAnswer === 'number' && question.type === 'multiple_choice'
                                ? `${String.fromCharCode(65 + userAnswer)}. ${question.options?.[userAnswer] || ''}`
                                : userAnswer
                            })
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Örnek İçerik */}
        {!listeningContent && (
          <div className="card">
            <h3>🎧 Nasıl Çalışır?</h3>
            <ol>
              <li>Yukarıdaki ayarlardan konu, zorluk ve aksan seçin</li>
              <li>"Yeni Listening Oluştur" butonuna tıklayın</li>
              <li>AI tarafından oluşturulan metni dinleyin (metin başta gizli)</li>
              <li>İstersen "Göster" butonuyla metni görüntüleyebilirsin</li>
              <li>Soruları cevaplayın</li>
              <li>Sonuçlarınızı görün</li>
            </ol>
            <div style={{ 
              backgroundColor: '#e7f3ff', 
              padding: '15px', 
              borderRadius: '8px', 
              marginTop: '15px',
              border: '1px solid #b3d9ff'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#0066cc' }}>💡 İpuçları:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>Metin başta gizli - gerçek IELTS gibi dinle</li>
                <li>Durdur/Devam Et ile istediğin zaman kontrol et</li>
                <li>Farklı aksanları dene - gerçek sınavda karşılaşabilirsin</li>
                <li>Çoklu soru tipleri: Çoktan seçmeli, boşluk doldurma, doğru/yanlış</li>
                <li>Boşluk doldurma için büyük/küçük harf önemli değil</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListeningModule;

