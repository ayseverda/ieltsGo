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
  const [ieltsBandScore, setIeltsBandScore] = useState(0);
  const [rawScore, setRawScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [wrongQuestions, setWrongQuestions] = useState<any[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [testStarted, setTestStarted] = useState(false);

  const topics = [
    'Education', 'Work', 'Travel', 'Health', 'Technology', 'Environment'
  ];

  const difficulties = [
    { value: 'beginner', label: 'Başlangıç' },
    { value: 'intermediate', label: 'Orta' },
    { value: 'advanced', label: 'İleri' }
  ];

  const accents = [
    { value: 'british', label: '🇬🇧 İngiliz (Speaker 1: Adam, Speaker 2: Bella)' },
    { value: 'american', label: '🇺🇸 Amerikan (Speaker 1: Arnold, Speaker 2: Bella)' },
    { value: 'australian', label: '🇦🇺 Avustralya (Speaker 1: Adam, Speaker 2: Bella)' },
    { value: 'canadian', label: '🇨🇦 Kanada (Speaker 1: Arnold, Speaker 2: Bella)' },
    { value: 'irish', label: '🇮🇪 İrlanda (Speaker 1: Adam, Speaker 2: Bella)' }
  ];

  const generateListening = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('http://localhost:8003/generate-ielts-listening-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: selectedTopic,
          difficulty: selectedDifficulty,
          accent: selectedAccent,
          section_type: 'section_1' // Tek bölüm için
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setListeningContent(data);
        setUserAnswers({});
        setShowResults(false);
        setShowTranscript(false);
        setTestStarted(false);
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
      // İki kişi konuşması olup olmadığını kontrol et
      const isDialogue = text.toLowerCase().includes('speaker') || 
                        text.toLowerCase().includes('person') ||
                        text.includes('A:') || text.includes('B:') ||
                        (text.split('\n').length > 3 && text.includes(':'));

      let response;
      
      if (isDialogue) {
        // İki kişi konuşması için dialogue TTS kullan
        response = await fetch('http://localhost:8003/dialogue-tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            accent: selectedAccent
          }),
        });
      } else {
        // Tek kişi için normal TTS
        response = await fetch('http://localhost:8003/elevenlabs-tts', {
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
      }

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

  // Timer effect kaldırıldı - kullanıcı kontrolü

  const startTest = () => {
    // Test bitirildiyse yeni test başlatma
    if (showResults) {
      return;
    }
    setTestStarted(true);
    setShowTranscript(false);
  };

  const saveScoreToDatabase = async (scoreData: any) => {
    try {
      console.log('💾 Puan kaydetme başlatılıyor...', scoreData);
      
      const token = localStorage.getItem('token');
      console.log('🔑 Token kontrolü:', token ? 'Token var' : 'Token yok');
      
      if (!token) {
        console.log('❌ Kullanıcı giriş yapmamış, puan kaydedilmiyor');
        return;
      }

      console.log('📤 Backend\'e gönderiliyor:', {
        url: 'http://localhost:8000/api/save-score',
        data: scoreData
      });

      const response = await fetch('http://localhost:8000/api/save-score', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(scoreData),
      });

      console.log('📥 Backend yanıtı:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Puan başarıyla kaydedildi:', result);
      } else {
        const errorText = await response.text();
        console.error('❌ Puan kaydetme hatası:', errorText);
      }
    } catch (error) {
      console.error('❌ Puan kaydetme hatası:', error);
    }
  };

  const checkAnswers = async () => {
    if (!listeningContent) return;

    try {
      // Tüm soruları ve cevapları topla
      const allQuestions: any[] = [];
      const allUserAnswers: string[] = [];

      listeningContent.sections.forEach(section => {
        section.questions.forEach(question => {
          allQuestions.push(question);
          const userAnswer = userAnswers[question.id];
          allUserAnswers.push(userAnswer ? String(userAnswer) : "");
        });
      });

      // Backend'e puanlama isteği gönder
      const response = await fetch('http://localhost:8003/evaluate-ielts-listening', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_file_path: '', // Bu endpoint'te kullanılmıyor
          questions: allQuestions,
          user_answers: allUserAnswers,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setScore(result.score);
        setIeltsBandScore(result.ielts_band_score);
        setRawScore(result.raw_score);
        setTotalQuestions(result.total_questions);
        setFeedback(result.feedback);
        setWrongQuestions(result.detailed_analysis.wrong_questions || []);
        setShowResults(true);
        setTestStarted(false);

        // Puanı veritabanına kaydet
        await saveScoreToDatabase({
          module: 'listening',
          band_score: result.ielts_band_score,
          raw_score: result.raw_score,
          total_questions: result.total_questions,
          topic: selectedTopic,
          difficulty: selectedDifficulty,
          accent: selectedAccent,
          detailed_results: {
            feedback: result.feedback,
            wrong_questions: result.detailed_analysis.wrong_questions || []
          }
        });
      } else {
        throw new Error('Puanlama hatası');
      }
    } catch (error) {
      console.error('Puanlama hatası:', error);
      // Fallback - local puanlama
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
      const fallbackBandScore = Math.max(1.0, Math.min(9.0, (correctCount / totalQuestions) * 9));
      
      setScore(calculatedScore);
      setIeltsBandScore(fallbackBandScore);
      setRawScore(correctCount);
      setTotalQuestions(totalQuestions);
      setFeedback('Puanlama servisi geçici olarak kullanılamıyor. Tahmini puan gösteriliyor.');
      setShowResults(true);
      setTestStarted(false);

      // Fallback puanını da kaydet
      await saveScoreToDatabase({
        module: 'listening',
        band_score: fallbackBandScore,
        raw_score: correctCount,
        total_questions: totalQuestions,
        topic: selectedTopic,
        difficulty: selectedDifficulty,
        accent: selectedAccent,
        detailed_results: {
          feedback: 'Puanlama servisi geçici olarak kullanılamıyor. Tahmini puan gösteriliyor.',
          wrong_questions: []
        }
      });
    }
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
            <p><strong>Toplam Soru:</strong> {listeningContent.total_questions} soru</p>
            
            <div className="ielts-instructions">
              <h4>📋 Talimatlar:</h4>
              <p>1. "Başla" butonuna tıklayın</p>
              <p>2. Ses kaydını dinleyin (metin başta gizli)</p>
              <p>3. 10 soruyu cevaplayın</p>
              <p>4. İstediğiniz zaman durabilir veya bitirebilirsiniz</p>
            </div>

            <div className="text-center mt-4">
              <button 
                onClick={startTest}
                className="btn btn-primary"
                style={{ 
                  fontSize: '1.2rem', 
                  padding: '15px 30px',
                  opacity: showResults ? 0.5 : 1,
                  cursor: showResults ? 'not-allowed' : 'pointer'
                }}
                disabled={showResults}
              >
                🎧 Başla
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
                <h3>🎧 IELTS Listening Test - {listeningContent.topic}</h3>
                <p>10 soru | İstediğiniz zaman durabilir veya bitirebilirsiniz</p>
              </div>
            </div>

            {/* Mevcut Bölüm */}
            {listeningContent.sections[0] && (
              <div className="current-section">
                <h4>🎧 Dinleme Metni</h4>
                
                <div className="section-controls">
                  <button 
                    onClick={() => playText(listeningContent.sections[0].audio_script)}
                    disabled={isGeneratingAudio}
                    className="btn btn-success"
                    style={{ marginRight: '10px' }}
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
                    onClick={() => {
                      setShowTranscript(!showTranscript);
                      // Transcript gösterildiğinde scroll'u en üste götür
                      if (!showTranscript) {
                        setTimeout(() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }, 100);
                      }
                    }}
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
                    {showTranscript ? '👁️ Metni Gizle' : '👁️ Metni Göster'}
                  </button>
                </div>

                {showTranscript && (
                  <div className="transcript">
                    <h5>📄 Metin:</h5>
                    <div className="transcript-content">
                      {listeningContent.sections[0].audio_script}
                    </div>
                  </div>
                )}

                {/* Bölüm Soruları */}
                <div className="section-questions">
                  <h5>❓ Sorular (10 soru):</h5>
                  {listeningContent.sections[0].questions.map((question, index) => (
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
                            True
                          </label>
                          <label className="option-label">
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value="false"
                              checked={userAnswers[question.id] === false}
                              onChange={() => handleAnswerSelect(question.id, false)}
                            />
                            False
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Test Bitirme Butonu */}
                <div className="text-center mt-4">
                  <button 
                    className="btn btn-primary"
                    onClick={checkAnswers}
                    style={{ fontSize: '1.2rem', padding: '15px 30px' }}
                  >
                    ✅ Testi Bitir ve Sonuçları Gör
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sonuçlar */}
        {showResults && (
          <div className="card" style={{ backgroundColor: '#f8f9fa', border: '2px solid #28a745' }}>
            <h3 style={{ color: '#28a745', marginBottom: '20px' }}>🎉 Test Tamamlandı!</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <h4 style={{ color: '#007bff', margin: '0 0 10px 0' }}>📊 Puanınız</h4>
                <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#007bff' }}>{score}%</div>
                <div style={{ fontSize: '0.9em', color: '#6c757d' }}>Doğru Cevap Oranı</div>
              </div>
              
              <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <h4 style={{ color: '#28a745', margin: '0 0 10px 0' }}>🏆 IELTS Band Score</h4>
                <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#28a745' }}>{ieltsBandScore}</div>
                <div style={{ fontSize: '0.9em', color: '#6c757d' }}>Resmi IELTS Puanı</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#495057' }}>
                Doğru: {rawScore} / {totalQuestions} soru
              </div>
            </div>

            {feedback && (
              <div style={{ backgroundColor: '#e7f3ff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #b3d9ff' }}>
                <h5 style={{ color: '#0066cc', margin: '0 0 10px 0' }}>💬 Geri Bildirim:</h5>
                <p style={{ margin: 0, color: '#495057' }}>{feedback}</p>
              </div>
            )}

            {wrongQuestions.length > 0 && (
              <div style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ffeaa7' }}>
                <h5 style={{ color: '#856404', margin: '0 0 15px 0' }}>❌ Yanlış Yapılan Sorular:</h5>
                {wrongQuestions.map((wrongQ, index) => (
                  <div key={index} style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'white', borderRadius: '5px', border: '1px solid #ddd' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#495057' }}>
                      Soru {wrongQ.question_id}: {wrongQ.question}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                      <div style={{ color: '#dc3545' }}>
                        <strong>Sizin Cevabınız:</strong> {wrongQ.user_answer || 'Boş'}
                      </div>
                      <div style={{ color: '#28a745' }}>
                        <strong>Doğru Cevap:</strong> {wrongQ.correct_answer}
                      </div>
                    </div>
                    {wrongQ.options && wrongQ.options.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#6c757d' }}>
                        <strong>Seçenekler:</strong> {wrongQ.options.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setShowResults(false);
                  setListeningContent(null);
                  setUserAnswers({});
                  setTestStarted(false);
                  setWrongQuestions([]);
                }}
                style={{ fontSize: '1.1rem', padding: '12px 24px' }}
              >
                🔄 Yeni Listening Üret
              </button>
            </div>
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

