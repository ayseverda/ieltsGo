import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Clock, CheckCircle, Play, Pause, RotateCcw } from 'lucide-react';

const GeneralTestPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [testStarted, setTestStarted] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Listening modülü için ek state'ler
  const [listeningTestStarted, setListeningTestStarted] = useState(false);
  const [listeningContent, setListeningContent] = useState<any>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [answers, setAnswers] = useState<{[key: string]: string}>({});

  // Reading modülü için durumlar
  const [readingTests, setReadingTests] = useState<any[]>([]);
  const [readingSelectedId, setReadingSelectedId] = useState<string>('');
  const [readingTest, setReadingTest] = useState<any | null>(null);
  const [readingLoading, setReadingLoading] = useState<boolean>(false);
  const [readingError, setReadingError] = useState<string>('');
  const [readingAnswers, setReadingAnswers] = useState<Record<string, string>>({});
  const [readingResult, setReadingResult] = useState<any | null>(null);
  const [currentReadingPassage, setCurrentReadingPassage] = useState<number>(0);
  const steps = useMemo(() => [
    { 
      name: 'Listening', 
      duration: 30, // dakika
      questions: 40,
      description: 'Dinleme bölümü - 4 bölüm, 40 soru'
    },
    { 
      name: 'Reading', 
      duration: 60, 
      questions: 40,
      description: 'Okuma bölümü - 3 metin, 40 soru'
    },
    { 
      name: 'Writing', 
      duration: 60, 
      tasks: 2,
      description: 'Yazma bölümü - 2 görev'
    },
    { 
      name: 'Speaking', 
      duration: 15, 
      parts: 3,
      description: 'Konuşma bölümü - 3 bölüm'
    }
  ], []);

  const totalDuration = steps.reduce((total, step) => total + step.duration, 0);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (testStarted && !testCompleted && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Süre bitti, otomatik olarak sonraki modüle geç
            if (currentStep < steps.length - 1) {
              setCurrentStep(prev => prev + 1);
              return steps[currentStep + 1].duration * 60; // Yeni modül süresi
            } else {
              // Tüm modüller bitti
              setTestCompleted(true);
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [testStarted, testCompleted, isPaused, timeLeft, currentStep, steps]);

  const startTest = () => {
    setTestStarted(true);
    setCurrentStep(0);
    setTimeLeft(steps[0].duration * 60); // İlk modül süresi (saniye)
    setTestCompleted(false);
    setIsPaused(false);
  };

  const pauseTest = () => {
    setIsPaused(!isPaused);
  };

  const resetTest = () => {
    setTestStarted(false);
    setTestCompleted(false);
    setCurrentStep(0);
    setTimeLeft(0);
    setIsPaused(false);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setTimeLeft(steps[currentStep + 1].duration * 60);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setTimeLeft(steps[currentStep - 1].duration * 60);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (!testStarted) return 0;
    const completedTime = steps.slice(0, currentStep).reduce((total, step) => total + step.duration * 60, 0);
    const currentStepTime = steps[currentStep].duration * 60;
    const usedTime = currentStepTime - timeLeft;
    const totalUsedTime = completedTime + usedTime;
    return (totalUsedTime / (totalDuration * 60)) * 100;
  };

  // ----- Reading: Test verilerini yükle -----
  useEffect(() => {
    if (!(testStarted && steps[currentStep].name === 'Reading')) return;
    
    const initializeReadingTest = async () => {
      setReadingLoading(true);
      setReadingError('');
      
      try {
        // Otomatik olarak AI ile test üret
        console.log('🔄 Reading testi otomatik üretiliyor...');
        
        const response = await fetch('http://localhost:8001/generate-ielts-academic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            topic: 'Academic', 
            difficulty: 'Medium',
            format: 'ielts_academic',
            passages: 3,
            total_questions: 40
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Reading testi başarıyla üretildi:', data.id);
          
          setReadingTest(data);
          setReadingSelectedId(data.id);
          setCurrentReadingPassage(0);
          
          // Test listesine ekle
          setReadingTests(prev => {
            const exists = prev.find(p => p.id === data.id);
            return exists ? prev : [data, ...prev];
          });
        } else {
          const err = await response.text();
          console.error('❌ Reading test üretimi başarısız:', err);
          setReadingError(err || 'AI test üretimi başarısız.');
        }
      } catch (e: any) {
        console.error('❌ Reading test üretim hatası:', e);
        setReadingError(e?.message || 'AI test üretim hatası');
      } finally {
        setReadingLoading(false);
      }
    };
    
    initializeReadingTest();
  }, [testStarted, currentStep, steps]);

  // Seçili testi getir
  useEffect(() => {
    if (!readingSelectedId) return;
    const load = async () => {
      try {
        setReadingLoading(true);
        setReadingResult(null);
        setReadingAnswers({});
        // Önce backend
        let data: any | null = null;
        try {
          const r = await fetch(`http://localhost:8001/tests/${readingSelectedId}`);
          if (r.ok) data = await r.json();
        } catch {}
        if (!data) {
          const fallback = readingTests.find(t => t.id === readingSelectedId);
          data = fallback || null;
        }
        setReadingTest(data);
      } finally {
        setReadingLoading(false);
      }
    };
    load();
  }, [readingSelectedId, readingTests]);

  const setReadingAnswer = (qid: string, val: string) => {
    setReadingAnswers(prev => ({ ...prev, [qid]: val }));
  };

  const submitReading = async () => {
    if (!readingTest) return;
    try {
      setReadingLoading(true);
      console.log('🔍 Değerlendirme başlıyor...');
      console.log('📋 Test ID:', readingSelectedId);
      console.log('📝 Cevaplar:', readingAnswers);
      
      const res = await fetch('http://localhost:8001/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          test_id: readingSelectedId, 
          answers: readingAnswers,
          test_data: readingTest  // Test verisini de gönder
        })
      });
      
      console.log('📊 Response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('✅ Değerlendirme başarılı:', data);
        setReadingResult(data);
      } else {
        const errorText = await res.text();
        console.error('❌ Değerlendirme hatası:', res.status, errorText);
        setReadingError(`Değerlendirme başarısız oldu: ${res.status} - ${errorText}`);
      }
    } catch (e: any) {
      console.error('❌ Değerlendirme exception:', e);
      setReadingError(e?.message || 'Değerlendirme hatası');
    } finally {
      setReadingLoading(false);
    }
  };

  // Reading: AI ile IELTS Academic test üret
  const generateAIReadingTest = async () => {
    try {
      setReadingLoading(true);
      setReadingError('');
      setReadingResult(null);
      setReadingAnswers({});
      setCurrentReadingPassage(0); // İlk sayfaya dön

      // IELTS Academic Reading formatında test üret
      const response = await fetch('http://localhost:8001/generate-ielts-academic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: 'Academic', 
          difficulty: 'Medium',
          format: 'ielts_academic',
          passages: 3,
          total_questions: 40
        })
      });

      if (response.ok) {
        const data = await response.json();
        setReadingTests(prev => {
          const exists = prev.find(p => p.id === data.id);
          return exists ? prev : [data, ...prev];
        });
        setReadingSelectedId(data.id);
        setReadingTest(data);
      } else {
        const err = await response.text();
        setReadingError(err || 'AI test üretimi başarısız.');
      }
    } catch (e: any) {
      setReadingError(e?.message || 'AI test üretim hatası');
    } finally {
      setReadingLoading(false);
    }
  };

  // Listening test başlatma fonksiyonu
  const startListeningTest = async () => {
    try {
      setListeningTestStarted(true);
      setCurrentSection(0);
      setAnswers({});
      setShowTranscript(false); // Metin başlangıçta gizli
      
      // Backend'den IELTS Listening içeriği al
      const response = await fetch('http://localhost:8003/generate-ielts-listening', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: 'Education',
          difficulty: 'Medium',
          accent: 'GB English (Adam - Natural)'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setListeningContent(data);
        console.log('Listening content loaded:', data);
      } else {
        console.error('Failed to load listening content');
        // Fallback data
        setListeningContent({
          sections: [
            {
              id: 1,
              title: "Günlük Konuşma",
              description: "İki kişi arasında günlük konuşma",
              audio_script: "Hello, I'd like to book a table for two people for tonight at 7 PM. Yes, we have availability. What name should I put it under? Smith, John Smith. Perfect, I've reserved a table for two under Smith for 7 PM tonight. Thank you very much!",
              questions: [
                { id: 1, question: "What time does the customer want to book the table?", type: "multiple_choice", options: ["6 PM", "7 PM", "8 PM", "9 PM"], correct_answer: "7 PM" },
                { id: 2, question: "How many people is the table for?", type: "fill_blank", correct_answer: "two" }
              ],
              duration: 5
            }
          ],
          total_questions: 2,
          total_duration: 5,
          topic: "Restaurant Booking",
          difficulty: "Medium",
          instructions: "Listen to the conversation and answer the questions."
        });
      }
    } catch (error) {
      console.error('Error starting listening test:', error);
    }
  };

  // Ses çalma fonksiyonu
  const playAudio = async (script: string) => {
    try {
      setIsAudioPlaying(true);
      
      // ElevenLabs API ile ses oluştur
      const response = await fetch('http://localhost:8003/elevenlabs-text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: script,
          voice: 'Adam',
          accent: 'GB English'
        })
      });
      
      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Hata yönetimi ekle
        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setIsAudioPlaying(false);
          alert('Ses çalarken hata oluştu. Lütfen tekrar deneyin.');
        };
        
        audio.onended = () => {
          setIsAudioPlaying(false);
          URL.revokeObjectURL(audioUrl); // Memory leak önleme
        };
        
        // Ses yükleme kontrolü
        audio.oncanplaythrough = () => {
          audio.play().catch((e) => {
            console.error('Audio play error:', e);
            setIsAudioPlaying(false);
            alert('Ses çalarken hata oluştu. Lütfen tekrar deneyin.');
          });
        };
        
        audio.onloadstart = () => {
          console.log('Audio loading started...');
        };
        
      } else {
        console.error('Failed to generate audio:', response.status);
        setIsAudioPlaying(false);
        alert('Ses oluşturulamadı. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsAudioPlaying(false);
      alert('Ses çalarken hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  // Cevap değiştirme fonksiyonu
  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  if (!testStarted) {
    return (
      <div className="container">
        <div className="text-center mb-4">
          <Link to="/" className="back-btn">
            <ArrowLeft className="icon" />
            Ana Sayfaya Dön
          </Link>
          <h1 className="title">
            <Trophy className="icon" />
            Genel IELTS Denemesi
          </h1>
          <p className="subtitle">
            Tüm modülleri içeren AI destekli genel IELTS denemesi yapın ve puanınızı öğrenin.
          </p>
        </div>

        <div className="card">
          <h2>Deneme Sınavı Bilgileri</h2>
          <div className="test-info">
            <div className="info-item">
              <Clock className="icon" />
              <span><strong>Toplam Süre:</strong> 2 saat 45 dakika</span>
            </div>
            <div className="info-item">
              <CheckCircle className="icon" />
              <span><strong>Modüller:</strong> Reading, Writing, Listening, Speaking</span>
            </div>
          </div>

          <div className="steps-grid">
            {steps.map((step, index) => (
              <div key={index} className="step-card">
                <h3>{step.name}</h3>
                <p><strong>Süre:</strong> {step.duration} dakika</p>
                <p><strong>Soru/Task:</strong> {step.questions || step.tasks || step.parts}</p>
                <p className="step-description">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="exam-summary">
            <h3>📋 Sınav Özeti</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <Clock className="icon" />
                <span><strong>Toplam Süre:</strong> {totalDuration} dakika</span>
              </div>
              <div className="summary-item">
                <CheckCircle className="icon" />
                <span><strong>Modül Sayısı:</strong> {steps.length}</span>
              </div>
              <div className="summary-item">
                <Trophy className="icon" />
                <span><strong>Sınav Türü:</strong> Akademik IELTS</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button 
              className="btn btn-primary"
              onClick={startTest}
              style={{ background: "#FFD700", color: "#222", fontSize: "1.2rem", padding: "15px 30px" }}
            >
              Denemeyi Başlat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sınav tamamlandıysa sonuç sayfasını göster
  if (testCompleted) {
    return (
      <div className="container">
        <div className="text-center mb-4">
          <h1 className="title">
            <Trophy className="icon" />
            Sınav Tamamlandı!
          </h1>
          <p className="subtitle">Tebrikler! IELTS deneme sınavını başarıyla tamamladınız.</p>
        </div>

        <div className="card">
          <h2>📊 Sınav Sonuçları</h2>
          <div className="results-grid">
            {steps.map((step, index) => (
              <div key={index} className="result-card">
                <h3>{step.name}</h3>
                <div className="result-score">
                  <span className="score-label">Puan:</span>
                  <span className="score-value">-</span>
                </div>
                <p className="result-note">Bu modül henüz geliştirilme aşamasındadır.</p>
              </div>
            ))}
          </div>

          <div className="total-score">
            <h3>Genel Puan: -</h3>
            <p>Detaylı değerlendirme için her modülü ayrı ayrı kullanabilirsiniz.</p>
          </div>

          <div className="text-center mt-4">
            <button className="btn btn-primary" onClick={resetTest}>
              <RotateCcw className="icon" />
              Yeni Deneme Başlat
            </button>
            <Link to="/" className="btn btn-outline">
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Sınav Header */}
      <div className="exam-header">
        <div className="exam-info">
          <h1 className="title">
            <Trophy className="icon" />
            IELTS Deneme Sınavı
          </h1>
          <p className="subtitle">
            {steps[currentStep].name} Modülü - {steps[currentStep].description}
          </p>
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
              onClick={resetTest}
            >
              <RotateCcw className="icon" />
              Sınavı Bitir
            </button>
          </div>
        </div>
      </div>

      {/* İlerleme Çubuğu */}
      <div className="progress-container">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${getProgressPercentage()}%` }}
          ></div>
        </div>
        <div className="progress-text">
          {currentStep + 1} / {steps.length} Modül - %{Math.round(getProgressPercentage())} Tamamlandı
        </div>
      </div>

      {/* Modül İçeriği */}
      <div className="card">
        <div className="module-header">
          <h2>{steps[currentStep].name} Modülü</h2>
          <div className="module-info">
            <span className="module-duration">
              <Clock className="icon" />
              {steps[currentStep].duration} dakika
            </span>
            <span className="module-questions">
              <CheckCircle className="icon" />
              {steps[currentStep].questions || steps[currentStep].tasks || steps[currentStep].parts} {steps[currentStep].questions ? 'soru' : steps[currentStep].tasks ? 'görev' : 'bölüm'}
            </span>
          </div>
        </div>

        <div className="module-content">
          {steps[currentStep].name === 'Listening' ? (
            <div className="listening-module">
              {/* IELTS Listening Instructions */}
              <div className="ielts-instructions">
                <h3>🎧 IELTS Listening Test</h3>
                <p>Bu bölümde 4 farklı bölümden oluşan dinleme testi yapacaksınız. Her bölüm farklı bir konu ve zorluk seviyesine sahiptir.</p>
                
                <div className="sections-overview">
                  <h4>Bölümler:</h4>
                  <div className="section-preview">
                    <div className="section-item">
                      <strong>Bölüm 1:</strong> Günlük konuşma (10 soru)
                    </div>
                    <div className="section-item">
                      <strong>Bölüm 2:</strong> Sosyal konu (10 soru)
                    </div>
                    <div className="section-item">
                      <strong>Bölüm 3:</strong> Eğitim/Training (10 soru)
                    </div>
                    <div className="section-item">
                      <strong>Bölüm 4:</strong> Akademik konu (10 soru)
                    </div>
                  </div>
                </div>

                <div className="section-controls">
                  <button 
                    className="btn btn-primary" 
                    style={{ background: "#8B5CF6", color: "white" }}
                    onClick={startListeningTest}
                  >
                    <Play className="icon" />
                    Testi Başlat
                  </button>
                  <button className="btn btn-outline">
                    <CheckCircle className="icon" />
                    Örnek Sorular
                  </button>
                </div>
              </div>

              {/* Test Content Area */}
              {listeningTestStarted && listeningContent && (
                <div className="test-content">
                  <div className="transcript">
                    <h4>Dinleme Metni - Bölüm {currentSection + 1}</h4>
                    <div className={`transcript-content ${!showTranscript ? 'hidden' : ''}`}>
                      <p>{showTranscript ? (listeningContent.sections[currentSection]?.audio_script || "Metin yükleniyor...") : "Metin gizli - sadece dinleyin"}</p>
                    </div>
                    <div className="section-controls">
                      <button 
                        className="btn btn-primary"
                        onClick={() => playAudio(listeningContent.sections[currentSection]?.audio_script || "")}
                        disabled={isAudioPlaying}
                      >
                        {isAudioPlaying ? <Pause className="icon" /> : <Play className="icon" />}
                        {isAudioPlaying ? 'Çalıyor...' : 'Sesi Çal'}
                      </button>
                      <button 
                        className="btn btn-outline"
                        onClick={() => setShowTranscript(!showTranscript)}
                      >
                        {showTranscript ? 'Metni Gizle' : 'Metni Göster'}
                      </button>
                    </div>
                  </div>

                  <div className="section-questions">
                    <h4>Sorular - Bölüm {currentSection + 1}</h4>
                    {listeningContent.sections[currentSection]?.questions?.map((question: any, index: number) => (
                      <div key={question.id} className="question-item">
                        <label>{index + 1}. {question.question}</label>
                        {question.type === 'multiple_choice' ? (
                          <div className="question-options">
                            {question.options?.map((option: string, optIndex: number) => (
                              <label key={optIndex} className="option-label">
                                <input 
                                  type="radio" 
                                  name={`question_${question.id}`}
                                  value={option}
                                  checked={answers[question.id] === option}
                                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                />
                                {option}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input 
                            type="text" 
                            className="answer-input" 
                            placeholder="Cevabınızı yazın..." 
                            value={answers[question.id] || ''}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Bölüm Navigasyonu */}
                  <div className="section-navigation">
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
                      disabled={currentSection === 0}
                    >
                      ← Önceki Bölüm
                    </button>
                    
                    <div className="section-indicator">
                      <span className="current-section">Bölüm {currentSection + 1}</span>
                      <span className="section-counter">{currentSection + 1} / {listeningContent.sections.length}</span>
                    </div>
                    
                    <button 
                      className="btn btn-primary"
                      onClick={() => setCurrentSection(Math.min(listeningContent.sections.length - 1, currentSection + 1))}
                      disabled={currentSection === listeningContent.sections.length - 1}
                    >
                      Sonraki Bölüm →
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : steps[currentStep].name === 'Reading' ? (
            <div className="reading-module">
              {/* IELTS Academic Reading Instructions */}
              <div className="ielts-instructions">
                <h3>📖 IELTS Academic Reading Test</h3>
                <p>Bu bölümde 3 farklı akademik metinden oluşan okuma testi yapacaksınız. Her metin farklı bir konu ve zorluk seviyesine sahiptir.</p>
                
                <div className="reading-overview">
                  <h4>Metinler ve Sorular:</h4>
                  <div className="passage-preview">
                    <div className="passage-item">
                      <strong>Metin 1:</strong> Genel akademik konu (13 soru)
                    </div>
                    <div className="passage-item">
                      <strong>Metin 2:</strong> İş dünyası/Eğitim konusu (13 soru)
                    </div>
                    <div className="passage-item">
                      <strong>Metin 3:</strong> Bilimsel/Akademik konu (14 soru)
                    </div>
                  </div>
                </div>

                <div className="question-types">
                  <h4>Soru Tipleri:</h4>
                  <div className="types-grid">
                    <div className="type-item">📝 Çoktan Seçmeli</div>
                    <div className="type-item">✏️ Boşluk Doldurma</div>
                    <div className="type-item">🔗 Başlık Eşleştirme</div>
                    <div className="type-item">📋 Bilgi Eşleştirme</div>
                    <div className="type-item">✅ Doğru/Yanlış/Değil</div>
                    <div className="type-item">🔢 Sıralama</div>
                    <div className="type-item">💬 Kısa Cevaplı</div>
                  </div>
                </div>

                <div className="section-controls">
                  {readingLoading ? (
                    <div style={{textAlign: 'center', padding: '20px'}}>
                      <div style={{fontSize: '18px', color: '#8B5CF6', marginBottom: '10px'}}>
                        🔄 IELTS Academic Reading Testi Oluşturuluyor...
                      </div>
                      <div style={{fontSize: '14px', color: '#666'}}>
                        3 akademik metin ve 40 soru hazırlanıyor...
                      </div>
                    </div>
                  ) : (
                    <div style={{textAlign: 'center', padding: '20px'}}>
                      <div style={{fontSize: '18px', color: '#28a745', marginBottom: '10px'}}>
                        ✅ Test Hazır!
                      </div>
                      <div style={{fontSize: '14px', color: '#666'}}>
                        Aşağıdaki metinleri okuyup soruları cevaplayabilirsiniz.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {readingLoading && (
                <div className="loading-message">
                  <p>🔄 IELTS Academic Reading testi oluşturuluyor...</p>
                  <p>3 akademik metin ve 40 soru hazırlanıyor...</p>
                </div>
              )}

              {readingError && (
                <div className="error-message" style={{color:'#d33', background:'#ffe6e6', padding:'10px', borderRadius:'5px', margin:'10px 0'}}>
                  ❌ {readingError}
                </div>
              )}

              {readingTest && (
                <div className="reading-content">
                  {/* Sayfa Navigasyonu */}
                  <div className="passage-navigation" style={{display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px'}}>
                    {readingTest.passages?.map((_: any, index: number) => (
                      <button
                        key={index}
                        className={`passage-nav-btn ${currentReadingPassage === index ? 'active' : ''}`}
                        onClick={() => setCurrentReadingPassage(index)}
                        style={{
                          padding: '8px 16px',
                          border: '2px solid #8B5CF6',
                          borderRadius: '20px',
                          background: currentReadingPassage === index ? '#8B5CF6' : 'transparent',
                          color: currentReadingPassage === index ? 'white' : '#8B5CF6',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}
                      >
                        Metin {index + 1}
                      </button>
                    ))}
                  </div>

                  {/* Mevcut Metin ve Soruları */}
                  {readingTest.passages && readingTest.passages[currentReadingPassage] && (
                    <div className="current-passage-content">
                      {/* Metin */}
                      <div className="passage-section" style={{marginBottom: '30px', border: '2px solid #8B5CF6', padding: '25px', borderRadius: '12px', background: '#f8f9fa'}}>
                        <div className="passage-header" style={{marginBottom: '20px', textAlign: 'center'}}>
                          <h4 style={{color: '#8B5CF6', fontSize: '20px', margin: '0 0 10px 0'}}>
                            Metin {currentReadingPassage + 1}: {readingTest.passages[currentReadingPassage].title}
                          </h4>
                          <span className="passage-info" style={{color: '#666', fontSize: '14px'}}>
                            ~{readingTest.passages[currentReadingPassage].word_count || 800} kelime
                          </span>
                        </div>
                        <div className="passage-text" style={{
                          lineHeight: '1.8', 
                          fontSize: '15px', 
                          textAlign: 'justify',
                          background: 'white',
                          padding: '20px',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0'
                        }}>
                          {readingTest.passages[currentReadingPassage].text}
                        </div>
                      </div>

                      {/* Bu Metne Ait Sorular */}
                      <div className="questions-container">
                        <h4 style={{color: '#8B5CF6', fontSize: '18px', marginBottom: '20px'}}>
                          📝 Metin {currentReadingPassage + 1} Soruları
                        </h4>
                        <div className="questions-grid">
                          {readingTest.questions
                            ?.filter((q: any) => q.passage_id === readingTest.passages[currentReadingPassage].id)
                            ?.map((question: any, idx: number) => {
                              // Her metin için sorular kendi içinde 1, 2, 3... şeklinde
                              const questionNumber = idx + 1;
                              
                              // Sonuç kontrolü - yanlış veya boş soruları işaretle
                              const userAnswer = readingAnswers[question.id];
                              const correctAnswer = question.correct_answer || question.answer;
                              const isAnswered = userAnswer && userAnswer.trim() !== '';
                              const isCorrect = isAnswered && userAnswer === correctAnswer;
                              const showResult = readingResult !== null;
                              
                              return (
                                <div key={question.id} className="question-section" style={{
                                  marginBottom: '20px', 
                                  border: showResult ? (isCorrect ? '2px solid #28a745' : '2px solid #dc3545') : '1px solid #e0e0e0', 
                                  padding: '20px', 
                                  borderRadius: '8px',
                                  background: showResult ? (isCorrect ? '#f8fff8' : '#fff5f5') : 'white'
                                }}>
                                  <div className="question-header" style={{marginBottom: '15px'}}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                                      <span className="question-number" style={{
                                        background: showResult ? (isCorrect ? '#28a745' : '#dc3545') : '#8B5CF6', 
                                        color: 'white', 
                                        padding: '4px 12px', 
                                        borderRadius: '15px', 
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                      }}>
                                        Soru {questionNumber}
                                      </span>
                                      {showResult && (
                                        <span style={{
                                          background: isCorrect ? '#28a745' : '#dc3545',
                                          color: 'white',
                                          padding: '4px 8px',
                                          borderRadius: '12px',
                                          fontSize: '12px',
                                          fontWeight: 'bold'
                                        }}>
                                          {isCorrect ? '✅ Doğru' : (isAnswered ? '❌ Yanlış' : '⚠️ Boş')}
                                        </span>
                                      )}
                                    </div>
                                    <span className="question-type" style={{
                                      color: '#666',
                                      fontSize: '12px',
                                      background: '#f0f0f0',
                                      padding: '2px 8px',
                                      borderRadius: '10px'
                                    }}>
                                      {question.type}
                                    </span>
                                  </div>
                                  
                                  {/* Yanlış/Boş sorular için doğru cevap gösterimi */}
                                  {showResult && !isCorrect && (
                                    <div style={{
                                      background: '#fff3cd',
                                      border: '1px solid #ffeaa7',
                                      borderRadius: '6px',
                                      padding: '10px',
                                      marginBottom: '15px',
                                      fontSize: '14px'
                                    }}>
                                      <strong style={{color: '#856404'}}>💡 Doğru Cevap:</strong>
                                      <span style={{color: '#856404', marginLeft: '5px', fontWeight: 'bold'}}>
                                        {(() => {
                                          const answer = question.correct_answer || question.answer;
                                          if (question.type === 'Multiple Choice' && typeof answer === 'number') {
                                            // Index'i A,B,C,D formatına çevir
                                            const letters = ['A', 'B', 'C', 'D'];
                                            const letter = letters[answer] || answer;
                                            const optionText = question.options && question.options[answer] ? question.options[answer] : '';
                                            return `${letter}) ${optionText}`;
                                          }
                                          return answer || 'Cevap henüz belirlenmedi';
                                        })()}
                                      </span>
                                      {userAnswer && (
                                        <div style={{marginTop: '5px', fontSize: '13px'}}>
                                          <strong style={{color: '#dc3545'}}>Sizin Cevabınız:</strong>
                                          <span style={{color: '#dc3545', marginLeft: '5px'}}>
                                            {(() => {
                                              if (question.type === 'Multiple Choice' && typeof userAnswer === 'string' && /^\d+$/.test(userAnswer)) {
                                                // Kullanıcının cevabı da index ise A,B,C,D formatına çevir
                                                const index = parseInt(userAnswer);
                                                const letters = ['A', 'B', 'C', 'D'];
                                                const letter = letters[index] || userAnswer;
                                                const optionText = question.options && question.options[index] ? question.options[index] : '';
                                                return `${letter}) ${optionText}`;
                                              }
                                              return userAnswer;
                                            })()}
                                          </span>
                                        </div>
                                      )}
                                      {!isAnswered && (
                                        <div style={{marginTop: '5px', fontSize: '13px'}}>
                                          <strong style={{color: '#dc3545'}}>Sizin Cevabınız:</strong>
                                          <span style={{color: '#dc3545', marginLeft: '5px', fontStyle: 'italic'}}>
                                            Boş bırakıldı
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div className="question-content">
                                    <label className="question-prompt" style={{
                                      display: 'block',
                                      marginBottom: '15px',
                                      fontSize: '15px',
                                      fontWeight: '500',
                                      lineHeight: '1.5'
                                    }}>
                                      {question.prompt}
                                    </label>
                                    
                                    {question.type === 'Multiple Choice' || Array.isArray(question.options) ? (
                          <div className="question-options">
                                        {question.options?.map((option: string, i: number) => (
                                          <label key={i} className="option-label" style={{
                                            display: 'block',
                                            marginBottom: '8px',
                                            padding: '8px',
                                            border: '1px solid #e0e0e0',
                                            borderRadius: '5px',
                                            cursor: 'pointer',
                                            background: readingAnswers[question.id] === option ? '#e8f2ff' : 'transparent'
                                          }}>
                                <input
                                  type="radio"
                                              name={`rq_${question.id}`}
                                              value={option}
                                              checked={readingAnswers[question.id] === option}
                                              onChange={(e)=>setReadingAnswer(question.id, e.target.value)}
                                              style={{marginRight: '8px'}}
                                            />
                                            {String.fromCharCode(65 + i)}) {option}
                              </label>
                            ))}
                          </div>
                                    ) : question.type === 'True/False/Not Given' ? (
                                      <div className="question-options" style={{display: 'flex', gap: '15px'}}>
                                        <label className="option-label" style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          padding: '8px 16px',
                                          border: '2px solid #8B5CF6',
                                          borderRadius: '20px',
                                          cursor: 'pointer',
                                          background: readingAnswers[question.id] === 'True' ? '#8B5CF6' : 'transparent',
                                          color: readingAnswers[question.id] === 'True' ? 'white' : '#8B5CF6'
                                        }}>
                                          <input
                                            type="radio"
                                            name={`rq_${question.id}`}
                                            value="True"
                                            checked={readingAnswers[question.id] === 'True'}
                                            onChange={(e)=>setReadingAnswer(question.id, e.target.value)}
                                            style={{marginRight: '8px'}}
                                          />
                                          True
                                        </label>
                                        <label className="option-label" style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          padding: '8px 16px',
                                          border: '2px solid #8B5CF6',
                                          borderRadius: '20px',
                                          cursor: 'pointer',
                                          background: readingAnswers[question.id] === 'False' ? '#8B5CF6' : 'transparent',
                                          color: readingAnswers[question.id] === 'False' ? 'white' : '#8B5CF6'
                                        }}>
                                          <input
                                            type="radio"
                                            name={`rq_${question.id}`}
                                            value="False"
                                            checked={readingAnswers[question.id] === 'False'}
                                            onChange={(e)=>setReadingAnswer(question.id, e.target.value)}
                                            style={{marginRight: '8px'}}
                                          />
                                          False
                                        </label>
                                        <label className="option-label" style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          padding: '8px 16px',
                                          border: '2px solid #8B5CF6',
                                          borderRadius: '20px',
                                          cursor: 'pointer',
                                          background: readingAnswers[question.id] === 'Not Given' ? '#8B5CF6' : 'transparent',
                                          color: readingAnswers[question.id] === 'Not Given' ? 'white' : '#8B5CF6'
                                        }}>
                                          <input
                                            type="radio"
                                            name={`rq_${question.id}`}
                                            value="Not Given"
                                            checked={readingAnswers[question.id] === 'Not Given'}
                                            onChange={(e)=>setReadingAnswer(question.id, e.target.value)}
                                            style={{marginRight: '8px'}}
                                          />
                                          Not Given
                                        </label>
                          </div>
                        ) : (
                          <input
                            type="text"
                            className="answer-input"
                            placeholder="Cevabınızı yazın..."
                                        value={readingAnswers[question.id] || ''}
                                        onChange={(e)=>setReadingAnswer(question.id, e.target.value)}
                                        style={{
                                          width: '100%', 
                                          padding: '12px', 
                                          border: '2px solid #e0e0e0', 
                                          borderRadius: '8px',
                                          fontSize: '15px',
                                          outline: 'none',
                                          transition: 'border-color 0.3s'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#8B5CF6'}
                                        onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                          />
                        )}
                      </div>
                                </div>
                              );
                            })}
                        </div>
                  </div>

                      {/* Metin Navigasyon Butonları */}
                      <div className="passage-navigation-buttons" style={{
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginTop: '30px',
                        padding: '20px 0'
                      }}>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => setCurrentReadingPassage(Math.max(0, currentReadingPassage - 1))}
                          disabled={currentReadingPassage === 0}
                          style={{
                            padding: '12px 24px',
                            fontSize: '16px',
                            opacity: currentReadingPassage === 0 ? 0.5 : 1,
                            cursor: currentReadingPassage === 0 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          ← Önceki Metin
                        </button>
                        
                        <div className="passage-info" style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '20px',
                          fontSize: '14px',
                          color: '#666'
                        }}>
                          <span>Metin {currentReadingPassage + 1} / {readingTest.passages.length}</span>
                          <span>
                            {readingTest.questions?.filter((q: any) => q.passage_id === readingTest.passages[currentReadingPassage].id).length} soru
                          </span>
                        </div>
                        
                        <button 
                          className="btn btn-primary"
                          onClick={() => setCurrentReadingPassage(Math.min(readingTest.passages.length - 1, currentReadingPassage + 1))}
                          disabled={currentReadingPassage === readingTest.passages.length - 1}
                          style={{
                            background: '#8B5CF6',
                            color: 'white',
                            padding: '12px 24px',
                            fontSize: '16px',
                            opacity: currentReadingPassage === readingTest.passages.length - 1 ? 0.5 : 1,
                            cursor: currentReadingPassage === readingTest.passages.length - 1 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Sonraki Metin →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Test Tamamlama Butonu */}
                  {currentReadingPassage === readingTest.passages.length - 1 && (
                    <div className="reading-actions" style={{
                      display:'flex', 
                      gap:12, 
                      marginTop:30, 
                      justifyContent: 'center',
                      padding: '20px',
                      background: '#f8f9fa',
                      borderRadius: '10px',
                      border: '2px solid #8B5CF6'
                    }}>
                      <button 
                        className="btn btn-primary" 
                        onClick={submitReading} 
                        disabled={readingLoading}
                        style={{
                          background: '#8B5CF6', 
                          color: 'white', 
                          padding: '15px 30px', 
                          fontSize: '18px',
                          fontWeight: 'bold',
                          borderRadius: '25px'
                        }}
                      >
                        {readingLoading ? '🔄 Değerlendiriliyor...' : '📊 Testi Tamamla ve Değerlendir'}
                    </button>
                    {readingResult && (
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => { 
                            setReadingResult(null); 
                            setReadingAnswers({}); 
                            setCurrentReadingPassage(0);
                          }}
                          style={{
                            padding: '15px 30px', 
                            fontSize: '18px',
                            borderRadius: '25px'
                          }}
                        >
                          🔄 Yeniden Başla
                      </button>
                    )}
                  </div>
                  )}

                  {readingResult && (
                    <div className="reading-result" style={{
                      marginTop:30, 
                      background: '#f8f9fa', 
                      padding: '25px', 
                      borderRadius: '12px', 
                      border: '2px solid #8B5CF6'
                    }}>
                      <h4 style={{color: '#8B5CF6', fontSize: '20px', marginBottom: '20px'}}>📊 Test Sonuçları</h4>
                      
                      {/* Ana İstatistikler */}
                      {(() => {
                        // Boş soruları say
                        const blankCount = readingTest?.questions?.filter((q: any) => {
                          const userAnswer = readingAnswers[q.id];
                          return !userAnswer || userAnswer.trim() === '';
                        }).length || 0;
                        
                        const wrongCount = readingResult?.scaled?.total - readingResult?.scaled?.correct - blankCount;
                        
                        return (
                          <div className="result-stats" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px'}}>
                            <div className="stat-item" style={{
                              background: 'white',
                              padding: '15px',
                              borderRadius: '8px',
                              border: '1px solid #e0e0e0',
                              textAlign: 'center'
                            }}>
                              <strong style={{color: '#8B5CF6'}}>Doğru Cevaplar</strong><br/>
                              <span style={{fontSize: '24px', fontWeight: 'bold', color: '#28a745'}}>
                                {readingResult?.scaled?.correct}
                              </span>
                              <span style={{fontSize: '16px', color: '#666'}}> / {readingResult?.scaled?.total}</span>
                            </div>
                            <div className="stat-item" style={{
                              background: 'white',
                              padding: '15px',
                              borderRadius: '8px',
                              border: '1px solid #e0e0e0',
                              textAlign: 'center'
                            }}>
                              <strong style={{color: '#8B5CF6'}}>Yanlış Cevaplar</strong><br/>
                              <span style={{fontSize: '24px', fontWeight: 'bold', color: '#dc3545'}}>
                                {wrongCount}
                              </span>
                              <span style={{fontSize: '16px', color: '#666'}}> / {readingResult?.scaled?.total}</span>
                            </div>
                            <div className="stat-item" style={{
                              background: 'white',
                              padding: '15px',
                              borderRadius: '8px',
                              border: '1px solid #e0e0e0',
                              textAlign: 'center'
                            }}>
                              <strong style={{color: '#8B5CF6'}}>Boş Bırakılanlar</strong><br/>
                              <span style={{fontSize: '24px', fontWeight: 'bold', color: '#ffc107'}}>
                                {blankCount}
                              </span>
                              <span style={{fontSize: '16px', color: '#666'}}> / {readingResult?.scaled?.total}</span>
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* IELTS Band Score */}
                      <div className="result-stats" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px'}}>
                        <div className="stat-item" style={{
                          background: 'white',
                          padding: '15px',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0',
                          textAlign: 'center'
                        }}>
                          <strong style={{color: '#8B5CF6'}}>IELTS Band Skoru</strong><br/>
                          <span style={{fontSize: '32px', fontWeight: 'bold', color: '#8B5CF6'}}>
                            {readingResult?.band_estimate}
                          </span>
                          <span style={{fontSize: '14px', color: '#666', display: 'block'}}>Band Score</span>
                        </div>
                        <div className="stat-item" style={{
                          background: 'white',
                          padding: '15px',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0',
                          textAlign: 'center'
                        }}>
                          <strong style={{color: '#8B5CF6'}}>Başarı Oranı</strong><br/>
                          <span style={{fontSize: '24px', fontWeight: 'bold', color: '#8B5CF6'}}>
                            {Math.round((readingResult?.scaled?.correct / readingResult?.scaled?.total) * 100)}%
                          </span>
                        </div>
                      </div>


                      {/* Geri Bildirim */}
                      {readingResult?.feedback && (
                        <div className="feedback-section" style={{
                          background: 'white',
                          padding: '20px',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0'
                        }}>
                          <h5 style={{color: '#8B5CF6', marginBottom: '15px'}}>💡 Geri Bildirim</h5>
                          <div className="feedback-content" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                            <div className="strengths">
                              <h6 style={{color: '#28a745', marginBottom: '10px'}}>✅ Güçlü Yönler:</h6>
                              <ul style={{margin: 0, paddingLeft: '20px'}}>
                                {(readingResult.feedback.strengths || []).map((s: string, i: number)=> 
                                  <li key={`s-${i}`} style={{marginBottom: '5px'}}>{s}</li>
                                )}
                          </ul>
                        </div>
                            <div className="improvements">
                              <h6 style={{color: '#dc3545', marginBottom: '10px'}}>📈 Gelişim Alanları:</h6>
                              <ul style={{margin: 0, paddingLeft: '20px'}}>
                                {(readingResult.feedback.improvements || []).map((s: string, i: number)=> 
                                  <li key={`i-${i}`} style={{marginBottom: '5px'}}>{s}</li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="coming-soon">
              <h3>🚧 Modül Geliştiriliyor</h3>
              <p>
                Bu modül henüz geliştirilme aşamasındadır. 
                Gerçek sınav deneyimi için ilgili modül sayfasından pratik yapabilirsiniz.
              </p>
              
              <div className="module-links">
                <Link to={`/${steps[currentStep].name.toLowerCase()}`} className="btn btn-primary">
                  {steps[currentStep].name} Modülüne Git
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Modül Navigasyonu */}
        <div className="module-navigation">
          <button 
            className="btn btn-secondary"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            ← Önceki Modül
          </button>
          
          <div className="module-indicator">
            <span className="current-module">{steps[currentStep].name}</span>
            <span className="module-counter">{currentStep + 1} / {steps.length}</span>
          </div>
          
          <button 
            className="btn btn-primary"
            onClick={nextStep}
            disabled={currentStep === steps.length - 1}
          >
            Sonraki Modül →
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeneralTestPage;