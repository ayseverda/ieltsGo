import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, PenTool, Headphones, Mic, Trophy, BarChart3 } from 'lucide-react';
import axios from 'axios';

// Logo imports
import headerLogo from '../assets/ieltsgoyazi.png';
import kitapLogo from '../assets/ieltsgokitap.png';

const WritingModule: React.FC = () => {
  const [essay, setEssay] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [topic, setTopic] = useState<string>('');
  const [mode, setMode] = useState<'academic' | 'general' | ''>('');
  const [task, setTask] = useState<'task1' | 'task2' | ''>('');
  const [letterType, setLetterType] = useState<'formal' | 'informal' | ''>('');
  const [visual, setVisual] = useState<any>(null);

  const generateLocalVisual = (prev?: any) => {
    const kinds = ['table', 'bar', 'pie'] as const;
    const makeOnce = () => {
      const pick = kinds[Math.floor(Math.random() * kinds.length)];
      if (pick === 'table') {
        const baseYear = 2015 + Math.floor(Math.random() * 6);
        return {
          type: 'table',
          columns: ['Year', 'Category A', 'Category B'],
          rows: [
            [baseYear, 20 + Math.floor(Math.random() * 20), 15 + Math.floor(Math.random() * 20)],
            [baseYear + 4, 30 + Math.floor(Math.random() * 25), 25 + Math.floor(Math.random() * 25)],
          ],
        };
      }
      if (pick === 'bar') {
        const labels = ['A', 'B', 'C', 'D'];
        const values = labels.map(() => 10 + Math.floor(Math.random() * 30));
        return { type: 'bar', labels, values };
      }
      const labels = ['Online', 'In-person', 'Hybrid'];
      const a = 30 + Math.floor(Math.random() * 40);
      const b = 20 + Math.floor(Math.random() * 40);
      const rest = Math.max(10, 100 - (a + b));
      return { type: 'pie', labels, values: [a, b, rest] };
    };

    const isSame = (a: any, b: any) => {
      if (!a || !b) return false;
      if (a.type !== b.type) return false;
      if (a.type === 'table') return JSON.stringify(a.rows) === JSON.stringify(b.rows);
      return JSON.stringify(a.values) === JSON.stringify(b.values);
    };

    let v = makeOnce();
    let guard = 0;
    while (isSame(v, prev) && guard < 5) {
      v = makeOnce();
      guard += 1;
    }
    return v;
  };

  const refreshVisual = () => {
    axios.get('http://localhost:8000/api/writing/visual', { params: { t: Date.now() }, timeout: 4000 })
      .then(r => {
        const next = r.data;
        if (visual && next && next.type === visual.type && JSON.stringify(next) === JSON.stringify(visual)) {
          setVisual(generateLocalVisual(visual));
        } else {
          setVisual(next);
        }
      })
      .catch(() => setVisual(generateLocalVisual(visual)));
  };

  const saveScoreToDatabase = async (scoreData: any) => {
    try {
      console.log('💾 Writing puan kaydetme başlatılıyor...', scoreData);
      
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
        console.log('✅ Writing puanı başarıyla kaydedildi:', result);
      } else {
        const errorText = await response.text();
        console.error('❌ Writing puan kaydetme hatası:', errorText);
      }
    } catch (error) {
      console.error('❌ Writing puan kaydetme hatası:', error);
    }
  };

  const handleEvaluate = async () => {
    setError(null);
    setResult(null);
    if (!essay || essay.trim().length < 30) {
      setError('Lütfen en az birkaç cümlelik bir essay yazın.');
      return;
    }
    if (!mode) { setError('Lütfen Academic veya General Training seçin.'); return; }
    if (!task) { setError('Lütfen Task 1 veya Task 2 seçin.'); return; }
    if (mode === 'general' && task === 'task1' && !letterType) { setError('Lütfen mektup türünü seçin (formal/informal).'); return; }
    try {
      setLoading(true);
      const res = await axios.post('http://localhost:8000/api/writing/evaluate', { essay, topic, mode, task, letterType });
      const normalizedResult = normalizeResult(res.data);
      setResult(normalizedResult);

      // Puanı veritabanına kaydet
      await saveScoreToDatabase({
        module: 'writing',
        band_score: normalizedResult.overall_band || 0,
        raw_score: 0, // Writing'de raw score yok
        total_questions: 1, // 1 essay
        topic: topic || 'Custom Topic',
        difficulty: mode === 'academic' ? 'advanced' : 'intermediate',
        accent: null, // Writing'de accent yok
        detailed_results: {
          criteria: normalizedResult.criteria || {},
          strengths: normalizedResult.strengths || [],
          weaknesses: normalizedResult.weaknesses || [],
          suggestions: normalizedResult.suggestions || [],
          essay_length: essay.length
        }
      });
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Değerlendirme sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestTopic = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/writing/topic', { params: { mode, task, letterType } });
      setTopic(res.data.topic || topic);
    } catch (e) {
      setError('Konu AI tarafından alınamadı. Lütfen backend\'in açık olduğundan ve API anahtarının doğru olduğundan emin olun.');
    }
  };

  useEffect(() => {
    // Sayfa yüklenince otomatik konu getir
    if (mode && task) {
      if (mode === 'academic' && task === 'task1') {
        setTopic(''); // konu gereksiz
        refreshVisual();
      } else {
        setVisual(null);
        handleSuggestTopic();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, task, letterType]);

  function normalizeResult(data: any) {
    const criteria = data?.criteria || {};
    const toBandObj = (value: any) => {
      if (value == null) return { band: undefined, comment: undefined };
      if (typeof value === 'number') return { band: value, comment: undefined };
      if (typeof value === 'object' && 'band' in value) return { band: value.band, comment: value.comment };
      return { band: undefined, comment: String(value) };
    };

    const taskAchievement = toBandObj(criteria['Task Achievement'] ?? criteria['task_achievement']);
    const coherenceCohesion = toBandObj(criteria['Coherence & Cohesion'] ?? criteria['coherence_cohesion']);
    const lexicalResource = toBandObj(criteria['Lexical Resource'] ?? criteria['lexical_resource']);
    const grammaticalRangeAccuracy = toBandObj(criteria['Grammatical Range & Accuracy'] ?? criteria['grammatical_range_accuracy']);

    return {
      overall_band: data?.overall_band,
      strengths: data?.strengths || [],
      weaknesses: data?.weaknesses || [],
      suggestions: data?.suggestions || [],
      criteria: {
        taskAchievement,
        coherenceCohesion,
        lexicalResource,
        grammaticalRangeAccuracy,
      }
    };
  }

  return (
    <div className="writing-module">
      {/* Header */}
      <header className="homepage-header">
        <div className="header-content">
          <Link to="/" className="logo-section">
            <img 
              src={kitapLogo} 
              alt="IELTSGO Kitap" 
              className="kitap-logo"
            />
            <img 
              src={headerLogo} 
              alt="IELTSGO Yazı" 
              className="header-logo"
            />
          </Link>

          {/* Navigation Menu */}
          <nav className="navbar">
            <Link to="/reading" className="nav-item">
              <BookOpen size={20} />
              <span>Reading</span>
            </Link>
            <Link to="/writing" className="nav-item active">
              <PenTool size={20} />
              <span>Writing</span>
            </Link>
            <Link to="/listening" className="nav-item">
              <Headphones size={20} />
              <span>Listening</span>
            </Link>
            <Link to="/speaking" className="nav-item">
              <Mic size={20} />
              <span>Speaking</span>
            </Link>
            <Link to="/general-test" className="nav-item featured">
              <Trophy size={20} />
              <span>Genel Test</span>
            </Link>
            <Link to="/dashboard" className="nav-item">
              <BarChart3 size={20} />
              <span>Dashboard</span>
            </Link>
          </nav>
        </div>
      </header>

      <div className="module-content">
        <div className="card" style={{ width: '100%', maxWidth: 'none' }}>
          <div className="mb-4">
            <h1 className="module-header" style={{ justifyContent: 'center' }}>
              <PenTool />
              <span>Writing Modülü</span>
            </h1>
          </div>

        {!mode || !task ? (
          <div className="card">
            <h3>🧭 Modül Seçimi</h3>
            {/* Mode cards */}
            <div className="mt-3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <div
                onClick={() => { setMode('academic'); setTask(''); setLetterType(''); setResult(null); }}
                style={{
                  cursor: 'pointer', padding: '12px 18px', borderRadius: 12, minWidth: 180, textAlign: 'center',
                  background: mode === 'academic' ? 'linear-gradient(135deg, #1e3a8a 0%, #374151 100%)' : 'var(--card-bg)',
                  color: mode === 'academic' ? '#fff' : 'inherit',
                  border: '2px solid', borderColor: mode === 'academic' ? '#1e3a8a' : '#e9ecef',
                  boxShadow: 'var(--card-shadow)'
                }}
              >
                Academic
              </div>
              <div
                onClick={() => { setMode('general'); setTask(''); setLetterType(''); setResult(null); }}
                style={{
                  cursor: 'pointer', padding: '12px 18px', borderRadius: 12, minWidth: 180, textAlign: 'center',
                  background: mode === 'general' ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : 'var(--card-bg)',
                  color: mode === 'general' ? '#fff' : 'inherit',
                  border: '2px solid', borderColor: mode === 'general' ? '#dc2626' : '#e9ecef',
                  boxShadow: 'var(--card-shadow)'
                }}
              >
                General Training
              </div>
            </div>
            {/* Task cards */}
            {mode && (
              <div className="mt-3">
                <label style={{ display: 'block', textAlign: 'center', marginBottom: 8 }}>Görev</label>
                <div className="mt-2" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <div
                    onClick={() => { setTask('task1'); setResult(null); }}
                    style={{
                      cursor: 'pointer', padding: '10px 16px', borderRadius: 10, minWidth: 140, textAlign: 'center',
                      background: task === 'task1' ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : 'var(--card-bg)',
                      color: task === 'task1' ? '#fff' : 'inherit',
                      border: '2px solid', borderColor: task === 'task1' ? '#dc2626' : '#e9ecef'
                    }}
                  >
                    Task 1
                  </div>
                  <div
                    onClick={() => { setTask('task2'); setResult(null); }}
                    style={{
                      cursor: 'pointer', padding: '10px 16px', borderRadius: 10, minWidth: 140, textAlign: 'center',
                      background: task === 'task2' ? 'linear-gradient(135deg, #1e3a8a 0%, #374151 100%)' : 'var(--card-bg)',
                      color: task === 'task2' ? '#fff' : 'inherit',
                      border: '2px solid', borderColor: task === 'task2' ? '#1e3a8a' : '#e9ecef'
                    }}
                  >
                    Task 2
                  </div>
                </div>
                {mode === 'general' && task === 'task1' && (
                  <div className="mt-3">
                    <label>2️⃣ Task 1 – Letter Writing</label>
                    <p>
                      Bu bölümde AI size kısa bir mektup senaryosu (ör. şikâyet, davet, bilgi isteme) oluşturur. 
                      100–150 kelimeyle; uygun hitap, ton ve kapanışla mektubu yazın. 
                      Formal → resmi (manager, ofis); Informal → arkadaş/aile.
                    </p>
                    <div className="mt-2">
                      <button className="btn" onClick={() => setLetterType('informal')}>Informal</button>
                      <span style={{ marginRight: 8 }} />
                      <button className="btn btn-secondary" onClick={() => setLetterType('formal')}>Formal</button>
                    </div>
                  </div>
                )}
                {mode === 'general' && task === 'task2' && (
                  <div className="mt-3">
                    <label>3️⃣ Task 2 – Essay Writing</label>
                    <p>
                      Bu bölümde AI, günlük yaşam veya toplumsal bir başlık üretir. 
                      150–200 kelimeyle giriş-gelişme-sonuç, net argüman ve örneklerle yazın.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
        <div className="card">
          <h3>📝 Yazım Alanı</h3>
          {/* Üst kontrol butonları */}
          <br/>

          <div className="mt-2" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className="btn"
              onClick={() => {
                setTask('');
                setEssay('');
                setTopic('');
                setResult(null);
                setError(null);
                setVisual(null);
              }}
            >
              Görev Seçimine Dön
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setMode('');
                setTask('');
                setLetterType('');
                setEssay('');
                setTopic('');
                setResult(null);
                setError(null);
                setVisual(null);
              }}
            >
              Modül Seçimine Dön
            </button>
          </div>
          <p>
            {mode === 'general' && task === 'task1' && 'AI tarafından verilen senaryoya göre mektubunuzu yazın (100–150 kelime).'}
            {mode === 'general' && task === 'task2' && 'AI tarafından verilen başlığa göre essay yazın (150–200 kelime).'}
            {mode === 'academic' && task === 'task1' && 'Aşağıdaki tablo/diagram açıklamasına göre ~150 kelimelik kısa bir rapor yazın (nesnel, karşılaştırmalı).'}
            {mode === 'academic' && task === 'task2' && 'Akademik bir essay (≈250 kelime) yazın: argüman + örnek + sonuç.'}
          </p>
          {mode === 'academic' && task === 'task1' && (
            <div className="card" style={{ background: '#ffffff', border: '1px solid #E2E8F0' }}>
              {!visual && <p>Görsel yükleniyor...</p>}
              {visual?.type === 'table' && (
                <>
                  <p style={{ marginTop: 0, fontWeight: 600, fontSize: '1rem' }}>Sample Table</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {visual.columns.map((c: string) => (
                          <th key={c} style={{ border: '1px solid #E2E8F0', padding: '8px', textAlign: c === 'Year' ? 'left' : 'right', fontSize: '0.95rem' }}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visual.rows.map((row: any[], i: number) => (
                        <tr key={i}>
                          {row.map((v: any, j: number) => (
                            <td key={j} style={{ border: '1px solid #E2E8F0', padding: '8px', textAlign: j === 0 ? 'left' : 'right', fontSize: '0.95rem', color: '#2D3748' }}>{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {visual?.type === 'bar' && (
                <>
                  <p style={{ marginTop: 0, fontWeight: 600, fontSize: '1rem' }}>Sample Bar Chart</p>
                  <ul style={{ listStyle: 'none', paddingLeft: 0, fontFamily: 'inherit', fontSize: '0.95rem', color: '#2D3748' }}>
                    {visual.labels.map((label: string, i: number) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ width: 80 }}>{label}</span>
                        <div style={{ background: '#1e3a8a', height: 12, width: `${visual.values[i] * 5}px`, borderRadius: 4 }} />
                        <span style={{ marginLeft: 8 }}>{visual.values[i]}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {visual?.type === 'pie' && (
                <>
                  <p style={{ marginTop: 0, fontWeight: 600, fontSize: '1rem' }}>Sample Pie Breakdown</p>
                  <ul style={{ paddingLeft: 18, fontFamily: 'inherit', fontSize: '0.95rem', color: '#374151' }}>
                    {visual.labels.map((label: string, i: number) => (
                      <li key={i}>{label}: {visual.values[i]}%</li>
                    ))}
                  </ul>
                </>
              )}
              <p style={{ fontSize: '0.95rem', color: '#4A5568', marginTop: 10 }}>Hint: Trendleri karşılaştırın (artış/azalış), en yüksek/en düşük değerler, aradaki farklar.</p>
            </div>
          )}
          {mode === 'academic' && task === 'task1' && (
            <div className="mt-2" style={{ textAlign: 'center' }}>
              <button className="btn" onClick={refreshVisual}>Yeni Görsel</button>
            </div>
          )}
          {mode === 'general' && task === 'task1' && (
            <div className="mt-2">
              <label>Mektup Türü</label>
              <div className="mt-2" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <select
                  className="form-control"
                  value={letterType}
                  onChange={(e) => setLetterType(e.target.value as 'formal' | 'informal' | '')}
                  style={{ maxWidth: '260px' }}
                >
                  <option value="">Seçin...</option>
                  <option value="informal">Informal (arkadaş/aile)</option>
                  <option value="formal">Formal (manager/kurum)</option>
                </select>
               
                 
                </div>
              </div>
            
          )}
 
          
          {!(mode === 'academic' && task === 'task1') && (
            <>
              <label className="mt-3">Konu (AI tarafından atandı)</label>
              <textarea
                className="form-control"
                style={{ minHeight: '90px', fontFamily: 'inherit', fontSize: '1rem' }}
                value={topic}
                readOnly
              />
              <div className="mt-3">
                <button className="btn" onClick={handleSuggestTopic}>Yeni Konu</button>
              </div>
            </>
          )}
          <label className="mt-3">Essay</label>
          <textarea
            className="form-control"
            style={{ minHeight: '200px', fontFamily: 'inherit', fontSize: '1rem' }}
            placeholder="En az birkaç cümle yazın..."
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
          />
          <div className="mt-3">
            <button className="btn btn-success" onClick={handleEvaluate} disabled={loading}>
              {loading ? 'Değerlendiriliyor...' : 'Değerlendir'}
            </button>
          </div>
          {error && (
            <p style={{ color: '#b00020', marginTop: '10px' }}>{error}</p>
          )}
        </div>
        )}

        {result && (
          <div className="grid">
            <div className="card">
              <h3>📊 Genel Puan</h3>
              <p style={{ fontSize: '2rem', fontWeight: 700 }}>{result.overall_band ?? '-'}</p>
            </div>
            <div className="card">
              <h3>🧩 Kriterler</h3>
              <ul>
                <li>Task Achievement: <b>{result?.criteria?.taskAchievement?.band ?? '-'}</b> — {result?.criteria?.taskAchievement?.comment}</li>
                <li>Coherence & Cohesion: <b>{result?.criteria?.coherenceCohesion?.band ?? '-'}</b> — {result?.criteria?.coherenceCohesion?.comment}</li>
                <li>Lexical Resource: <b>{result?.criteria?.lexicalResource?.band ?? '-'}</b> — {result?.criteria?.lexicalResource?.comment}</li>
                <li>Grammatical Range & Accuracy: <b>{result?.criteria?.grammaticalRangeAccuracy?.band ?? '-'}</b> — {result?.criteria?.grammaticalRangeAccuracy?.comment}</li>
              </ul>
            </div>
            <div className="card">
              <h3>✅ Güçlü Yönler</h3>
              <ul>
                {(result.strengths || []).map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3>⚠️ Zayıf Yönler</h3>
              <ul>
                {(result.weaknesses || []).map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3>💡 Öneriler</h3>
              <ul>
                {(result.suggestions || []).map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default WritingModule;
