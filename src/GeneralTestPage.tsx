import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Clock, CheckCircle, Play, Pause, RotateCcw, Mic, Square } from 'lucide-react';

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

  // Speaking modülü için durumlar (IELTS formatı)
  const [speakingPart, setSpeakingPart] = useState<number>(1); // 1,2,3
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessingSpeech, setIsProcessingSpeech] = useState<boolean>(false);
  const [speakingError, setSpeakingError] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [transcripts, setTranscripts] = useState<{ part1: string[]; part2: string; part3: string[] }>({ part1: [], part2: '', part3: [] });
  const [activeRecordingIndex, setActiveRecordingIndex] = useState<number | null>(null);
  const [part1Answers, setPart1Answers] = useState<string[]>(['', '', '', '']);
  const [part3Answers, setPart3Answers] = useState<string[]>(['', '', '']);
  const browserRecognitionRef = useRef<any>(null);
  const browserTranscriptRef = useRef<string>('');
  const [usingBrowserSTT, setUsingBrowserSTT] = useState<boolean>(false);
  const speakingPrompts = useMemo(() => ({
    part1: [
      'Let’s talk about your hometown. Where is it?',
      'What do you like most about your hometown?',
      'Do you work or are you a student?',
      'What do you do in your free time?'
    ],
    part2: {
      topic: 'Describe a memorable trip you have taken',
      bullets: [
        'Where you went',
        'Who you went with',
        'What you did there',
        'And explain why it was memorable'
      ]
    },
    part3: [
      'How has tourism changed in your country over the years?',
      'What are the benefits and drawbacks of international travel?',
      'Do you think people travel too much nowadays? Why/Why not?'
    ]
  }), []);

  const startSpeakingRecording = async () => {
    try {
      setSpeakingError('');
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        processSpeakingAudio();
      };
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);

      // Start browser STT in parallel as a fallback (Chrome)
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          browserRecognitionRef.current = recognition;
          browserTranscriptRef.current = '';
          recognition.lang = 'en-US';
          recognition.interimResults = true;
          recognition.continuous = true;
          recognition.onresult = (event: any) => {
            let chunk = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i];
              const textPiece = res[0]?.transcript || '';
              chunk += textPiece + (res.isFinal ? ' ' : ' ');
            }
            if (chunk) browserTranscriptRef.current = (browserTranscriptRef.current + ' ' + chunk).trim();
          };
          recognition.onerror = () => {};
          recognition.start();
        }
      } catch {}
    } catch (e: any) {
      setSpeakingError('Mikrofon erişimi başarısız. Tarayıcıdan izin verin.');
    }
  };

  const stopSpeakingRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    // Stop browser STT fallback
    try {
      if (browserRecognitionRef.current) {
        browserRecognitionRef.current.onresult = null;
        browserRecognitionRef.current.onerror = null;
        browserRecognitionRef.current.stop();
      }
    } catch {}
  };

  const processSpeakingAudio = async () => {
    setIsProcessingSpeech(true);
    setSpeakingError('');
    try {
      if (audioChunksRef.current.length === 0) throw new Error('Ses yakalanamadı');
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (audioBlob.size < 100) throw new Error('Ses dosyası çok küçük');
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const sttRes = await fetch('http://localhost:8000/api/speaking/speech-to-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio_data: base64, format: 'webm' })
          });
          if (!sttRes.ok) throw new Error(`STT hata: ${sttRes.status}`);
          const data = await sttRes.json();
          const text: string = data.text || '';
          if (!text.trim()) throw new Error('Konuşma algılanamadı');
          // Esas doldurma: aktif textarea'yı konuşma ile doldur
          if (speakingPart === 1 && activeRecordingIndex !== null) {
            setPart1Answers(prev => {
              const copy = [...prev];
              copy[activeRecordingIndex] = text;
              return copy;
            });
          } else if (speakingPart === 3 && activeRecordingIndex !== null) {
            setPart3Answers(prev => {
              const copy = [...prev];
              copy[activeRecordingIndex] = text;
              return copy;
            });
          } else if (speakingPart === 2) {
            setTranscripts(prev => ({ ...prev, part2: prev.part2 ? prev.part2 + ' ' + text : text }));
          }
        } catch (err: any) {
          // Fallback: use browser SpeechRecognition transcript if available
          const fallback = (browserTranscriptRef.current || '').trim();
          if (fallback) {
            if (speakingPart === 1 && activeRecordingIndex !== null) {
              setPart1Answers(prev => {
                const copy = [...prev];
                copy[activeRecordingIndex] = fallback;
                return copy;
              });
            } else if (speakingPart === 3 && activeRecordingIndex !== null) {
              setPart3Answers(prev => {
                const copy = [...prev];
                copy[activeRecordingIndex] = fallback;
                return copy;
              });
            } else if (speakingPart === 2) {
              setTranscripts(prev => ({ ...prev, part2: prev.part2 ? prev.part2 + ' ' + fallback : fallback }));
            }
            setUsingBrowserSTT(true);
            setSpeakingError('');
          } else {
            setSpeakingError(err?.message || 'STT hata');
          }
        } finally {
          setIsProcessingSpeech(false);
          setActiveRecordingIndex(null);
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (e: any) {
      setSpeakingError(e?.message || 'Ses işleme hatası');
      setIsProcessingSpeech(false);
    }
  };

  // Writing modülü için durumlar
  const [writingMode, setWritingMode] = useState<string>('academic'); // academic | general
  const [writingTask, setWritingTask] = useState<string>('task1'); // task1 | task2
  const [writingTopics, setWritingTopics] = useState<{[key: string]: string}>({});
  const [writingEssays, setWritingEssays] = useState<{[key: string]: string}>({});
  const [writingResults, setWritingResults] = useState<{[key: string]: any}>({});
  const [writingLoading, setWritingLoading] = useState<boolean>(false);
  const [writingError, setWritingError] = useState<string>('');
  const [currentWritingTask, setCurrentWritingTask] = useState<number>(0);
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

  // Genel deneme bittiğinde puanı kaydet ve streak güncelle
  const completeGeneralMockAndSave = async (bands: { reading?: number; writing?: number; listening?: number; speaking?: number }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const resp = await fetch('http://localhost:8000/api/complete-general-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          reading_band: bands.reading,
          writing_band: bands.writing,
          listening_band: bands.listening,
          speaking_band: bands.speaking,
          detailed: { source: 'general_test_page' }
        })
      });
      if (!resp.ok) return;
      const data = await resp.json();
      console.log('✅ Genel deneme kaydedildi:', data);
    } catch (e) {
      console.warn('Genel deneme kaydetme hatası:', e);
    }
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

  // Writing konu üretme fonksiyonu
  const generateWritingTopic = async (taskKey: string) => {
    try {
      setWritingLoading(true);
      const response = await fetch(`http://localhost:8002/topic?mode=${writingMode}&task=${taskKey}`);
      if (response.ok) {
        const data = await response.json();
        setWritingTopics(prev => ({ ...prev, [taskKey]: data.topic }));
      } else {
        setWritingError('Konu üretimi başarısız.');
      }
    } catch (e: any) {
      setWritingError('Konu üretimi hatası: ' + e.message);
    } finally {
      setWritingLoading(false);
    }
  };

  // Writing essay değerlendirme fonksiyonu
  const evaluateWriting = async (taskKey: string) => {
    const essay = writingEssays[taskKey];
    if (!essay || essay.trim().length < 50) {
      setWritingError('Lütfen en az 50 kelimelik bir essay yazın.');
      return;
    }

    try {
      setWritingLoading(true);
      const response = await fetch('http://localhost:8002/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          essay: essay,
          topic: writingTopics[taskKey],
          mode: writingMode,
          task: taskKey
        })
      });

      if (response.ok) {
        const data = await response.json();
        setWritingResults(prev => ({ ...prev, [taskKey]: data }));
      } else {
        const errorData = await response.text();
        setWritingError('Değerlendirme başarısız: ' + errorData);
      }
    } catch (e: any) {
      setWritingError('Değerlendirme hatası: ' + e.message);
    } finally {
      setWritingLoading(false);
    }
  };

  // Writing test başlatma fonksiyonu
  const startWritingTest = async () => {
    setWritingError('');
    setWritingTopics({});
    setWritingEssays({});
    setWritingResults({});
    setCurrentWritingTask(0);
    
    // Her iki task için de konu üret
    await generateWritingTopic('task1');
    await generateWritingTopic('task2');
  };

  // Reading test başlatma fonksiyonu
  const startReadingTest = async () => {
    setReadingLoading(true);
    setReadingError('');
    setReadingResult(null);
    setReadingAnswers({});
    setCurrentReadingPassage(0);
    
    try {
      console.log('🔄 Reading testi üretiliyor...');
      
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
    // Ortalama band değerini hesapla (şimdilik placeholder: readingResult vs yoksa null)
    useEffect(() => {
      // Bu effect yalnızca sonuç ekranına ilk girişte bir kez çalışsın
      const onceKey = 'general_test_saved_once';
      if (sessionStorage.getItem(onceKey)) return;
      sessionStorage.setItem(onceKey, '1');
      // Basit placeholder skorlar: Reading sonucu varsa kullan, diğerleri 0
      const estimatedReading = readingResult?.band_estimate || 0;
      completeGeneralMockAndSave({ reading: Number(estimatedReading) || 0 });
    }, []);
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
                    Listening Testini Başlat
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
                  {!readingTest && !readingLoading ? (
                    <div style={{textAlign: 'center', padding: '20px'}}>
                      <div style={{fontSize: '18px', color: '#8B5CF6', marginBottom: '15px'}}>
                        📖 Reading Testine Hazır mısınız?
                      </div>
                      <div style={{fontSize: '14px', color: '#666', marginBottom: '20px'}}>
                        3 akademik metin ve 40 soru ile IELTS Academic Reading testi yapın.
                      </div>
                      <button 
                        className="btn btn-primary" 
                        style={{ background: "#8B5CF6", color: "white", fontSize: "16px", padding: "12px 24px" }}
                        onClick={startReadingTest}
                      >
                        🚀 Reading Testini Başlat
                </button>
                    </div>
                  ) : readingLoading ? (
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
          ) : steps[currentStep].name === 'Writing' ? (
            <div className="writing-module">
              {/* IELTS Writing Instructions */}
              <div className="ielts-instructions">
                <h3>✍️ IELTS Writing Test</h3>
                <p>Bu bölümde 2 farklı yazma görevi yapacaksınız. Academic ve General Training arasında seçim yapabilirsiniz.</p>
                
                <div className="writing-overview">
                  <h4>Görevler:</h4>
                  <div className="task-preview">
                    <div className="task-item">
                      <strong>Task 1:</strong> Academic (grafik/şema analizi) veya General (mektup yazma)
                    </div>
                    <div className="task-item">
                      <strong>Task 2:</strong> Essay yazma (Academic/General)
                    </div>
                  </div>
                </div>

                <div className="writing-controls">
                  <div className="mode-selection" style={{marginBottom: '20px'}}>
                    <label style={{marginRight: '20px'}}>
                      <input 
                        type="radio" 
                        name="writingMode" 
                        value="academic" 
                        checked={writingMode === 'academic'}
                        onChange={(e) => setWritingMode(e.target.value)}
                        style={{marginRight: '8px'}}
                      />
                      Academic
                    </label>
                    <label>
                      <input 
                        type="radio" 
                        name="writingMode" 
                        value="general" 
                        checked={writingMode === 'general'}
                        onChange={(e) => setWritingMode(e.target.value)}
                        style={{marginRight: '8px'}}
                      />
                      General Training
                    </label>
                  </div>

                  {Object.keys(writingTopics).length === 0 && !writingLoading ? (
                    <div style={{textAlign: 'center', padding: '20px'}}>
                      <div style={{fontSize: '18px', color: '#8B5CF6', marginBottom: '15px'}}>
                        ✍️ Writing Testine Hazır mısınız?
                      </div>
                      <div style={{fontSize: '14px', color: '#666', marginBottom: '20px'}}>
                        2 yazma görevi ile IELTS Writing testi yapın.
                      </div>
                      <button 
                        className="btn btn-primary" 
                        style={{ background: "#8B5CF6", color: "white", fontSize: "16px", padding: "12px 24px" }}
                        onClick={startWritingTest}
                      >
                        🚀 Writing Testini Başlat
                      </button>
                    </div>
                  ) : writingLoading ? (
                    <div style={{textAlign: 'center', padding: '20px'}}>
                      <div style={{fontSize: '18px', color: '#8B5CF6', marginBottom: '10px'}}>
                        🔄 IELTS Writing konuları oluşturuluyor...
                      </div>
                      <div style={{fontSize: '14px', color: '#666'}}>
                        Task 1 ve Task 2 konuları hazırlanıyor...
                      </div>
                    </div>
                  ) : (
                    <div style={{textAlign: 'center', padding: '20px'}}>
                      <div style={{fontSize: '18px', color: '#28a745', marginBottom: '10px'}}>
                        ✅ Test Hazır!
                      </div>
                      <div style={{fontSize: '14px', color: '#666'}}>
                        Aşağıdaki görevleri tamamlayabilirsiniz.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {writingError && (
                <div className="error-message" style={{color:'#d33', background:'#ffe6e6', padding:'10px', borderRadius:'5px', margin:'10px 0'}}>
                  ❌ {writingError}
                </div>
              )}

              {Object.keys(writingTopics).length > 0 && (
                <div className="writing-content">
                  {/* Task Navigasyonu */}
                  <div className="task-navigation" style={{display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px'}}>
                    <button
                      className={`task-nav-btn ${currentWritingTask === 0 ? 'active' : ''}`}
                      onClick={() => setCurrentWritingTask(0)}
                      style={{
                        padding: '8px 16px',
                        border: '2px solid #8B5CF6',
                        borderRadius: '20px',
                        background: currentWritingTask === 0 ? '#8B5CF6' : 'transparent',
                        color: currentWritingTask === 0 ? 'white' : '#8B5CF6',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      Task 1
                    </button>
                    <button
                      className={`task-nav-btn ${currentWritingTask === 1 ? 'active' : ''}`}
                      onClick={() => setCurrentWritingTask(1)}
                      style={{
                        padding: '8px 16px',
                        border: '2px solid #8B5CF6',
                        borderRadius: '20px',
                        background: currentWritingTask === 1 ? '#8B5CF6' : 'transparent',
                        color: currentWritingTask === 1 ? 'white' : '#8B5CF6',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      Task 2
                    </button>
                  </div>

                  {/* Mevcut Task */}
                  {(() => {
                    const taskKey = currentWritingTask === 0 ? 'task1' : 'task2';
                    const topic = writingTopics[taskKey];
                    const essay = writingEssays[taskKey] || '';
                    const result = writingResults[taskKey];
                    const isTask1 = currentWritingTask === 0;

                    return (
                      <div className="current-task-content">
                        {/* Task Başlığı ve Konu */}
                        <div className="task-section" style={{
                          marginBottom: '30px', 
                          border: '2px solid #8B5CF6', 
                          padding: '25px', 
                          borderRadius: '12px', 
                          background: '#f8f9fa'
                        }}>
                          <div className="task-header" style={{marginBottom: '20px', textAlign: 'center'}}>
                            <h4 style={{color: '#8B5CF6', fontSize: '20px', margin: '0 0 10px 0'}}>
                              {isTask1 ? 'Task 1' : 'Task 2'}: {isTask1 ? 
                                (writingMode === 'academic' ? 'Grafik/Şema Analizi' : 'Mektup Yazma') : 
                                'Essay Yazma'
                              }
                            </h4>
                            <span className="task-info" style={{color: '#666', fontSize: '14px'}}>
                              {isTask1 ? 
                                (writingMode === 'academic' ? '~150 kelime' : '~150 kelime') : 
                                '~250 kelime'
                              } • {writingMode === 'academic' ? 'Academic' : 'General Training'}
                            </span>
                          </div>
                          
                          {topic && (
                            <div className="task-topic" style={{
                              background: 'white',
                              padding: '20px',
                              borderRadius: '8px',
                              border: '1px solid #e0e0e0',
                              fontSize: '15px',
                              lineHeight: '1.6'
                            }}>
                              <strong style={{color: '#8B5CF6'}}>Konu:</strong><br/>
                              {topic}
                            </div>
                          )}
                        </div>

                        {/* Essay Yazma Alanı */}
                        <div className="essay-section" style={{
                          marginBottom: '30px',
                          background: 'white',
                          padding: '25px',
                          borderRadius: '12px',
                          border: '1px solid #e0e0e0'
                        }}>
                          <h5 style={{color: '#8B5CF6', marginBottom: '15px'}}>
                            ✍️ Essay'inizi Yazın
                          </h5>
                          <textarea
                            value={essay}
                            onChange={(e) => setWritingEssays(prev => ({ ...prev, [taskKey]: e.target.value }))}
                            placeholder={isTask1 ? 
                              (writingMode === 'academic' ? 'Grafik veya şemayı analiz edin...' : 'Mektubunuzu yazın...') : 
                              'Essay yazın...'
                            }
                            style={{
                              width: '100%',
                              height: '300px',
                              padding: '15px',
                              border: '2px solid #e0e0e0',
                              borderRadius: '8px',
                              fontSize: '15px',
                              lineHeight: '1.6',
                              resize: 'vertical',
                              outline: 'none',
                              transition: 'border-color 0.3s'
                            }}
                            onFocus={(e: React.FocusEvent<HTMLTextAreaElement>) => e.target.style.borderColor = '#8B5CF6'}
                            onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) => e.target.style.borderColor = '#e0e0e0'}
                          />
                          <div style={{
                            marginTop: '10px',
                            fontSize: '14px',
                            color: '#666',
                            textAlign: 'right'
                          }}>
                            {essay.length} karakter
                          </div>
                        </div>

                        {/* Değerlendirme Butonu ve Sonuç */}
                        <div className="evaluation-section" style={{textAlign: 'center'}}>
                          <button
                            onClick={() => evaluateWriting(taskKey)}
                            disabled={writingLoading || essay.trim().length < 50}
                            style={{
                              background: '#8B5CF6',
                              color: 'white',
                              padding: '15px 30px',
                              fontSize: '18px',
                              fontWeight: 'bold',
                              borderRadius: '25px',
                              border: 'none',
                              cursor: (writingLoading || essay.trim().length < 50) ? 'not-allowed' : 'pointer',
                              opacity: (writingLoading || essay.trim().length < 50) ? 0.7 : 1,
                              marginBottom: '20px'
                            }}
                          >
                            {writingLoading ? '🔄 Değerlendiriliyor...' : '📊 Değerlendir'}
                          </button>

                          {result && (
                            <div className="result-section" style={{
                              background: '#f8f9fa',
                              padding: '25px',
                              borderRadius: '12px',
                              border: '2px solid #8B5CF6',
                              marginTop: '20px',
                              textAlign: 'left'
                            }}>
                              <h5 style={{color: '#8B5CF6', fontSize: '18px', marginBottom: '20px', textAlign: 'center'}}>
                                📊 Task {currentWritingTask + 1} Sonuçları
                              </h5>
                              
                              {/* Band Score */}
                              <div style={{textAlign: 'center', marginBottom: '20px'}}>
                                <div style={{
                                  background: 'white',
                                  padding: '15px',
                                  borderRadius: '8px',
                                  border: '1px solid #e0e0e0',
                                  display: 'inline-block'
                                }}>
                                  <strong style={{color: '#8B5CF6'}}>Band Score:</strong>
                                  <span style={{fontSize: '32px', fontWeight: 'bold', color: '#8B5CF6', marginLeft: '10px'}}>
                                    {result.overall_band || 'N/A'}
                                  </span>
                                </div>
                              </div>

                              {/* Criteria Scores */}
                              {result.criteria && (
                                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px'}}>
                                  {Object.entries(result.criteria).map(([criterion, score]) => (
                                    <div key={criterion} style={{
                                      background: 'white',
                                      padding: '15px',
                                      borderRadius: '8px',
                                      border: '1px solid #e0e0e0',
                                      textAlign: 'center'
                                    }}>
                                      <strong style={{color: '#8B5CF6'}}>{criterion}</strong><br/>
                                      <span style={{fontSize: '24px', fontWeight: 'bold', color: '#8B5CF6'}}>
                                        {score as number}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Feedback */}
                              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                                {result.strengths && result.strengths.length > 0 && (
                        <div>
                                    <h6 style={{color: '#28a745', marginBottom: '10px'}}>✅ Güçlü Yönler:</h6>
                                    <ul style={{margin: 0, paddingLeft: '20px', fontSize: '14px'}}>
                                      {result.strengths.map((strength: string, i: number) => (
                                        <li key={i} style={{marginBottom: '5px'}}>{strength}</li>
                                      ))}
                          </ul>
                        </div>
                      )}
                                {result.weaknesses && result.weaknesses.length > 0 && (
                                  <div>
                                    <h6 style={{color: '#dc3545', marginBottom: '10px'}}>🔧 Gelişim Alanları:</h6>
                                    <ul style={{margin: 0, paddingLeft: '20px', fontSize: '14px'}}>
                                      {result.weaknesses.map((weakness: string, i: number) => (
                                        <li key={i} style={{marginBottom: '5px'}}>{weakness}</li>
                                      ))}
                                    </ul>
                    </div>
                  )}
                              </div>

                              {result.suggestions && result.suggestions.length > 0 && (
                                <div style={{marginTop: '20px'}}>
                                  <h6 style={{color: '#8B5CF6', marginBottom: '10px'}}>💡 Öneriler:</h6>
                                  <ul style={{margin: 0, paddingLeft: '20px', fontSize: '14px'}}>
                                    {result.suggestions.map((suggestion: string, i: number) => (
                                      <li key={i} style={{marginBottom: '5px'}}>{suggestion}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Task Navigasyon Butonları */}
                  <div className="task-navigation-buttons" style={{
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginTop: '30px',
                    padding: '20px 0'
                  }}>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setCurrentWritingTask(Math.max(0, currentWritingTask - 1))}
                      disabled={currentWritingTask === 0}
                      style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        opacity: currentWritingTask === 0 ? 0.5 : 1,
                        cursor: currentWritingTask === 0 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      ← Önceki Task
                    </button>
                    
                    <div className="task-info" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      <span>Task {currentWritingTask + 1} / 2</span>
                      <span>
                        {currentWritingTask === 0 ? 
                          (writingMode === 'academic' ? 'Grafik Analizi' : 'Mektup') : 
                          'Essay'
                        }
                      </span>
                    </div>
                    
                    <button 
                      className="btn btn-primary"
                      onClick={() => setCurrentWritingTask(Math.min(1, currentWritingTask + 1))}
                      disabled={currentWritingTask === 1}
                      style={{
                        background: '#8B5CF6',
                        color: 'white',
                        padding: '12px 24px',
                        fontSize: '16px',
                        opacity: currentWritingTask === 1 ? 0.5 : 1,
                        cursor: currentWritingTask === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Sonraki Task →
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : steps[currentStep].name === 'Speaking' ? (
            <div className="speaking-module">
              <div className="ielts-instructions">
                <h3>🗣️ IELTS Speaking Test</h3>
                <p>3 bölümden oluşur: Part 1 (Giriş ve Röportaj), Part 2 (Cue Card), Part 3 (Tartışma).</p>
                <div className="section-controls" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className={`btn ${speakingPart === 1 ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSpeakingPart(1)}>Part 1</button>
                  <button className={`btn ${speakingPart === 2 ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSpeakingPart(2)}>Part 2</button>
                  <button className={`btn ${speakingPart === 3 ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSpeakingPart(3)}>Part 3</button>
                </div>
              </div>

              {speakingError && (
                <div className="error-message" style={{color:'#d33', background:'#ffe6e6', padding:10, borderRadius:6, margin:'10px 0'}}>
                  ❌ {speakingError}
                </div>
              )}

              {/* Content per Part */}
              {speakingPart === 1 && (
                <div className="card" style={{ marginTop: 10 }}>
                  <h4>Part 1: Introduction and Interview</h4>
                  <div style={{ marginTop: 10 }}>
                    {speakingPrompts.part1.map((q, i) => (
                      <div key={`p1_${i}`} style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 6, fontWeight: 500 }}>
                          {i + 1}. {q}
                        </div>
                        <textarea
                          value={part1Answers[i]}
                          readOnly
                          placeholder="Konuşmanız buraya otomatik yazılacak (elle yazılamaz)"
                          style={{ width:'100%', minHeight: 90, padding: 12, border:'1px solid #e0e0e0', borderRadius: 8, background:'#fafafa', cursor:'not-allowed' }}
                        />
                        <div style={{ marginTop: 8 }}>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              setActiveRecordingIndex(i);
                              if (isRecording) { stopSpeakingRecording(); } else { startSpeakingRecording(); }
                            }}
                            disabled={isProcessingSpeech}
                            style={{ display:'inline-flex', alignItems:'center', gap:8 }}
                          >
                            {isRecording && activeRecordingIndex === i ? <Square className="icon" /> : <Mic className="icon" />}
                            {isRecording && activeRecordingIndex === i ? 'Kaydı Durdur' : 'Kaydı Başlat'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {speakingPart === 2 && (
                <div className="card" style={{ marginTop: 10 }}>
                  <h4>Part 2: Long Turn (Cue Card)</h4>
                  <div style={{ background:'#f8f9fa', border:'1px solid #e0e0e0', borderRadius:8, padding:14 }}>
                    <strong>Topic:</strong> {speakingPrompts.part2.topic}
                    <ul style={{ marginTop: 8 }}>
                      {speakingPrompts.part2.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <textarea
                      value={transcripts.part2}
                      readOnly
                      placeholder="Konuşmanız buraya otomatik yazılacak (elle yazılamaz)"
                      style={{ width:'100%', minHeight: 120, padding: 12, border:'1px solid #e0e0e0', borderRadius: 8, background:'#fafafa', cursor:'not-allowed' }}
                    />
                    <div style={{ display:'flex', gap:10, alignItems:'center', marginTop: 10 }}>
                      <button className="btn btn-primary" onClick={() => { setActiveRecordingIndex(null); if (isRecording) { stopSpeakingRecording(); } else { startSpeakingRecording(); } }} disabled={isProcessingSpeech}>
                        {isRecording ? 'Kaydı Durdur' : 'Kaydı Başlat'}
                      </button>
                      {isProcessingSpeech && <span style={{ color:'#666' }}>Ses işleniyor...</span>}
                    </div>
                  </div>
                </div>
              )}

              {speakingPart === 3 && (
                <div className="card" style={{ marginTop: 10 }}>
                  <h4>Part 3: Discussion</h4>
                  <div style={{ marginTop: 10 }}>
                    {speakingPrompts.part3.map((q, i) => (
                      <div key={`p3_${i}`} style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 6, fontWeight: 500 }}>
                          {i + 1}. {q}
                        </div>
                        <textarea
                          value={part3Answers[i]}
                          readOnly
                          placeholder="Konuşmanız buraya otomatik yazılacak (elle yazılamaz)"
                          style={{ width:'100%', minHeight: 90, padding: 12, border:'1px solid #e0e0e0', borderRadius: 8, background:'#fafafa', cursor:'not-allowed' }}
                        />
                        <div style={{ marginTop: 8 }}>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              setActiveRecordingIndex(i);
                              if (isRecording) { stopSpeakingRecording(); } else { startSpeakingRecording(); }
                            }}
                            disabled={isProcessingSpeech}
                            style={{ display:'inline-flex', alignItems:'center', gap:8 }}
                          >
                            {isRecording && activeRecordingIndex === i ? <Square className="icon" /> : <Mic className="icon" />}
                            {isRecording && activeRecordingIndex === i ? 'Kaydı Durdur' : 'Kaydı Başlat'}
                          </button>
                        </div>
                      </div>
                    ))}
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