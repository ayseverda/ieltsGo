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
