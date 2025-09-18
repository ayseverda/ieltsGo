import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, PenTool, Headphones, Mic, Trophy, BarChart3 } from 'lucide-react';
import { auth } from '../services/auth';

// Logo imports
import headerLogo from '../assets/ieltsgoyazi.png';
import kitapLogo from '../assets/ieltsgokitap.png';

interface ReadingModuleProps {
  onScore?: (score: number) => void;
}

const ReadingModule: React.FC<ReadingModuleProps> = ({ onScore }) => {
  const [test, setTest] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = () => {
      const user = auth.getCurrentUser();
      if (user) {
        setIsAuthenticated(true);
        setUser(user);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = () => {
    auth.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  const generateTest = async () => {
    setLoading(true);
    setError('');
    setTest(null);
    setAnswers({});
    setResult(null);

    try {
      console.log('🔄 Reading pratik testi üretiliyor...');
      
      const response = await fetch('http://localhost:8001/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: 'Academic', 
          difficulty: 'Medium'
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Reading pratik testi başarıyla üretildi:', data.id);
        setTest(data);
      } else {
        const err = await response.text();
        console.error('❌ Reading test üretimi başarısız:', err);
        setError(err || 'Test üretimi başarısız.');
      }
    } catch (err) {
      console.error('❌ Reading test üretimi hatası:', err);
      setError('Test üretimi sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswers = async () => {
    if (!test) return;
    
    try {
      setLoading(true);
      console.log('🔍 Değerlendirme başlıyor...');
      console.log('📋 Test ID:', test.id);
      console.log('📝 Cevaplar:', answers);
      console.log('🎯 Current result state:', result);
      
      // User ID'yi al
      const user = auth.getCurrentUser();
      const userId = user?.id || null;
      
      console.log('🔐 Current User:', user);
      console.log('🆔 User ID:', userId);
      
      // Authorization header'ı hazırla
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('🔐 Authorization header eklendi');
      } else {
        console.log('⚠️ Token bulunamadı - Authorization header eklenmedi');
      }

      const res = await fetch('http://localhost:8001/submit', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
          test_id: test.id, 
          answers: answers,
          test_data: test,
          user_id: userId
        })
      });
      
      console.log('📊 Response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('✅ Değerlendirme başarılı:', data);
        
        // Response format'ını düzelt - backend'den direkt gelen format'ı kullan
        const formattedResult = {
          band_estimate: data.band_estimate || 0,
          scaled: {
            correct: data.scaled?.correct || 0,
            total: data.scaled?.total || 13
          },
          feedback: data.feedback || null,
          raw: data.raw || null
        };
        
        console.log('🎯 Formatted result:', formattedResult);
        setResult(formattedResult);
        console.log('🎯 Result state set edildi:', formattedResult);
        
        // Band score'u parent component'e gönder
        if (onScore && formattedResult.band_estimate) {
          onScore(formattedResult.band_estimate);
        }
      } else {
        const errorText = await res.text();
        console.error('❌ Değerlendirme hatası:', errorText);
        setError(errorText || 'Değerlendirme sırasında hata oluştu.');
      }
    } catch (err) {
      console.error('❌ Değerlendirme hatası:', err);
      setError('Değerlendirme sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const resetTest = () => {
    setTest(null);
    setAnswers({});
    setResult(null);
    setError('');
  };

  return (
    <div className="reading-module">
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
            <Link to="/reading" className="nav-item active">
              <BookOpen size={20} />
              <span>Reading</span>
            </Link>
            <Link to="/writing" className="nav-item">
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
            <h1 className="module-header">
              <BookOpen />
              IELTS Reading Practice Test
            </h1>
            <p className="module-description">
              1 Passage, 13 Questions - Academic Style
            </p>
          </div>
          {/* Navigation Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <Link to="/" className="module-btn" style={{ textDecoration: 'none' }}>
              ← Ana Sayfaya Dön
            </Link>
          
            <button
              onClick={generateTest}
              disabled={loading}
              className="module-btn featured-btn"
              style={{ textDecoration: 'none' }}
            >
              {loading ? '⏳ Test Üretiliyor...' : '🔄 Yeni Test Başlat'}
            </button>
        </div>

      {error && (
        <div style={{
          background: '#f8d7da',
          color: '#721c24',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>❌ Hata:</strong> {error}
        </div>
      )}

      {!test && !loading && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: '50px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '40px',
          borderRadius: '15px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          <button
            onClick={generateTest}
            disabled={loading}
            className="module-btn featured-btn"
            style={{ textDecoration: 'none' }}
          >
            {loading ? '⏳ Test Üretiliyor...' : '🚀 Pratik Testi Başlat'}
          </button>
        </div>
      )}

      {loading && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: '50px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '40px',
          borderRadius: '15px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontSize: '18px', color: '#1e3a8a' }}>
            🔄 {test ? 'Değerlendiriliyor...' : 'Test üretiliyor...'}
          </div>
        </div>
      )}

      {test && (
        <div className="test-content">
          {/* Metin */}
          <div className="passage-section" style={{
            background: 'white',
            padding: '25px',
            borderRadius: '12px',
            marginBottom: '30px',
            border: '2px solid #e0e0e0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ color: '#1e3a8a', fontSize: '22px', marginBottom: '15px' }}>
              📄 {test.passages[0]?.title}
            </h3>
            <div style={{
              fontSize: '15px',
              lineHeight: '1.8',
              color: '#333',
              whiteSpace: 'pre-wrap'
            }}>
              {test.passages[0]?.text}
            </div>
            <div style={{
              marginTop: '15px',
              fontSize: '14px',
              color: '#666',
              textAlign: 'right'
            }}>
              Kelime sayısı: {test.passages[0]?.word_count || 'N/A'}
            </div>
          </div>

          {/* Sorular */}
          <div className="questions-section">
            <h4 style={{ color: '#1e3a8a', fontSize: '20px', marginBottom: '20px' }}>
              📝 Sorular (13 soru)
            </h4>
            
            {test.questions?.map((question: any, index: number) => (
              <div key={question.id} style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #e0e0e0',
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
              }}>
                <div style={{ marginBottom: '15px' }}>
                  <span style={{
                    background: '#1e3a8a',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '15px',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    Soru {index + 1}
                  </span>
                  <span style={{
                    color: '#666',
                    fontSize: '12px',
                    background: '#f0f0f0',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    marginLeft: '10px'
                  }}>
                    {question.type}
                  </span>
                </div>

                <div style={{
                  fontSize: '15px',
                  fontWeight: '500',
                  marginBottom: '15px',
                  lineHeight: '1.5'
                }}>
                  {question.prompt}
                </div>

                {question.type === 'Multiple Choice' && question.options && (
                  <div className="options">
                    {question.options.map((option: string, optionIndex: number) => (
                      <label key={optionIndex} style={{
                        display: 'block',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '5px',
                        background: answers[question.id] === optionIndex.toString() ? '#f0f4ff' : 'transparent',
                        border: answers[question.id] === optionIndex.toString() ? '2px solid #1e3a8a' : '1px solid #e0e0e0'
                      }}>
                        <input
                          type="radio"
                          name={question.id}
                          value={optionIndex}
                          checked={answers[question.id] === optionIndex.toString()}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          style={{ marginRight: '10px' }}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}

                {question.type === 'True/False/Not Given' && (
                  <div className="options">
                    {['True', 'False', 'Not Given'].map((option) => (
                      <label key={option} style={{
                        display: 'block',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '5px',
                        background: answers[question.id] === option ? '#f0f4ff' : 'transparent',
                        border: answers[question.id] === option ? '2px solid #1e3a8a' : '1px solid #e0e0e0'
                      }}>
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={answers[question.id] === option}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          style={{ marginRight: '10px' }}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}

                {(() => {
                  const isTextInput = ['Fill in the blanks', 'Short answer questions', 'Fill in blanks', 'Short Answer Questions', 'Short Answer', 'Fill in the blank', 'Sentence completion'].includes(question.type);
                  const hasOptions = question.options && question.options.length > 0;
                  
                  // Debug için
                  console.log(`Soru ${question.id}: Tip="${question.type}", Seçenekler var mı?=${hasOptions}, Text input olmalı mı?=${isTextInput}`);
                  
                  // Eğer seçenekler yoksa ve text input tipindeyse göster
                  if (isTextInput && !hasOptions) {
                    return (
                      <input
                        type="text"
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '15px',
                          outline: 'none',
                          transition: 'border-color 0.3s',
                          backgroundColor: 'white',
                          color: '#333'
                        }}
                        placeholder="Cevabınızı yazın..."
                        onFocus={(e) => {
                          e.target.style.borderColor = '#1e3a8a';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e0e0e0';
                        }}
                      />
                    );
                  }
                  
                  return null;
                })()}

                {/* Soru Sonucu - Sadece değerlendirme yapıldıktan sonra göster */}
                {result && (() => {
                  const questionResult = result.raw?.details?.[question.id];
                  if (questionResult) {
                    const isCorrect = questionResult.is_correct;
                    const correctAnswer = questionResult.correct_answer;
                    const userAnswer = questionResult.user_answer;
                    
                    return (
                      <div style={{
                        marginTop: '15px',
                        padding: '12px',
                        borderRadius: '8px',
                        background: isCorrect ? '#d4edda' : '#f8d7da',
                        border: `1px solid ${isCorrect ? '#c3e6cb' : '#f5c6cb'}`
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}>
                          <span style={{
                            fontSize: '16px',
                            marginRight: '8px'
                          }}>
                            {isCorrect ? '✅' : '❌'}
                          </span>
                          <strong style={{
                            color: isCorrect ? '#155724' : '#721c24'
                          }}>
                            {isCorrect ? 'Doğru' : 'Yanlış'}
                          </strong>
                        </div>
                        
                        <div style={{ fontSize: '14px', color: '#333' }}>
                          <div style={{ marginBottom: '4px' }}>
                            <strong>Senin cevabın:</strong> {(() => {
                              if (!userAnswer || userAnswer === 'Boş') return 'Boş';
                              if (question.type === 'Multiple Choice') {
                                const optionIndex = parseInt(userAnswer);
                                if (!isNaN(optionIndex) && question.options && question.options[optionIndex]) {
                                  return question.options[optionIndex];
                                }
                              }
                              return userAnswer;
                            })()}
                          </div>
                          {!isCorrect && (
                            <div>
                              <strong>Doğru cevap:</strong> {(() => {
                                if (question.type === 'Multiple Choice') {
                                  const correctIndex = parseInt(correctAnswer);
                                  if (!isNaN(correctIndex) && question.options && question.options[correctIndex]) {
                                    return question.options[correctIndex];
                                  }
                                }
                                return correctAnswer;
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            ))}

            {/* Submit Button - Sadece değerlendirme yapılmamışsa göster */}
            {!result && (
              <div style={{ textAlign: 'center', marginTop: '30px' }}>
                <button
                  onClick={submitAnswers}
                  disabled={loading}
                  className="module-btn"
                  style={{ textDecoration: 'none' }}
                >
                  {loading ? '🔄 Değerlendiriliyor...' : '📊 Testi Tamamla ve Değerlendir'}
                </button>
              </div>
            )}

            {/* Değerlendirme Sonuçları - Test içeriğinin altında */}
            {result && (
              <div className="result-section" style={{
                background: '#f8f9fa',
                padding: '25px',
                borderRadius: '12px',
                border: '2px solid #1e3a8a',
                marginTop: '30px'
              }}>
                {console.log('🎯 Result render ediliyor:', result)}
                <h4 style={{ color: '#1e3a8a', fontSize: '20px', marginBottom: '20px' }}>
                  📊 Test Sonuçları
                </h4>
                
                {/* Yanlış Çözülen Sorular Özeti */}
                {(() => {
                  const wrongQuestions = test?.questions?.filter((q: any) => {
                    const questionResult = result.raw?.details?.[q.id];
                    return questionResult && !questionResult.is_correct;
                  }) || [];
                  
                  if (wrongQuestions.length > 0) {
                    return (
                      <div style={{
                        background: '#fff3cd',
                        border: '1px solid #ffeaa7',
                        borderRadius: '8px',
                        padding: '15px',
                        marginBottom: '20px'
                      }}>
                        <h5 style={{ color: '#856404', marginBottom: '10px' }}>
                          ❌ Yanlış Çözülen Sorular ({wrongQuestions.length})
                        </h5>
                        <div style={{ fontSize: '14px', color: '#856404' }}>
                          {wrongQuestions.map((q: any, index: number) => {
                            const questionResult = result.raw?.details?.[q.id];
                            const questionNumber = test?.questions?.findIndex((question: any) => question.id === q.id) + 1;
                            return (
                              <div key={q.id} style={{ marginBottom: '8px' }}>
                                <strong>Soru {questionNumber}:</strong> {q.prompt.substring(0, 50)}...
                                <br />
                                <span style={{ fontSize: '12px', color: '#666' }}>
                                  Senin cevabın: {(() => {
                                    const userAnswer = questionResult?.user_answer || 'Boş';
                                    if (userAnswer === 'Boş') return 'Boş';
                                    if (q.type === 'Multiple Choice') {
                                      const optionIndex = parseInt(userAnswer);
                                      if (!isNaN(optionIndex) && q.options && q.options[optionIndex]) {
                                        return q.options[optionIndex];
                                      }
                                    }
                                    return userAnswer;
                                  })()} | 
                                  Doğru cevap: {(() => {
                                    const correctAnswer = questionResult?.correct_answer;
                                    if (q.type === 'Multiple Choice') {
                                      const correctIndex = parseInt(correctAnswer);
                                      if (!isNaN(correctIndex) && q.options && q.options[correctIndex]) {
                                        return q.options[correctIndex];
                                      }
                                    }
                                    return correctAnswer;
                                  })()}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '12px', color: '#856404' }}>
                          💡 Yukarıdaki sorulara tekrar bakarak doğru cevapları inceleyebilirsiniz.
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                {/* Ana İstatistikler */}
                {(() => {
                  // Boş soruları say
                  const blankCount = test?.questions?.filter((q: any) => {
                    const userAnswer = answers[q.id];
                    return !userAnswer || userAnswer.trim() === '';
                  }).length || 0;
                  
                  const wrongCount = result?.scaled?.total - result?.scaled?.correct - blankCount;
                  
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                      <div style={{
                        background: 'white',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        textAlign: 'center'
                      }}>
                        <strong style={{ color: '#1e3a8a' }}>Doğru Cevaplar</strong><br/>
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                          {result?.scaled?.correct}
                        </span>
                        <span style={{ fontSize: '16px', color: '#666' }}> / {result?.scaled?.total}</span>
                      </div>
                      <div style={{
                        background: 'white',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        textAlign: 'center'
                      }}>
                        <strong style={{ color: '#1e3a8a' }}>Yanlış Cevaplar</strong><br/>
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                          {wrongCount}
                        </span>
                        <span style={{ fontSize: '16px', color: '#666' }}> / {result?.scaled?.total}</span>
                      </div>
                      <div style={{
                        background: 'white',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        textAlign: 'center'
                      }}>
                        <strong style={{ color: '#1e3a8a' }}>Boş Bırakılanlar</strong><br/>
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
                          {blankCount}
                        </span>
                        <span style={{ fontSize: '16px', color: '#666' }}> / {result?.scaled?.total}</span>
                      </div>
                    </div>
                  );
                })()}
                
                {/* IELTS Band Score */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                  <div style={{
                    background: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    textAlign: 'center'
                  }}>
                    <strong style={{ color: '#1e3a8a' }}>IELTS Band Skoru</strong><br/>
                    <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e3a8a' }}>
                      {result?.band_estimate}
                    </span>
                    <span style={{ fontSize: '14px', color: '#666', display: 'block' }}>Band Score</span>
                  </div>
                </div>

                {/* Feedback */}
                {result?.feedback && (
                  <div style={{
                    background: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    marginTop: '20px'
                  }}>
                    <h5 style={{ color: '#1e3a8a', marginBottom: '10px' }}>💡 Geri Bildirim</h5>
                    {typeof result.feedback === 'string' ? (
                      <p style={{ lineHeight: '1.6', color: '#333' }}>{result.feedback}</p>
                    ) : (
                      <div style={{ lineHeight: '1.6', color: '#333' }}>
                        {result.feedback.strengths && (
                          <div style={{ marginBottom: '15px' }}>
                            <strong style={{ color: '#28a745' }}>✅ Güçlü Yönler:</strong>
                            <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                              {result.feedback.strengths.map((strength: string, index: number) => (
                                <li key={index}>{strength}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.feedback.improvements && (
                          <div style={{ marginBottom: '15px' }}>
                            <strong style={{ color: '#dc3545' }}>🔧 Geliştirilmesi Gerekenler:</strong>
                            <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                              {result.feedback.improvements.map((improvement: string, index: number) => (
                                <li key={index}>{improvement}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.feedback.tips && (
                          <div>
                            <strong style={{ color: '#1e3a8a' }}>💡 İpuçları:</strong>
                            <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                              {result.feedback.tips.map((tip: string, index: number) => (
                                <li key={index}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ 
                  textAlign: 'center', 
                  marginTop: '30px',
                  display: 'flex',
                  gap: '15px',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={resetTest}
                    className="module-btn featured-btn"
                    style={{ textDecoration: 'none' }}
                  >
                    🔄 Yeni Test Başlat
                  </button>
                  
                  <Link to="/" className="module-btn" style={{ textDecoration: 'none' }}>
                    🏠 Ana Sayfaya Dön
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default ReadingModule;