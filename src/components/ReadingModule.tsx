import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';

type QuestionType = 'TrueFalseNotGiven' | 'MultipleChoice' | 'MatchingHeadings' | 'FillInTheBlanks';

interface Passage {
  id: string;
  title: string;
  text: string;
}

interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  passage_id?: string;
}

interface ReadingTest {
  id: string;
  source: string;
  passages: Passage[];
  questions: Question[];
}

type ReadingMode = 'academic' | 'general';

const ReadingModule: React.FC = () => {
  const [mode, setMode] = useState<ReadingMode>('academic');
  const [part, setPart] = useState<number>(1);
  const [tests, setTests] = useState<ReadingTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [test, setTest] = useState<ReadingTest | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isLoadingTests, setIsLoadingTests] = useState<boolean>(false);
  const [testsError, setTestsError] = useState<string>('');

  // Fetch available tests
  useEffect(() => {
    const fetchTests = async () => {
      setIsLoadingTests(true);
      setTestsError('');
      try {
        // helper: fetch with timeout
        const fetchWithTimeout = (url: string, ms: number) => {
          const ctrl = new AbortController();
          const id = setTimeout(() => ctrl.abort(), ms);
          return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
        };

        // Try backend first (quick timeout)
        let data: any | null = null;
        try {
          const res = await fetchWithTimeout('http://localhost:8001/tests', 1000);
          if (res.ok) {
            data = await res.json();
          }
        } catch {}
        // Fallback to static file
        if (!data) {
          const res2 = await fetch('reading/tests.json');
          if (!res2.ok) throw new Error('Yerel tests.json okunamadı');
          data = await res2.json();
        }

        const list: ReadingTest[] = data.tests || [];
        setTests(list);
        if (list.length > 0) {
          setSelectedTestId(list[0].id);
        }
      } catch (e: any) {
        console.error(e);
        setTestsError(e?.message || 'Testler yüklenemedi');
      } finally {
        setIsLoadingTests(false);
      }
    };
    fetchTests();
  }, []);

  // Fetch selected test
  useEffect(() => {
    if (!selectedTestId) return;
    const fetchTest = async () => {
      try {
        let data: any | null = null;
        try {
          const ctrl = new AbortController();
          const id = setTimeout(() => ctrl.abort(), 1000);
          const res = await fetch(`http://localhost:8001/tests/${selectedTestId}`, { signal: ctrl.signal });
          clearTimeout(id);
          if (res.ok) data = await res.json();
        } catch {}
        if (!data) {
          // fallback: find from static list we already loaded
          const found = tests.find(t => t.id === selectedTestId);
          data = found ?? null;
        }
        setTest(data || null);
        setAnswers({});
        setResult(null);
      } catch (e) {
        console.error(e);
      }
    };
    fetchTest();
  }, [selectedTestId, tests]);

  const passage = useMemo(() => (test?.passages?.[0] ?? null), [test]);
  const questionsForPassage = useMemo(() => {
    if (!test || !passage) return [] as Question[];
    return test.questions.filter(q => (q.passage_id ?? passage.id) === passage.id);
  }, [test, passage]);

  const handleAnswer = (qid: string, value: string) => {
    setAnswers(prev => ({ ...prev, [qid]: value }));
  };

  const saveScoreToDatabase = async (scoreData: any) => {
    try {
      console.log('💾 Reading puan kaydetme başlatılıyor...', scoreData);
      
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
        console.log('✅ Reading puanı başarıyla kaydedildi:', result);
      } else {
        const errorText = await response.text();
        console.error('❌ Reading puan kaydetme hatası:', errorText);
      }
    } catch (error) {
      console.error('❌ Reading puan kaydetme hatası:', error);
    }
  };

  const submit = async () => {
    if (!test) return;
    setSubmitting(true);
    try {
      const res = await fetch('http://localhost:8001/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_id: test.id, answers })
      });
      const data = await res.json();
      setResult(data);

      // Puanı veritabanına kaydet
      await saveScoreToDatabase({
        module: 'reading',
        band_score: data.band_estimate || 0,
        raw_score: data.scaled?.correct || 0,
        total_questions: data.scaled?.total || data.raw?.total || 0,
        topic: test.source || 'Reading Test',
        difficulty: mode === 'academic' ? 'advanced' : 'intermediate',
        accent: null, // Reading'de accent yok
        detailed_results: {
          raw_score: data.raw || {},
          scaled_score: data.scaled || {},
          feedback: data.feedback || {},
          test_id: test.id,
          part: part
        }
      });

      // persist feedback history
      const entry = {
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        mode,
        part,
        test_id: test.id,
        source: test.source,
        summary: { band_estimate: data.band_estimate, scaled: data.scaled }
      };
      const key = 'readingFeedback';
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.unshift(entry);
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 50)));
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const feedbackHistory: Array<any> = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('readingFeedback') || '[]');
    } catch { return []; }
  }, [result]);

  return (
    <div className="container">
      <div className="card">
        <div className="mb-4">
          <Link to="/" className="btn mb-2">
            <ArrowLeft style={{ marginRight: '8px' }} />
            Ana Sayfaya Dön
          </Link>
          <h1 className="module-header">
            <BookOpen />
            Reading Modülü
          </h1>
        </div>

        {/* Mode and Part Tabs */}
        <div className="card mb-4">
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <div style={{ display: 'inline-flex', gap: '8px', background: 'var(--card-bg)', padding: '6px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => setMode('academic')}
                  className="btn"
                  style={{ background: mode === 'academic' ? 'var(--accent)' : 'transparent', color: mode === 'academic' ? '#fff' : 'var(--text)' }}
                >Academic</button>
                <button
                  onClick={() => setMode('general')}
                  className="btn"
                  style={{ background: mode === 'general' ? 'var(--accent)' : 'transparent', color: mode === 'general' ? '#fff' : 'var(--text)' }}
                >General</button>
              </div>
            </div>
            <div style={{ justifySelf: 'end' }}>
              <div style={{ display: 'inline-flex', gap: '8px', background: 'var(--card-bg)', padding: '6px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.08)' }}>
                {[1,2,3].map(p => (
                  <button
                    key={p}
                    onClick={() => setPart(p)}
                    className="btn"
                    style={{ background: part === p ? 'var(--accent)' : 'transparent', color: part === p ? '#fff' : 'var(--text)' }}
                  >Part {p}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Test chooser as cards */}
          <div className="mt-3">
            {isLoadingTests && <p>Testler yükleniyor...</p>}
            {!isLoadingTests && testsError && (
              <div className="card" style={{ padding: '12px', marginTop: '8px' }}>
                <p style={{ marginBottom: '8px' }}>Testler alınamadı. Reading servisi çalışıyor mu? (http://localhost:8001)</p>
                <button className="btn" onClick={() => { setTestsError(''); setIsLoadingTests(true); fetch('http://localhost:8001/tests').then(r=>r.json()).then(d=>{ setTests(d.tests||[]); if((d.tests||[]).length>0){setSelectedTestId(d.tests[0].id);} }).catch(err=>setTestsError(String(err))).finally(()=>setIsLoadingTests(false)); }}>Tekrar Dene</button>
              </div>
            )}
            {!isLoadingTests && !testsError && (
              <div className="grid">
                {tests.map(t => {
                  const active = t.id === selectedTestId;
                  return (
                    <button key={t.id} className="test-card" onClick={() => setSelectedTestId(t.id)} aria-pressed={active}>
                      <div className="test-card-title">{t.source}</div>
                      <div className="test-card-sub">{t.id}</div>
                      {active && <div className="test-card-badge">Seçili</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Split layout */}
        {test && passage ? (
          <div className="reading-split">
            <div className="pane">
              <div className="pane-header">📖 {passage.title}</div>
              <div className="pane-content">
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{passage.text}</p>
              </div>
            </div>
            <div className="pane">
              <div className="pane-header">❓ Sorular</div>
              <div className="pane-content">
                {questionsForPassage.map((q, idx) => (
                  <div key={q.id} className="mb-3" style={{ paddingBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.08)' }}>
                    <p><strong>{idx + 1}.</strong> {q.prompt}</p>
                    {q.type === 'MultipleChoice' && q.options && (
                      <div>
                        {q.options.map((opt, i) => (
                          <label key={i} style={{ display: 'block', margin: '6px 0' }}>
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={(answers[q.id] ?? '') === opt}
                              onChange={(e) => handleAnswer(q.id, e.target.value)}
                              style={{ marginRight: '8px' }}
                            />
                            {String.fromCharCode(65 + i)}. {opt}
                          </label>
                        ))}
                      </div>
                    )}
                    {q.type === 'TrueFalseNotGiven' && (
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {['True','False','Not Given'].map(opt => (
                          <label key={opt}>
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={(answers[q.id] ?? '') === opt}
                              onChange={(e) => handleAnswer(q.id, e.target.value)}
                              style={{ marginRight: '8px' }}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}
                    {q.type === 'FillInTheBlanks' && (
                      <input
                        className="form-control"
                        placeholder="Cevabınızı yazın"
                        value={answers[q.id] ?? ''}
                        onChange={(e) => handleAnswer(q.id, e.target.value)}
                      />
                    )}
                    {q.type === 'MatchingHeadings' && q.options && (
                      <select
                        className="form-control"
                        value={answers[q.id] ?? ''}
                        onChange={(e) => handleAnswer(q.id, e.target.value)}
                      >
                        <option value="" disabled>Başlık seçin</option>
                        {q.options.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}

                <button className="btn" onClick={submit} disabled={submitting}>
                  {submitting ? 'Gönderiliyor...' : '📊 Cevapları Gönder'}
                </button>

                {result && (
                  <div className="mt-4" style={{ padding: '16px', borderRadius: '12px', background: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}>
                    <h3>Sonuç</h3>
                    <p><strong>Band Tahmini:</strong> {result.band_estimate}</p>
                    <p><strong>Doğru:</strong> {result.scaled?.correct}/{result.scaled?.total}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card"><p>{selectedTestId ? 'Test yükleniyor...' : (isLoadingTests ? 'Test listesi yükleniyor...' : 'Test bulunamadı')}</p></div>
        )}

        {/* Feedback history */}
        <div className="card mt-4">
          <h3>📝 Feedback Geçmişi</h3>
          {feedbackHistory.length === 0 ? (
            <p>Henüz bir değerlendirme yok.</p>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {feedbackHistory.map(item => (
                <div key={item.id} className="card" style={{ margin: 0 }}>
                  <div style={{ fontWeight: 600 }}>{item.source}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>{new Date(item.timestamp).toLocaleString()}</div>
                  <div className="mt-3">
                    <div><strong>Band:</strong> {item.summary?.band_estimate}</div>
                    <div><strong>Skor:</strong> {item.summary?.scaled?.correct}/{item.summary?.scaled?.total}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>Mode: {item.mode}, Part {item.part}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReadingModule;
