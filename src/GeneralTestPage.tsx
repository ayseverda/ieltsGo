import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Clock, CheckCircle, Play, Pause, RotateCcw, Mic, Square } from 'lucide-react';
import TestEvaluation from './components/TestEvaluation';

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
  const [speakingTestStarted, setSpeakingTestStarted] = useState<boolean>(false);
  const [speakingPart, setSpeakingPart] = useState<number>(1); // 1,2,3
  const [currentSpeakingQuestion, setCurrentSpeakingQuestion] = useState<number>(0);
  const [speakingQuestions, setSpeakingQuestions] = useState<{
    part1: { question: string; audioUrl?: string }[];
    part2: { topic: string; bullets: string[]; audioUrl?: string };
    part3: { question: string; audioUrl?: string }[];
  }>({
    part1: [],
    part2: { topic: '', bullets: [] },
    part3: []
  });
  const [speakingAnswers, setSpeakingAnswers] = useState<{
    part1: string[];
    part2: string;
    part3: string[];
  }>({
    part1: ['', '', '', ''],
    part2: '',
    part3: ['', '', '']
  });
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessingSpeech, setIsProcessingSpeech] = useState<boolean>(false);
  const [speakingError, setSpeakingError] = useState<string>('');
  const [speakingLoading, setSpeakingLoading] = useState<boolean>(false);
  const [speakingEvaluation, setSpeakingEvaluation] = useState<any>(null);
  const [speakingEvaluating, setSpeakingEvaluating] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // Genel deneme sonuçları için state'ler
  const [generalTestResults, setGeneralTestResults] = useState<{
    reading: number;
    listening: number;
    writing: number;
    speaking: number;
    overall: number;
    detailedEvaluation: string;
    moduleEvaluations: {
      reading: { score: number; feedback: string };
      listening: { score: number; feedback: string };
      writing: { score: number; feedback: string };
      speaking: { score: number; feedback: string };
    };
  } | null>(null);
  const [isEvaluatingGeneralTest, setIsEvaluatingGeneralTest] = useState<boolean>(false);
  const [showDetailedEvaluation, setShowDetailedEvaluation] = useState<boolean>(false);
  const [showTestEvaluation, setShowTestEvaluation] = useState<boolean>(false);
  const [listeningResult, setListeningResult] = useState<any>(null);
  // Speaking test başlatma fonksiyonu
  const startSpeakingTest = async () => {
    try {
      setSpeakingLoading(true);
      setSpeakingError('');
      
      // AI ile speaking soruları oluştur
      const response = await fetch('http://localhost:8005/generate-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part1_count: 4,
          part3_count: 3,
          difficulty: 'intermediate'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Speaking test generation error:', errorText);
        throw new Error(`Test oluşturma hatası: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      setSpeakingQuestions(data);
      setSpeakingTestStarted(true);
      setSpeakingPart(1);
      setCurrentSpeakingQuestion(0);
      
      // Sorular için ses dosyaları oluştur
      await generateAudioForQuestions(data);
      
    } catch (error: any) {
      setSpeakingError(error.message || 'Test oluşturma hatası');
    } finally {
      setSpeakingLoading(false);
    }
  };

  // Sorular için ses dosyaları oluştur
  const generateAudioForQuestions = async (questions: any) => {
    try {
      // Part 1 soruları için ses oluştur
      for (let i = 0; i < questions.part1.length; i++) {
        const audioUrl = await generateAudio(questions.part1[i].question);
        setSpeakingQuestions(prev => ({
          ...prev,
          part1: prev.part1.map((q, idx) => 
            idx === i ? { ...q, audioUrl } : q
          )
        }));
      }
      
      // Part 2 için ses oluştur
      const part2Text = `Topic: ${questions.part2.topic}. ${questions.part2.bullets.join('. ')}`;
      const part2AudioUrl = await generateAudio(part2Text);
      setSpeakingQuestions(prev => ({
        ...prev,
        part2: { ...prev.part2, audioUrl: part2AudioUrl }
      }));
      
      // Part 3 soruları için ses oluştur
      for (let i = 0; i < questions.part3.length; i++) {
        const audioUrl = await generateAudio(questions.part3[i].question);
        setSpeakingQuestions(prev => ({
          ...prev,
          part3: prev.part3.map((q, idx) => 
            idx === i ? { ...q, audioUrl } : q
          )
        }));
      }
    } catch (error) {
      console.error('Audio generation error:', error);
    }
  };

  // Text'i ses'e çevir
  const generateAudio = async (text: string): Promise<string> => {
    try {
      const response = await fetch('http://localhost:8005/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voice_id: 'EXAVITQu4vr4xnSDxMaL' // Bella voice
        })
      });
      
      if (!response.ok) {
        throw new Error('TTS error');
      }
      
      const data = await response.json();
      return `data:audio/mpeg;base64,${data.audio_data}`;
    } catch (error) {
      console.error('TTS error:', error);
      return '';
    }
  };

  // Yeni speaking kayıt fonksiyonları
  const startSpeakingRecording = async () => {
    try {
      setSpeakingError('');
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        processSpeakingAudio();
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e: any) {
      setSpeakingError(e?.message || 'Mikrofon erişim hatası');
    }
  };

  const stopSpeakingRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processSpeakingAudio = () => {
    try {
      if (audioChunksRef.current.length === 0) throw new Error('Ses yakalanamadı');
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];
          
          const response = await fetch('http://localhost:8005/speech-to-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio_data: base64Audio, format: 'webm' })
          });
          
          if (!response.ok) {
            throw new Error(`STT API error: ${response.status}`);
          }
          
          const data = await response.json();
          const text = (data.text || '').trim();
          
          if (!text) {
            throw new Error('Boş metin');
          }

          // Yeni state sistemi ile güncelleme
          if (speakingPart === 1) {
            setSpeakingAnswers(prev => ({
              ...prev,
              part1: prev.part1.map((answer, i) => 
                i === currentSpeakingQuestion ? text : answer
              )
            }));
          } else if (speakingPart === 2) {
            setSpeakingAnswers(prev => ({
              ...prev,
              part2: prev.part2 + (prev.part2 ? ' ' : '') + text
            }));
          } else if (speakingPart === 3) {
            setSpeakingAnswers(prev => ({
              ...prev,
              part3: prev.part3.map((answer, i) => 
                i === currentSpeakingQuestion ? text : answer
              )
            }));
          }
          
        } catch (err: any) {
          setSpeakingError(err?.message || 'STT hata');
        } finally {
          setIsProcessingSpeech(false);
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (e: any) {
      setSpeakingError(e?.message || 'Ses işleme hatası');
      setIsProcessingSpeech(false);
    }
  };

  // Speaking değerlendirme fonksiyonu
  const evaluateSpeakingTest = async () => {
    try {
      setSpeakingEvaluating(true);
      setSpeakingError('');
      
      const response = await fetch('http://localhost:8005/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part1_answers: speakingAnswers.part1,
          part2_answer: speakingAnswers.part2,
          part3_answers: speakingAnswers.part3,
          questions: speakingQuestions
        })
      });
      
      if (!response.ok) {
        throw new Error(`Değerlendirme hatası: ${response.status}`);
      }
      
      const evaluation = await response.json();
      setSpeakingEvaluation(evaluation);
      
    } catch (error: any) {
      setSpeakingError(error.message || 'Değerlendirme hatası');
    } finally {
      setSpeakingEvaluating(false);
    }
  };

  // Writing modülü için durumlar
  const [writingMode, setWritingMode] = useState<string>('academic'); // academic | general
  // const [, setWritingTask] = useState<string>('task1'); // task1 | task2
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

  // Sınav tamamlandıysa sonuç sayfasını göster
  useEffect(() => {
    // Bu effect yalnızca sonuç ekranına ilk girişte bir kez çalışsın
    if (!testCompleted) return;
    
    const onceKey = 'general_test_saved_once';
    if (sessionStorage.getItem(onceKey)) return;
    sessionStorage.setItem(onceKey, '1');
    // Basit placeholder skorlar: Reading sonucu varsa kullan, diğerleri 0
    const estimatedReading = readingResult?.band_estimate || 0;
    completeGeneralMockAndSave({ reading: Number(estimatedReading) || 0 });
  }, [testCompleted, readingResult?.band_estimate]);

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

  // Genel deneme için detaylı IELTS değerlendirmesi
  const evaluateGeneralTest = async () => {
    try {
      setIsEvaluatingGeneralTest(true);
      
      // Mevcut sonuçları topla
      const results = {
        reading: readingResult?.band_estimate || 0,
        listening: 0, // Listening henüz implement edilmedi
        writing: 0, // Writing henüz implement edilmedi
        speaking: speakingEvaluation?.overall_band || 0
      };

      // Overall skor hesapla
      const overall = (results.reading + results.listening + results.writing + results.speaking) / 4;

      // AI ile detaylı değerlendirme yap
      const evaluationPrompt = `
        IELTS Genel Deneme Değerlendirmesi yapın. Kullanıcının sonuçları:
        
        Reading: ${results.reading}/9
        Listening: ${results.listening}/9 (henüz test edilmedi)
        Writing: ${results.writing}/9 (henüz test edilmedi)
        Speaking: ${results.speaking}/9
        
        Overall Band Score: ${overall.toFixed(1)}/9
        
        Lütfen aşağıdaki formatta detaylı değerlendirme yapın:
        
        {
          "detailed_evaluation": "Genel değerlendirme metni...",
          "module_evaluations": {
            "reading": {
              "score": ${results.reading},
              "feedback": "Reading modülü için detaylı geri bildirim..."
            },
            "listening": {
              "score": ${results.listening},
              "feedback": "Listening modülü için detaylı geri bildirim..."
            },
            "writing": {
              "score": ${results.writing},
              "feedback": "Writing modülü için detaylı geri bildirim..."
            },
            "speaking": {
              "score": ${results.speaking},
              "feedback": "Speaking modülü için detaylı geri bildirim..."
            }
          },
          "recommendations": [
            "Öneri 1: Reading için...",
            "Öneri 2: Speaking için...",
            "Öneri 3: Genel gelişim için..."
          ]
        }
        
        Türkçe yanıt verin ve IELTS band score sistemine uygun değerlendirme yapın.
      `;

      // AI değerlendirmesi için backend'e istek gönder
      const response = await fetch('http://localhost:8005/evaluate-general-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: results,
          overall_score: overall,
          evaluation_prompt: evaluationPrompt
        })
      });

      if (response.ok) {
        const evaluation = await response.json();
        setGeneralTestResults({
          reading: results.reading,
          listening: results.listening,
          writing: results.writing,
          speaking: results.speaking,
          overall: overall,
          detailedEvaluation: evaluation.detailed_evaluation || 'Detaylı değerlendirme hazırlanıyor...',
          moduleEvaluations: evaluation.module_evaluations || {
            reading: { score: results.reading, feedback: 'Reading modülü değerlendirmesi hazırlanıyor...' },
            listening: { score: results.listening, feedback: 'Listening modülü henüz test edilmedi.' },
            writing: { score: results.writing, feedback: 'Writing modülü henüz test edilmedi.' },
            speaking: { score: results.speaking, feedback: 'Speaking modülü değerlendirmesi hazırlanıyor...' }
          }
        });
        setShowDetailedEvaluation(true);
      } else {
        // Fallback: Basit değerlendirme
        setGeneralTestResults({
          reading: results.reading,
          listening: results.listening,
          writing: results.writing,
          speaking: results.speaking,
          overall: overall,
          detailedEvaluation: `IELTS Genel Deneme Sonucunuz: ${overall.toFixed(1)}/9. Reading: ${results.reading}, Speaking: ${results.speaking}. Diğer modüller henüz tamamlanmadı.`,
          moduleEvaluations: {
            reading: { score: results.reading, feedback: `Reading modülünde ${results.reading}/9 puan aldınız.` },
            listening: { score: results.listening, feedback: 'Listening modülü henüz test edilmedi.' },
            writing: { score: results.writing, feedback: 'Writing modülü henüz test edilmedi.' },
            speaking: { score: results.speaking, feedback: `Speaking modülünde ${results.speaking}/9 puan aldınız.` }
          }
        });
        setShowDetailedEvaluation(true);
      }

    } catch (error) {
      console.error('Genel deneme değerlendirme hatası:', error);
      // Hata durumunda basit sonuç göster
      setGeneralTestResults({
        reading: readingResult?.band_estimate || 0,
        listening: 0,
        writing: 0,
        speaking: speakingEvaluation?.overall_band || 0,
        overall: ((readingResult?.band_estimate || 0) + (speakingEvaluation?.overall_band || 0)) / 2,
        detailedEvaluation: 'Değerlendirme hazırlanırken bir hata oluştu.',
        moduleEvaluations: {
          reading: { score: readingResult?.band_estimate || 0, feedback: 'Reading modülü değerlendirmesi.' },
          listening: { score: 0, feedback: 'Listening modülü henüz test edilmedi.' },
          writing: { score: 0, feedback: 'Writing modülü henüz test edilmedi.' },
          speaking: { score: speakingEvaluation?.overall_band || 0, feedback: 'Speaking modülü değerlendirmesi.' }
        }
      });
      setShowDetailedEvaluation(true);
    } finally {
      setIsEvaluatingGeneralTest(false);
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

        {!showDetailedEvaluation ? (
        <div className="card">
          <h2>📊 Sınav Sonuçları</h2>
          <div className="results-grid">
            {steps.map((step, index) => (
              <div key={index} className="result-card">
                <h3>{step.name}</h3>
                <div className="result-score">
                  <span className="score-label">Puan:</span>
                    <span className="score-value">
                      {index === 0 && readingResult ? readingResult.band_estimate?.toFixed(1) || '0.0' : 
                       index === 3 && speakingEvaluation ? speakingEvaluation.overall_band?.toFixed(1) || '0.0' : 
                       '-'}
                    </span>
                </div>
                  <p className="result-note">
                    {index === 0 && readingResult ? 'Reading modülü tamamlandı' :
                     index === 3 && speakingEvaluation ? 'Speaking modülü tamamlandı' :
                     'Bu modül henüz geliştirilme aşamasındadır.'}
                  </p>
              </div>
            ))}
          </div>

          <div className="total-score">
              <h3>Genel Puan: {generalTestResults ? generalTestResults.overall.toFixed(1) : '-'}</h3>
              <p>Detaylı IELTS değerlendirmesi için aşağıdaki butona tıklayın.</p>
            </div>

            <div className="text-center mt-4">
              <button 
                className="btn btn-primary" 
                onClick={evaluateGeneralTest}
                disabled={isEvaluatingGeneralTest}
                style={{ marginRight: '10px' }}
              >
                {isEvaluatingGeneralTest ? (
                  <>🔄 Değerlendiriliyor...</>
                ) : (
                  <>📊 IELTS Puanımı Hesapla</>
                )}
              </button>
              <button className="btn btn-outline" onClick={resetTest}>
                <RotateCcw className="icon" />
                Yeni Deneme Başlat
              </button>
              <Link to="/" className="btn btn-outline" style={{ marginLeft: '10px' }}>
                Ana Sayfaya Dön
              </Link>
            </div>
          </div>
        ) : (
          <div className="card">
            <h2>🎯 Detaylı IELTS Değerlendirmesi</h2>
            
            {generalTestResults && (
              <>
                <div className="ielts-scores-overview">
                  <div className="score-grid">
                    <div className="score-item">
                      <span className="score-label">Reading:</span>
                      <span className="score-value">{generalTestResults.reading.toFixed(1)}</span>
                    </div>
                    <div className="score-item">
                      <span className="score-label">Listening:</span>
                      <span className="score-value">{generalTestResults.listening.toFixed(1)}</span>
                    </div>
                    <div className="score-item">
                      <span className="score-label">Writing:</span>
                      <span className="score-value">{generalTestResults.writing.toFixed(1)}</span>
                    </div>
                    <div className="score-item">
                      <span className="score-label">Speaking:</span>
                      <span className="score-value">{generalTestResults.speaking.toFixed(1)}</span>
                    </div>
                    <div className="score-item overall">
                      <span className="score-label">Overall:</span>
                      <span className="score-value">{generalTestResults.overall.toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <div className="detailed-evaluation">
                  <h3>📝 Genel Değerlendirme</h3>
                  <p>{generalTestResults.detailedEvaluation}</p>
                </div>

                <div className="module-evaluations">
                  <h3>📚 Modül Bazında Değerlendirme</h3>
                  <div className="evaluation-grid">
                    <div className="evaluation-card">
                      <h4>📖 Reading ({generalTestResults.moduleEvaluations.reading.score.toFixed(1)})</h4>
                      <p>{generalTestResults.moduleEvaluations.reading.feedback}</p>
                    </div>
                    <div className="evaluation-card">
                      <h4>🎧 Listening ({generalTestResults.moduleEvaluations.listening.score.toFixed(1)})</h4>
                      <p>{generalTestResults.moduleEvaluations.listening.feedback}</p>
                    </div>
                    <div className="evaluation-card">
                      <h4>✍️ Writing ({generalTestResults.moduleEvaluations.writing.score.toFixed(1)})</h4>
                      <p>{generalTestResults.moduleEvaluations.writing.feedback}</p>
                    </div>
                    <div className="evaluation-card">
                      <h4>🗣️ Speaking ({generalTestResults.moduleEvaluations.speaking.score.toFixed(1)})</h4>
                      <p>{generalTestResults.moduleEvaluations.speaking.feedback}</p>
                    </div>
                  </div>
          </div>

          <div className="text-center mt-4">
            <button className="btn btn-primary" onClick={resetTest}>
              <RotateCcw className="icon" />
              Yeni Deneme Başlat
            </button>
                  <Link to="/dashboard" className="btn btn-outline" style={{ marginLeft: '10px' }}>
                    Dashboard'a Git
                  </Link>
                  <Link to="/" className="btn btn-outline" style={{ marginLeft: '10px' }}>
              Ana Sayfaya Dön
            </Link>
          </div>
              </>
            )}
        </div>
        )}
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
                        {readingLoading ? '🔄 Değerlendiriliyor...' : '✅ Testi Tamamla'}
                    </button>
                    {readingResult && (
                        <div style={{ textAlign: 'center', marginTop: '15px' }}>
                          <p style={{ color: '#8B5CF6', fontSize: '16px', fontWeight: '600' }}>
                            ✅ Reading testi tamamlandı! Sonraki modüle geçebilirsiniz.
                          </p>
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
                            {writingLoading ? '🔄 Değerlendiriliyor...' : '✅ Testi Tamamla'}
                          </button>

                          {result && (
                            <div style={{ textAlign: 'center', marginTop: '15px' }}>
                              <p style={{ color: '#8B5CF6', fontSize: '16px', fontWeight: '600' }}>
                                ✅ Writing testi tamamlandı! Sonraki modüle geçebilirsiniz.
                              </p>
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
              {!speakingTestStarted ? (
                <div className="text-center" style={{ padding: '40px' }}>
                  <h3>🗣️ IELTS Speaking Test</h3>
                  <p style={{ marginBottom: '30px', color: '#666' }}>
                    AI ile oluşturulan 3 bölümlü IELTS Speaking testi. Her soru ses olarak dinlenebilir ve cevabınız kayıt edilir.
                  </p>
                  <button 
                    className="btn btn-primary" 
                    onClick={startSpeakingTest}
                    disabled={speakingLoading}
                    style={{ fontSize: '18px', padding: '15px 30px' }}
                  >
                    {speakingLoading ? 'Test Oluşturuluyor...' : '🚀 Speaking Testini Başlat'}
                  </button>
                  {speakingError && (
                    <div className="error-message" style={{ marginTop: '20px', color: '#d33' }}>
                      ❌ {speakingError}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="ielts-instructions">
                    <h3>🗣️ IELTS Speaking Test - Part {speakingPart}</h3>
                    <div className="section-controls" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '20px' }}>
                      <button className={`btn ${speakingPart === 1 ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setSpeakingPart(1); setCurrentSpeakingQuestion(0); }}>Part 1</button>
                      <button className={`btn ${speakingPart === 2 ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setSpeakingPart(2); setCurrentSpeakingQuestion(0); }}>Part 2</button>
                      <button className={`btn ${speakingPart === 3 ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setSpeakingPart(3); setCurrentSpeakingQuestion(0); }}>Part 3</button>
                    </div>
                  </div>

                  {speakingError && (
                    <div className="error-message" style={{color:'#d33', background:'#ffe6e6', padding:10, borderRadius:6, margin:'10px 0'}}>
                      ❌ {speakingError}
                    </div>
                  )}

                  {/* Yeni Speaking UI */}
                  {speakingPart === 1 && (
                    <div className="card" style={{ marginTop: 10 }}>
                      <h4>Part 1: Introduction and Interview</h4>
                      <p style={{ color: '#666', marginBottom: '20px' }}>
                        Soru {currentSpeakingQuestion + 1} / {speakingQuestions.part1.length}
                      </p>
                      
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ marginBottom: '10px', fontWeight: 500 }}>
                          {currentSpeakingQuestion + 1}. {speakingQuestions.part1[currentSpeakingQuestion]?.question}
                        </div>
                        
                        {/* Ses oynatma butonu */}
                        {speakingQuestions.part1[currentSpeakingQuestion]?.audioUrl && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              const audio = new Audio(speakingQuestions.part1[currentSpeakingQuestion].audioUrl);
                              audio.play();
                            }}
                            style={{ marginBottom: '15px' }}
                          >
                            🔊 Soruyu Dinle
                          </button>
                        )}
                        
                        {/* Cevap textarea */}
                        <textarea
                          value={speakingAnswers.part1[currentSpeakingQuestion] || ''}
                          onChange={(e) => {
                            setSpeakingAnswers(prev => ({
                              ...prev,
                              part1: prev.part1.map((answer, i) => 
                                i === currentSpeakingQuestion ? e.target.value : answer
                              )
                            }));
                          }}
                          placeholder="Cevabınızı buraya yazın veya kayıt yapın"
                          style={{ width:'100%', minHeight: 120, padding: 12, border:'1px solid #e0e0e0', borderRadius: 8, background:'#ffffff' }}
                        />
                        
                        {/* Kayıt butonu */}
                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              if (isRecording) { 
                                stopSpeakingRecording(); 
                              } else { 
                                startSpeakingRecording(); 
                              }
                            }}
                            disabled={isProcessingSpeech}
                            style={{ display:'inline-flex', alignItems:'center', gap:8 }}
                          >
                            {isRecording ? <Square className="icon" /> : <Mic className="icon" />}
                            {isRecording ? 'Kaydı Durdur' : 'Kayıt Yap'}
                          </button>
                          
                          {isProcessingSpeech && <span style={{ color:'#666' }}>Ses işleniyor...</span>}
                        </div>
                      </div>
                      
                      {/* Navigasyon butonları */}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                        <button
                          className="btn btn-outline"
                          onClick={() => setCurrentSpeakingQuestion(prev => Math.max(0, prev - 1))}
                          disabled={currentSpeakingQuestion === 0}
                        >
                          ← Önceki Soru
                        </button>
                        
                        <button
                          className="btn btn-primary"
                          onClick={() => setCurrentSpeakingQuestion(prev => Math.min(speakingQuestions.part1.length - 1, prev + 1))}
                          disabled={currentSpeakingQuestion === speakingQuestions.part1.length - 1}
                        >
                          Sonraki Soru →
                        </button>
                      </div>
                    </div>
                  )}

                  {speakingPart === 2 && (
                    <div className="card" style={{ marginTop: 10 }}>
                      <h4>Part 2: Long Turn (Cue Card)</h4>
                      
                      <div style={{ background:'#f8f9fa', border:'1px solid #e0e0e0', borderRadius:8, padding:14, marginBottom: '20px' }}>
                        <strong>Topic:</strong> {speakingQuestions.part2.topic}
                        <ul style={{ marginTop: 8 }}>
                          {speakingQuestions.part2.bullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>
                      
                      {/* Ses oynatma butonu */}
                      {speakingQuestions.part2.audioUrl && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            const audio = new Audio(speakingQuestions.part2.audioUrl);
                            audio.play();
                          }}
                          style={{ marginBottom: '15px' }}
                        >
                          🔊 Cue Card'ı Dinle
                        </button>
                      )}
                      
                      {/* Cevap textarea */}
                      <textarea
                        value={speakingAnswers.part2}
                        onChange={(e) => {
                          setSpeakingAnswers(prev => ({ ...prev, part2: e.target.value }));
                        }}
                        placeholder="Cevabınızı buraya yazın veya kayıt yapın"
                        style={{ width:'100%', minHeight: 150, padding: 12, border:'1px solid #e0e0e0', borderRadius: 8, background:'#ffffff' }}
                      />
                      
                      {/* Kayıt butonu */}
                      <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            if (isRecording) { 
                              stopSpeakingRecording(); 
                            } else { 
                              startSpeakingRecording(); 
                            }
                          }}
                          disabled={isProcessingSpeech}
                          style={{ display:'inline-flex', alignItems:'center', gap:8 }}
                        >
                          {isRecording ? <Square className="icon" /> : <Mic className="icon" />}
                          {isRecording ? 'Kaydı Durdur' : 'Kayıt Yap'}
                        </button>
                        
                        {isProcessingSpeech && <span style={{ color:'#666' }}>Ses işleniyor...</span>}
                      </div>
                    </div>
                  )}

                  {speakingPart === 3 && (
                    <div className="card" style={{ marginTop: 10 }}>
                      <h4>Part 3: Discussion</h4>
                      <p style={{ color: '#666', marginBottom: '20px' }}>
                        Soru {currentSpeakingQuestion + 1} / {speakingQuestions.part3.length}
                      </p>
                      
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ marginBottom: '10px', fontWeight: 500 }}>
                          {currentSpeakingQuestion + 1}. {speakingQuestions.part3[currentSpeakingQuestion]?.question}
                        </div>
                        
                        {/* Ses oynatma butonu */}
                        {speakingQuestions.part3[currentSpeakingQuestion]?.audioUrl && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              const audio = new Audio(speakingQuestions.part3[currentSpeakingQuestion].audioUrl);
                              audio.play();
                            }}
                            style={{ marginBottom: '15px' }}
                          >
                            🔊 Soruyu Dinle
                          </button>
                        )}
                        
                        {/* Cevap textarea */}
                        <textarea
                          value={speakingAnswers.part3[currentSpeakingQuestion] || ''}
                          onChange={(e) => {
                            setSpeakingAnswers(prev => ({
                              ...prev,
                              part3: prev.part3.map((answer, i) => 
                                i === currentSpeakingQuestion ? e.target.value : answer
                              )
                            }));
                          }}
                          placeholder="Cevabınızı buraya yazın veya kayıt yapın"
                          style={{ width:'100%', minHeight: 120, padding: 12, border:'1px solid #e0e0e0', borderRadius: 8, background:'#ffffff' }}
                        />
                        
                        {/* Kayıt butonu */}
                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              if (isRecording) { 
                                stopSpeakingRecording(); 
                              } else { 
                                startSpeakingRecording(); 
                              }
                            }}
                            disabled={isProcessingSpeech}
                            style={{ display:'inline-flex', alignItems:'center', gap:8 }}
                          >
                            {isRecording ? <Square className="icon" /> : <Mic className="icon" />}
                            {isRecording ? 'Kaydı Durdur' : 'Kayıt Yap'}
                          </button>
                          
                          {isProcessingSpeech && <span style={{ color:'#666' }}>Ses işleniyor...</span>}
                        </div>
                      </div>
                      
                      {/* Navigasyon butonları */}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                        <button
                          className="btn btn-outline"
                          onClick={() => setCurrentSpeakingQuestion(prev => Math.max(0, prev - 1))}
                          disabled={currentSpeakingQuestion === 0}
                        >
                          ← Önceki Soru
                        </button>
                        
                        <button
                          className="btn btn-primary"
                          onClick={() => setCurrentSpeakingQuestion(prev => Math.min(speakingQuestions.part3.length - 1, prev + 1))}
                          disabled={currentSpeakingQuestion === speakingQuestions.part3.length - 1}
                        >
                          Sonraki Soru →
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Değerlendirme Bölümü */}
                  <div className="card" style={{ marginTop: '20px', textAlign: 'center' }}>
                    <h4>📊 Speaking Test Değerlendirmesi</h4>
                    <p style={{ color: '#666', marginBottom: '20px' }}>
                      Tüm cevaplarınızı verdikten sonra değerlendirme yapabilirsiniz.
                    </p>
                    
                    <button
                      className="btn btn-success"
                      onClick={evaluateSpeakingTest}
                      disabled={speakingEvaluating || (!speakingAnswers.part1.some(a => a.trim()) && !speakingAnswers.part2.trim() && !speakingAnswers.part3.some(a => a.trim()))}
                      style={{ fontSize: '16px', padding: '12px 24px' }}
                    >
                      {speakingEvaluating ? 'Değerlendiriliyor...' : '🎯 Speaking Testini Değerlendir'}
                    </button>
                    
                    {speakingError && (
                      <div className="error-message" style={{ marginTop: '15px', color: '#d33' }}>
                        ❌ {speakingError}
                      </div>
                    )}
                  </div>
                  
                  {/* Speaking Test Tamamlandı Mesajı */}
                  {speakingEvaluation && (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                      <div style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                        color: 'white', 
                        padding: '20px', 
                        borderRadius: '12px',
                        marginBottom: '20px'
                      }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>
                          🎉 Speaking Testi Tamamlandı!
                        </h3>
                        <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
                          Tüm modüller tamamlandı. Şimdi genel deneme sınavını değerlendirebilirsiniz.
                        </p>
                      </div>
                      
                      <button 
                        className="btn btn-primary" 
                        onClick={() => setShowTestEvaluation(true)}
                        style={{
                          background: '#8B5CF6',
                          color: 'white',
                          padding: '15px 30px',
                          fontSize: '18px',
                          fontWeight: 'bold',
                          borderRadius: '25px',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        📊 Deneme Sınavını Değerlendir
                      </button>
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
      
      {/* Test Evaluation Modal */}
      {showTestEvaluation && (
        <TestEvaluation
          readingResult={readingResult}
          writingResults={writingResults}
          speakingEvaluation={speakingEvaluation}
          listeningResult={null}
          onBack={() => setShowTestEvaluation(false)}
        />
      )}
    </div>
  );
};

export default GeneralTestPage;