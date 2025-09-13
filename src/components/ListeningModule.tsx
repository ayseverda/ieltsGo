import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Headphones, Play, Pause, Volume2, Settings, Download, Clock } from 'lucide-react';

interface ListeningSection {
  id: number;
  title: string;
  description: string;
  audio_script: string;
  questions: Array<{
    id: number;
    question: string;
    type: 'multiple_choice' | 'fill_in_blank' | 'true_false' | 'matching' | 'form_completion' | 'note_completion' | 'sentence_completion';
    options?: string[];
    correct_answer: number | string | boolean;
    word_limit?: number;
  }>;
  duration: number; // dakika
}

interface ListeningContent {
  sections: ListeningSection[];
  total_questions: number;
  total_duration: number; // dakika
  topic: string;
  difficulty: string;
  instructions: string;
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
  const [currentSection, setCurrentSection] = useState(0);
  const [testStarted, setTestStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

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
      const response = await fetch('http://localhost:8003/generate-ielts-listening', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: selectedTopic,
          difficulty: selectedDifficulty,
          accent: selectedAccent
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setListeningContent(data);
        setUserAnswers({});
        setShowResults(false);
        setShowTranscript(false);
        setCurrentSection(0);
        setTestStarted(false);
        setTimeLeft(data.total_duration * 60); // dakikayı saniyeye çevir
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

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (testStarted && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Süre bitti
            setTestStarted(false);
            checkAnswers();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [testStarted, isPaused, timeLeft]);

  const startTest = () => {
    setTestStarted(true);
    setIsPaused(false);
  };

  const pauseTest = () => {
    setIsPaused(!isPaused);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const nextSection = () => {
    if (listeningContent && currentSection < listeningContent.sections.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  };

  const prevSection = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const checkAnswers = () => {
    if (!listeningContent) return;

    let correctCount = 0;
    let totalQuestions = 0;

    listeningContent.sections.forEach(section => {
      section.questions.forEach(question => {
        totalQuestions++;
        const userAnswer = userAnswers[question.id];
        const correctAnswer = question.correct_answer;
        
        // Farklı soru tiplerini kontrol et
        if (question.type === 'fill_in_blank' || question.type === 'form_completion' || 
            question.type === 'note_completion' || question.type === 'sentence_completion') {
          // Boşluk doldurma için case-insensitive karşılaştırma
          if (typeof userAnswer === 'string' && typeof correctAnswer === 'string') {
            if (userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()) {
              correctCount++;
            }
          }
        } else {
          // Multiple choice, true/false, matching için normal karşılaştırma
          if (userAnswer === correctAnswer) {
            correctCount++;
          }
        }
      });
    });

    const calculatedScore = Math.round((correctCount / totalQuestions) * 100);
    setScore(calculatedScore);
    setShowResults(true);
    setTestStarted(false);
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
        {listeningContent && !testStarted && (
          <div className="card mb-4">
            <h3>📝 IELTS Listening Test - {listeningContent.topic}</h3>
            <p><strong>Toplam Süre:</strong> {listeningContent.total_duration} dakika</p>
            <p><strong>Toplam Soru:</strong> {listeningContent.total_questions} soru</p>
            <p><strong>Bölüm Sayısı:</strong> {listeningContent.sections.length} bölüm</p>
            
            <div className="ielts-instructions">
              <h4>📋 Sınav Talimatları:</h4>
              <p>{listeningContent.instructions}</p>
            </div>

            <div className="sections-overview">
              <h4>📚 Bölümler:</h4>
              {listeningContent.sections.map((section, index) => (
                <div key={section.id} className="section-preview">
                  <h5>Bölüm {section.id}: {section.title}</h5>
                  <p>{section.description}</p>
                  <p><strong>Soru Sayısı:</strong> {section.questions.length} | <strong>Süre:</strong> {section.duration} dakika</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-4">
              <button 
                onClick={startTest}
                className="btn btn-primary"
                style={{ fontSize: '1.2rem', padding: '15px 30px' }}
              >
                🎧 Sınavı Başlat
              </button>
            </div>
          </div>
        )}

        {/* Sınav Arayüzü */}
        {listeningContent && testStarted && (
          <div className="card mb-4">
            {/* Sınav Header */}
            <div className="exam-header">
              <div className="exam-info">
                <h3>🎧 IELTS Listening Test</h3>
                <p>Bölüm {currentSection + 1} / {listeningContent.sections.length}</p>
              </div>
              
              <div className="exam-controls">
                <div className="timer-display">
                  <Clock className="icon" />
                  <span className="timer-text">{formatTime(timeLeft)}</span>
                </div>
                
                <div className="control-buttons">
                  <button 
                    className="btn btn-secondary"
                    onClick={pauseTest}
                  >
                    {isPaused ? <Play className="icon" /> : <Pause className="icon" />}
                    {isPaused ? 'Devam Et' : 'Duraklat'}
                  </button>
                  
                  <button 
                    className="btn btn-danger"
                    onClick={checkAnswers}
                  >
                    Sınavı Bitir
                  </button>
                </div>
              </div>
            </div>

            {/* Mevcut Bölüm */}
            {listeningContent.sections[currentSection] && (
              <div className="current-section">
                <h4>Bölüm {listeningContent.sections[currentSection].id}: {listeningContent.sections[currentSection].title}</h4>
                <p>{listeningContent.sections[currentSection].description}</p>
                
                <div className="section-controls">
                  <button 
                    onClick={() => playText(listeningContent.sections[currentSection].audio_script)}
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
                  <div className="transcript">
                    <h5>📄 Metin:</h5>
                    <div className="transcript-content">
                      {listeningContent.sections[currentSection].audio_script}
                    </div>
                  </div>
                )}

                {/* Bölüm Soruları */}
                <div className="section-questions">
                  <h5>❓ Sorular:</h5>
                  {listeningContent.sections[currentSection].questions.map((question, index) => (
                    <div key={question.id} className="question-item">
                      <p><strong>{index + 1}. {question.question}</strong></p>
                      
                      {/* Multiple Choice Sorular */}
                      {question.type === 'multiple_choice' && question.options && (
                        <div>
                          {question.options.map((option, optionIndex) => (
                            <label key={optionIndex} className="option-label">
                              <input
                                type="radio"
                                name={`question-${question.id}`}
                                value={optionIndex}
                                checked={userAnswers[question.id] === optionIndex}
                                onChange={() => handleAnswerSelect(question.id, optionIndex)}
                              />
                              {String.fromCharCode(65 + optionIndex)}. {option}
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Boşluk Doldurma Sorular */}
                      {(question.type === 'fill_in_blank' || question.type === 'form_completion' || 
                        question.type === 'note_completion' || question.type === 'sentence_completion') && (
                        <div>
                          <input
                            type="text"
                            value={typeof userAnswers[question.id] === 'string' ? userAnswers[question.id] as string : ''}
                            onChange={(e) => handleAnswerSelect(question.id, e.target.value)}
                            placeholder={`Cevabınızı yazın${question.word_limit ? ` (max ${question.word_limit} kelime)` : ''}...`}
                            className="answer-input"
                          />
                        </div>
                      )}

                      {/* Doğru/Yanlış Sorular */}
                      {question.type === 'true_false' && (
                        <div>
                          <label className="option-label">
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value="true"
                              checked={userAnswers[question.id] === true}
                              onChange={() => handleAnswerSelect(question.id, true)}
                            />
                            True (Doğru)
                          </label>
                          <label className="option-label">
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value="false"
                              checked={userAnswers[question.id] === false}
                              onChange={() => handleAnswerSelect(question.id, false)}
                            />
                            False (Yanlış)
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bölüm Navigasyonu */}
                <div className="section-navigation">
                  <button 
                    className="btn btn-secondary"
                    onClick={prevSection}
                    disabled={currentSection === 0}
                  >
                    ← Önceki Bölüm
                  </button>
                  
                  <span className="section-indicator">
                    Bölüm {currentSection + 1} / {listeningContent.sections.length}
                  </span>
                  
                  <button 
                    className="btn btn-primary"
                    onClick={nextSection}
                    disabled={currentSection === listeningContent.sections.length - 1}
                  >
                    Sonraki Bölüm →
                  </button>
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

