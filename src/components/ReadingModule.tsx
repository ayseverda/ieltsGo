import React, { useState, useEffect } from 'react';
import { auth } from '../services/auth';

interface ReadingModuleProps {
  onScore?: (score: number) => void;
}

const ReadingModule: React.FC<ReadingModuleProps> = ({ onScore }) => {
  const [test, setTest] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

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
      
      // User ID'yi al
      const user = auth.getCurrentUser();
      const userId = user?.id || null;
      
      console.log('🔐 Current User:', user);
      console.log('🆔 User ID:', userId);
      
      const res = await fetch('http://localhost:8001/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        setResult(data);
        
        // Band score'u parent component'e gönder
        if (onScore && data.band_estimate) {
          onScore(data.band_estimate);
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
    <div className="reading-module" style={{ 
      padding: '20px', 
      maxWidth: '1000px', 
      margin: '0 auto',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      backgroundAttachment: 'fixed'
    }}>
      <div className="module-header" style={{ 
        textAlign: 'center', 
        marginBottom: '30px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '30px',
        borderRadius: '15px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button
            onClick={() => window.history.back()}
            style={{
              background: 'rgba(139, 92, 246, 0.1)',
              color: '#8B5CF6',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '20px',
              border: '2px solid rgba(139, 92, 246, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
            }}
          >
            ← Geri
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              color: '#22c55e',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '20px',
              border: '2px solid rgba(34, 197, 94, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
            }}
          >
            🏠 Anasayfa
          </button>
        </div>
        
        <h2 style={{ color: '#8B5CF6', fontSize: '28px', marginBottom: '10px' }}>
          📖 Reading Pratik
        </h2>
        <p style={{ color: '#666', fontSize: '16px' }}>
          IELTS Reading pratik testi - 1 metin, 13 soru
        </p>
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
            style={{
              background: '#8B5CF6',
              color: 'white',
              padding: '15px 30px',
              fontSize: '18px',
              fontWeight: 'bold',
              borderRadius: '25px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.3)';
            }}
          >
            🚀 Pratik Testi Başlat
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
          <div style={{ fontSize: '18px', color: '#8B5CF6' }}>
            🔄 {test ? 'Değerlendiriliyor...' : 'Test üretiliyor...'}
          </div>
        </div>
      )}

      {test && !result && (
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
            <h3 style={{ color: '#8B5CF6', fontSize: '22px', marginBottom: '15px' }}>
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
            <h4 style={{ color: '#8B5CF6', fontSize: '20px', marginBottom: '20px' }}>
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
                    background: '#8B5CF6',
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
                        border: answers[question.id] === optionIndex.toString() ? '2px solid #8B5CF6' : '1px solid #e0e0e0'
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
                        border: answers[question.id] === option ? '2px solid #8B5CF6' : '1px solid #e0e0e0'
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
                          e.target.style.borderColor = '#8B5CF6';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e0e0e0';
                        }}
                      />
                    );
                  }
                  
                  return null;
                })()}
              </div>
            ))}

            {/* Submit Button */}
            <div style={{ textAlign: 'center', marginTop: '30px' }}>
              <button
                onClick={submitAnswers}
                disabled={loading}
                style={{
                  background: '#8B5CF6',
                  color: 'white',
                  padding: '15px 30px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  borderRadius: '25px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? '🔄 Değerlendiriliyor...' : '📊 Testi Tamamla ve Değerlendir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="result-section" style={{
          background: '#f8f9fa',
          padding: '25px',
          borderRadius: '12px',
          border: '2px solid #8B5CF6',
          marginTop: '30px'
        }}>
          <h4 style={{ color: '#8B5CF6', fontSize: '20px', marginBottom: '20px' }}>
            📊 Test Sonuçları
          </h4>
          
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
                  <strong style={{ color: '#8B5CF6' }}>Doğru Cevaplar</strong><br/>
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
                  <strong style={{ color: '#8B5CF6' }}>Yanlış Cevaplar</strong><br/>
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
                  <strong style={{ color: '#8B5CF6' }}>Boş Bırakılanlar</strong><br/>
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
              <strong style={{ color: '#8B5CF6' }}>IELTS Band Skoru</strong><br/>
              <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#8B5CF6' }}>
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
              <h5 style={{ color: '#8B5CF6', marginBottom: '10px' }}>💡 Geri Bildirim</h5>
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
                      <strong style={{ color: '#8B5CF6' }}>💡 İpuçları:</strong>
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
              style={{
                background: '#28a745',
                color: 'white',
                padding: '15px 30px',
                fontSize: '16px',
                fontWeight: 'bold',
                borderRadius: '25px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(40, 167, 69, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(40, 167, 69, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(40, 167, 69, 0.3)';
              }}
            >
              🔄 Yeni Test Başlat
            </button>
            
            <button
              onClick={() => window.history.back()}
              style={{
                background: 'rgba(139, 92, 246, 0.1)',
                color: '#8B5CF6',
                padding: '15px 30px',
                fontSize: '16px',
                fontWeight: 'bold',
                borderRadius: '25px',
                border: '2px solid rgba(139, 92, 246, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
              }}
            >
              ← Geri
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#22c55e',
                padding: '15px 30px',
                fontSize: '16px',
                fontWeight: 'bold',
                borderRadius: '25px',
                border: '2px solid rgba(34, 197, 94, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
              }}
            >
              🏠 Anasayfa
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingModule;