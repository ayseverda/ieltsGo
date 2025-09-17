import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, BookOpen, Mic, Edit3, Volume2 } from 'lucide-react';

interface TestEvaluationProps {
  readingResult?: any;
  writingResults?: any;
  speakingEvaluation?: any;
  listeningResult?: any;
  onBack: () => void;
}

const TestEvaluation: React.FC<TestEvaluationProps> = ({
  readingResult,
  writingResults,
  speakingEvaluation,
  listeningResult,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reading' | 'writing' | 'speaking' | 'listening'>('overview');
  const [overallScore, setOverallScore] = useState<number>(0);

  useEffect(() => {
    // Genel puanı hesapla
    const scores = [];
    if (readingResult?.band_estimate) scores.push(readingResult.band_estimate);
    if (speakingEvaluation?.overall_band) scores.push(speakingEvaluation.overall_band);
    if (listeningResult?.band_estimate) scores.push(listeningResult.band_estimate);
    
    // Writing sonuçları varsa ekle
    if (writingResults?.task1?.overall_band) scores.push(writingResults.task1.overall_band);
    if (writingResults?.task2?.overall_band) scores.push(writingResults.task2.overall_band);
    
    const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    setOverallScore(average);
  }, [readingResult, speakingEvaluation, listeningResult, writingResults]);

  const getScoreColor = (score: number) => {
    if (score >= 8) return '#4CAF50';
    if (score >= 7) return '#8BC34A';
    if (score >= 6) return '#FFC107';
    if (score >= 5) return '#FF9800';
    return '#F44336';
  };

  const getScoreLevel = (score: number) => {
    if (score >= 8) return 'Mükemmel';
    if (score >= 7) return 'İyi';
    if (score >= 6) return 'Orta';
    if (score >= 5) return 'Gelişim Gerekli';
    return 'Çok Gelişim Gerekli';
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <button 
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#8B5CF6',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px'
          }}
        >
          <ArrowLeft size={20} />
          Geri Dön
        </button>
        
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ 
            color: '#8B5CF6', 
            fontSize: '32px', 
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '15px'
          }}>
            <Trophy size={40} />
            IELTS Deneme Sınavı Sonuçları
          </h1>
          <p style={{ color: '#666', fontSize: '18px' }}>
            Genel deneme sınavınızın detaylı değerlendirmesi
          </p>
        </div>
      </div>

      {/* Genel Puan Kartı */}
      <div style={{
        background: `linear-gradient(135deg, ${getScoreColor(overallScore)} 0%, ${getScoreColor(overallScore)}CC 100%)`,
        color: 'white',
        padding: '30px',
        borderRadius: '20px',
        textAlign: 'center',
        marginBottom: '30px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
      }}>
        <h2 style={{ fontSize: '64px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
          {overallScore.toFixed(1)}
        </h2>
        <p style={{ fontSize: '24px', margin: '0 0 5px 0', opacity: 0.9 }}>
          Genel IELTS Band Score
        </p>
        <p style={{ fontSize: '18px', margin: 0, opacity: 0.8 }}>
          {getScoreLevel(overallScore)}
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '30px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {[
          { id: 'overview', label: 'Genel Bakış', icon: Trophy },
          { id: 'reading', label: 'Reading', icon: BookOpen, available: !!readingResult },
          { id: 'writing', label: 'Writing', icon: Edit3, available: !!writingResults },
          { id: 'speaking', label: 'Speaking', icon: Mic, available: !!speakingEvaluation },
          { id: 'listening', label: 'Listening', icon: Volume2, available: !!listeningResult }
        ].map(({ id, label, icon: Icon, available }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            disabled={!available}
            style={{
              background: activeTab === id ? '#8B5CF6' : 'white',
              color: activeTab === id ? 'white' : available ? '#8B5CF6' : '#ccc',
              border: `2px solid ${activeTab === id ? '#8B5CF6' : available ? '#8B5CF6' : '#ccc'}`,
              padding: '12px 20px',
              borderRadius: '25px',
              cursor: available ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: available ? 1 : 0.5,
              transition: 'all 0.3s ease'
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{
        background: 'white',
        borderRadius: '15px',
        padding: '30px',
        boxShadow: '0 5px 20px rgba(0,0,0,0.1)',
        minHeight: '500px'
      }}>
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ color: '#8B5CF6', fontSize: '24px', marginBottom: '25px', textAlign: 'center' }}>
              📊 Modül Bazında Sonuçlar
            </h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px',
              marginBottom: '30px'
            }}>
              {/* Reading */}
              {readingResult && (
                <div style={{
                  background: '#f8f9fa',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px solid #8B5CF6',
                  textAlign: 'center'
                }}>
                  <BookOpen size={40} color="#8B5CF6" style={{ marginBottom: '15px' }} />
                  <h4 style={{ color: '#8B5CF6', margin: '0 0 10px 0' }}>Reading</h4>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#8B5CF6', marginBottom: '10px' }}>
                    {readingResult.band_estimate}
                  </div>
                  <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                    {readingResult.scaled?.correct || 0} / {readingResult.scaled?.total || 0} doğru
                  </p>
                </div>
              )}

              {/* Writing */}
              {writingResults && (
                <div style={{
                  background: '#f8f9fa',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px solid #8B5CF6',
                  textAlign: 'center'
                }}>
                  <Edit3 size={40} color="#8B5CF6" style={{ marginBottom: '15px' }} />
                  <h4 style={{ color: '#8B5CF6', margin: '0 0 10px 0' }}>Writing</h4>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#8B5CF6', marginBottom: '10px' }}>
                    {writingResults.task1?.overall_band || writingResults.task2?.overall_band || 'N/A'}
                  </div>
                  <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                    Task 1 & 2 tamamlandı
                  </p>
                </div>
              )}

              {/* Speaking */}
              {speakingEvaluation && (
                <div style={{
                  background: '#f8f9fa',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px solid #8B5CF6',
                  textAlign: 'center'
                }}>
                  <Mic size={40} color="#8B5CF6" style={{ marginBottom: '15px' }} />
                  <h4 style={{ color: '#8B5CF6', margin: '0 0 10px 0' }}>Speaking</h4>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#8B5CF6', marginBottom: '10px' }}>
                    {speakingEvaluation.overall_band}
                  </div>
                  <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                    {speakingEvaluation.total_answers || 0} soru cevaplandı
                  </p>
                </div>
              )}

              {/* Listening */}
              {listeningResult ? (
                <div style={{
                  background: '#f8f9fa',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px solid #8B5CF6',
                  textAlign: 'center'
                }}>
                  <Volume2 size={40} color="#8B5CF6" style={{ marginBottom: '15px' }} />
                  <h4 style={{ color: '#8B5CF6', margin: '0 0 10px 0' }}>Listening</h4>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#8B5CF6', marginBottom: '10px' }}>
                    {listeningResult.band_estimate}
                  </div>
                  <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                    {listeningResult.scaled?.correct || 0} / {listeningResult.scaled?.total || 0} doğru
                  </p>
                </div>
              ) : (
                <div style={{
                  background: '#f5f5f5',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px dashed #ccc',
                  textAlign: 'center'
                }}>
                  <Volume2 size={40} color="#ccc" style={{ marginBottom: '15px' }} />
                  <h4 style={{ color: '#ccc', margin: '0 0 10px 0' }}>Listening</h4>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ccc', marginBottom: '10px' }}>
                    -
                  </div>
                  <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>
                    Henüz tamamlanmadı
                  </p>
                </div>
              )}
            </div>

            {/* Genel Değerlendirme */}
            <div style={{
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
              padding: '25px',
              borderRadius: '12px',
              border: '1px solid #dee2e6'
            }}>
              <h4 style={{ color: '#8B5CF6', margin: '0 0 15px 0' }}>💡 Genel Değerlendirme</h4>
              <p style={{ color: '#495057', fontSize: '16px', lineHeight: '1.6', margin: 0 }}>
                {overallScore >= 7 ? 
                  "Tebrikler! IELTS deneme sınavında başarılı bir performans sergilediniz. Bu seviyede devam etmeniz önerilir." :
                  overallScore >= 6 ?
                  "İyi bir performans gösterdiniz. Bazı alanlarda daha fazla pratik yaparak skorunuzu artırabilirsiniz." :
                  "IELTS sınavına hazırlık için daha fazla çalışma yapmanız önerilir. Her modülde düzenli pratik yaparak gelişim sağlayabilirsiniz."
                }
              </p>
            </div>
          </div>
        )}

        {activeTab === 'reading' && readingResult && (
          <div>
            <h3 style={{ color: '#8B5CF6', fontSize: '24px', marginBottom: '25px' }}>
              📖 Reading Modülü Detayları
            </h3>
            
            {/* Reading Skoru */}
            <div style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
              color: 'white',
              padding: '25px',
              borderRadius: '15px',
              textAlign: 'center',
              marginBottom: '25px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>IELTS Reading Band Score</h4>
              <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '10px' }}>
                {readingResult.band_estimate}
              </div>
              <p style={{ margin: 0, opacity: 0.9 }}>
                {readingResult.scaled?.correct || 0} / {readingResult.scaled?.total || 0} doğru cevap
              </p>
            </div>

            {/* Detaylı İstatistikler */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: '25px'
            }}>
              <div style={{
                background: '#e8f5e8',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid #4CAF50'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50', marginBottom: '5px' }}>
                  {readingResult.scaled?.correct || 0}
                </div>
                <div style={{ color: '#2E7D32', fontSize: '14px' }}>Doğru</div>
              </div>
              
              <div style={{
                background: '#ffebee',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid #F44336'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F44336', marginBottom: '5px' }}>
                  {(readingResult.scaled?.total || 0) - (readingResult.scaled?.correct || 0) - ((readingResult.scaled?.blank || 0) || 0)}
                </div>
                <div style={{ color: '#C62828', fontSize: '14px' }}>Yanlış</div>
              </div>
              
              <div style={{
                background: '#fff3e0',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid #FF9800'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF9800', marginBottom: '5px' }}>
                  {(readingResult.scaled?.blank || 0) || 0}
                </div>
                <div style={{ color: '#E65100', fontSize: '14px' }}>Boş</div>
              </div>
            </div>

            {/* Geri Bildirim */}
            {readingResult.feedback && (
              <div style={{
                background: '#f8f9fa',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #dee2e6'
              }}>
                <h5 style={{ color: '#8B5CF6', margin: '0 0 15px 0' }}>💡 Geri Bildirim</h5>
                
                {readingResult.feedback.strengths && readingResult.feedback.strengths.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h6 style={{ color: '#4CAF50', margin: '0 0 10px 0' }}>✅ Güçlü Yönler:</h6>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#495057' }}>
                      {readingResult.feedback.strengths.map((strength: string, i: number) => (
                        <li key={i} style={{ marginBottom: '5px' }}>{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {readingResult.feedback.improvements && readingResult.feedback.improvements.length > 0 && (
                  <div>
                    <h6 style={{ color: '#F44336', margin: '0 0 10px 0' }}>📈 Gelişim Alanları:</h6>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#495057' }}>
                      {readingResult.feedback.improvements.map((improvement: string, i: number) => (
                        <li key={i} style={{ marginBottom: '5px' }}>{improvement}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'speaking' && speakingEvaluation && (
          <div>
            <h3 style={{ color: '#8B5CF6', fontSize: '24px', marginBottom: '25px' }}>
              🗣️ Speaking Modülü Detayları
            </h3>
            
            {/* Speaking Skoru */}
            <div style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
              color: 'white',
              padding: '25px',
              borderRadius: '15px',
              textAlign: 'center',
              marginBottom: '25px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>IELTS Speaking Band Score</h4>
              <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '10px' }}>
                {speakingEvaluation.overall_band}
              </div>
              <p style={{ margin: 0, opacity: 0.9 }}>
                {speakingEvaluation.total_answers || 0} soru cevaplandı
              </p>
            </div>

            {/* Kriterler */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px',
              marginBottom: '25px'
            }}>
              {[
                { key: 'fluency_coherence', label: 'Fluency & Coherence', color: '#4CAF50', icon: '🗣️' },
                { key: 'lexical_resource', label: 'Lexical Resource', color: '#2196F3', icon: '📚' },
                { key: 'grammar', label: 'Grammar', color: '#FF9800', icon: '📝' },
                { key: 'pronunciation', label: 'Pronunciation', color: '#9C27B0', icon: '🎤' }
              ].map(({ key, label, color, icon }) => (
                <div key={key} style={{
                  background: 'white',
                  border: `2px solid ${color}`,
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '10px' }}>{icon}</div>
                  <h5 style={{ color, margin: '0 0 10px 0' }}>{label}</h5>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color, marginBottom: '15px' }}>
                    {speakingEvaluation[key]?.band || 'N/A'}
                  </div>
                  <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.4', margin: 0 }}>
                    {speakingEvaluation[key]?.feedback || 'Değerlendirme mevcut değil'}
                  </p>
                </div>
              ))}
            </div>

            {/* Genel Feedback */}
            {speakingEvaluation.general_feedback && (
              <div style={{
                background: '#f8f9fa',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #dee2e6'
              }}>
                <h5 style={{ color: '#8B5CF6', margin: '0 0 15px 0' }}>💡 Genel Değerlendirme</h5>
                <p style={{ color: '#495057', fontSize: '16px', lineHeight: '1.6', margin: 0 }}>
                  {speakingEvaluation.general_feedback}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'writing' && writingResults && (
          <div>
            <h3 style={{ color: '#8B5CF6', fontSize: '24px', marginBottom: '25px' }}>
              ✍️ Writing Modülü Detayları
            </h3>
            
            {/* Writing Skoru */}
            <div style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
              color: 'white',
              padding: '25px',
              borderRadius: '15px',
              textAlign: 'center',
              marginBottom: '25px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>IELTS Writing Band Score</h4>
              <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '10px' }}>
                {((writingResults.task1?.overall_band || 0) + (writingResults.task2?.overall_band || 0)) / 2}
              </div>
              <p style={{ margin: 0, opacity: 0.9 }}>
                Task 1 & 2 Ortalama Skoru
              </p>
            </div>

            {/* Task Detayları */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {/* Task 1 */}
              {writingResults.task1 && (
                <div style={{
                  background: '#f8f9fa',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px solid #8B5CF6'
                }}>
                  <h5 style={{ color: '#8B5CF6', margin: '0 0 15px 0' }}>📊 Task 1</h5>
                  <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#8B5CF6' }}>
                      {writingResults.task1.overall_band}
                    </div>
                    <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Band Score</p>
                  </div>
                  
                  {writingResults.task1.criteria && (
                    <div>
                      <h6 style={{ color: '#495057', margin: '0 0 10px 0' }}>Kriterler:</h6>
                      {Object.entries(writingResults.task1.criteria).map(([criterion, score]) => (
                        <div key={criterion} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '5px 0',
                          borderBottom: '1px solid #dee2e6'
                        }}>
                          <span style={{ color: '#495057', fontSize: '14px' }}>{criterion}:</span>
                          <span style={{ color: '#8B5CF6', fontWeight: 'bold' }}>{score as number}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Task 2 */}
              {writingResults.task2 && (
                <div style={{
                  background: '#f8f9fa',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px solid #8B5CF6'
                }}>
                  <h5 style={{ color: '#8B5CF6', margin: '0 0 15px 0' }}>📝 Task 2</h5>
                  <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#8B5CF6' }}>
                      {writingResults.task2.overall_band}
                    </div>
                    <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Band Score</p>
                  </div>
                  
                  {writingResults.task2.criteria && (
                    <div>
                      <h6 style={{ color: '#495057', margin: '0 0 10px 0' }}>Kriterler:</h6>
                      {Object.entries(writingResults.task2.criteria).map(([criterion, score]) => (
                        <div key={criterion} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '5px 0',
                          borderBottom: '1px solid #dee2e6'
                        }}>
                          <span style={{ color: '#495057', fontSize: '14px' }}>{criterion}:</span>
                          <span style={{ color: '#8B5CF6', fontWeight: 'bold' }}>{score as number}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'listening' && listeningResult && (
          <div>
            <h3 style={{ color: '#8B5CF6', fontSize: '24px', marginBottom: '25px' }}>
              🎧 Listening Modülü Detayları
            </h3>
            
            {/* Listening Skoru */}
            <div style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
              color: 'white',
              padding: '25px',
              borderRadius: '15px',
              textAlign: 'center',
              marginBottom: '25px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>IELTS Listening Band Score</h4>
              <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '10px' }}>
                {listeningResult.band_estimate}
              </div>
              <p style={{ margin: 0, opacity: 0.9 }}>
                {listeningResult.scaled?.correct || 0} / {listeningResult.scaled?.total || 0} doğru cevap
              </p>
            </div>

            {/* Detaylı İstatistikler */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px'
            }}>
              <div style={{
                background: '#e8f5e8',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid #4CAF50'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50', marginBottom: '5px' }}>
                  {listeningResult.scaled?.correct || 0}
                </div>
                <div style={{ color: '#2E7D32', fontSize: '14px' }}>Doğru</div>
              </div>
              
              <div style={{
                background: '#ffebee',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid #F44336'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F44336', marginBottom: '5px' }}>
                  {(listeningResult.scaled?.total || 0) - (listeningResult.scaled?.correct || 0)}
                </div>
                <div style={{ color: '#C62828', fontSize: '14px' }}>Yanlış</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'listening' && !listeningResult && (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <Volume2 size={80} color="#ccc" style={{ marginBottom: '20px' }} />
            <h4 style={{ color: '#ccc', marginBottom: '10px' }}>Listening Modülü Henüz Tamamlanmadı</h4>
            <p style={{ color: '#999' }}>Bu modülü tamamlamak için ana sayfaya dönüp listening testini başlatabilirsiniz.</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '15px',
        justifyContent: 'center',
        marginTop: '30px',
        flexWrap: 'wrap'
      }}>
        <Link to="/" className="btn btn-outline" style={{ textDecoration: 'none' }}>
          🏠 Ana Sayfaya Dön
        </Link>
        <Link to="/dashboard" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          📊 Dashboard'a Git
        </Link>
        <button className="btn btn-secondary" onClick={onBack}>
          🔄 Yeni Deneme Başlat
        </button>
      </div>
    </div>
  );
};

export default TestEvaluation;
