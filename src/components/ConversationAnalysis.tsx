import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, MessageSquare, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface MessageAnalysis {
  _id: string;
  userId: string;
  topicId: string;
  topicTitle: string;
  message: string;
  timestamp: Date;
  analysis: {
    grammarErrors: Array<{
      error: string;
      suggestion: string;
      position: number;
    }>;
    vocabularyLevel: 'beginner' | 'intermediate' | 'advanced';
    sentenceStructure: 'simple' | 'complex' | 'compound';
    wordCount: number;
    complexityScore: number;
    overallScore: number;
    improvements: string[];
  };
}

interface TopicStats {
  topicId: string;
  topicTitle: string;
  messageCount: number;
  averageScore: number;
  commonErrors: string[];
  icon: string;
}

const ConversationAnalysis: React.FC = () => {
  const [messages, setMessages] = useState<MessageAnalysis[]>([]);
  const [topicStats, setTopicStats] = useState<TopicStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');

  useEffect(() => {
    fetchAnalysisData();
  }, []);

  const fetchAnalysisData = async () => {
    try {
      setLoading(true);
      
      // Fetch user messages with analysis
      const messagesResponse = await fetch('http://localhost:8000/api/speaking/user-messages', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Assuming JWT auth
        }
      });
      
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        setMessages(messagesData);
      }

      // Fetch topic statistics
      const statsResponse = await fetch('http://localhost:8000/api/speaking/topic-stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setTopicStats(statsData);
      }
      
    } catch (error) {
      console.error('Analiz verileri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = selectedTopic === 'all' 
    ? messages 
    : messages.filter(msg => msg.topicId === selectedTopic);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4ade80';
    if (score >= 60) return '#fbbf24';
    return '#f87171';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Mükemmel';
    if (score >= 60) return 'İyi';
    if (score >= 40) return 'Orta';
    return 'Geliştirilmeli';
  };

  if (loading) {
    return (
      <div className="App" style={{ minHeight: '100vh', padding: '20px' }}>
        <div className="container">
          <div className="card text-center">
            <div style={{ padding: '60px 20px' }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '20px'
              }}>📊</div>
              <h2>Analiz verileri yükleniyor...</h2>
              <p style={{ color: 'var(--muted-text)' }}>
                Konuşma geçmişiniz analiz ediliyor.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App" style={{ minHeight: '100vh', padding: '20px' }}>
      <div className="container">
        <div className="card">
          <div className="mb-4">
            <Link to="/speaking" className="btn mb-2">
              <ArrowLeft style={{ marginRight: '8px' }} />
              Speaking Modülüne Dön
            </Link>
            <h1 className="module-header">
              <BarChart3 />
              Konuşma Analizi
            </h1>
            <p style={{ color: 'var(--muted-text)', marginTop: '10px' }}>
              Geçmiş konuşmalarınızın detaylı dil analizi ve gelişim önerileri
            </p>
          </div>

          {/* Topic Statistics Overview */}
          {topicStats.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                marginBottom: '20px' 
              }}>
                <TrendingUp size={24} />
                Konu Bazlı İstatistikler
              </h2>
              
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {topicStats.map(topic => (
                  <div key={topic.topicId} className="card" style={{
                    background: 'linear-gradient(135deg, var(--card-bg) 0%, #f8fafc 100%)',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                      <span style={{ fontSize: '24px' }}>{topic.icon}</span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>{topic.topicTitle}</h3>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted-text)' }}>
                          {topic.messageCount} mesaj
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '14px' }}>Ortalama Skor:</span>
                        <span style={{ 
                          fontWeight: 'bold',
                          color: getScoreColor(topic.averageScore)
                        }}>
                          {topic.averageScore.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${topic.averageScore}%`,
                          height: '100%',
                          backgroundColor: getScoreColor(topic.averageScore),
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                    
                    {topic.commonErrors.length > 0 && (
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                          Sık Karşılaşılan Hatalar:
                        </p>
                        <ul style={{ 
                          fontSize: '13px', 
                          color: 'var(--muted-text)',
                          margin: 0,
                          paddingLeft: '18px'
                        }}>
                          {topic.commonErrors.slice(0, 3).map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Topic Filter */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '500' 
            }}>
              Konu Filtresi:
            </label>
            <select 
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              style={{
                padding: '10px 15px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text)',
                fontSize: '14px',
                minWidth: '200px'
              }}
            >
              <option value="all">Tüm Konular</option>
              {topicStats.map(topic => (
                <option key={topic.topicId} value={topic.topicId}>
                  {topic.topicTitle}
                </option>
              ))}
            </select>
          </div>

          {/* Messages List */}
          <div>
            <h2 style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              marginBottom: '20px' 
            }}>
              <MessageSquare size={24} />
              Mesaj Analizi ({filteredMessages.length})
            </h2>

            {filteredMessages.length === 0 ? (
              <div className="card text-center" style={{ padding: '60px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>💬</div>
                <h3>Henüz analiz edilmiş mesaj bulunmuyor</h3>
                <p style={{ color: 'var(--muted-text)', marginBottom: '20px' }}>
                  Konuşma kaydı yapmaya başlayın, mesajlarınız otomatik olarak analiz edilecek.
                </p>
                <Link to="/speech-recording" className="btn">
                  Konuşma Kaydına Başla
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {filteredMessages.map(message => (
                  <div key={message._id} className="card" style={{
                    border: '1px solid #e5e7eb',
                    padding: '20px'
                  }}>
                    {/* Message Header */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      marginBottom: '15px',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', marginBottom: '5px' }}>
                          {message.topicTitle}
                        </h3>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '10px',
                          fontSize: '14px',
                          color: 'var(--muted-text)'
                        }}>
                          <Clock size={14} />
                          {new Date(message.timestamp).toLocaleString('tr-TR')}
                        </div>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px' 
                      }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          backgroundColor: getScoreColor(message.analysis.overallScore),
                          color: 'white'
                        }}>
                          {getScoreLabel(message.analysis.overallScore)} ({message.analysis.overallScore}%)
                        </span>
                      </div>
                    </div>

                    {/* Original Message */}
                    <div style={{
                      backgroundColor: 'var(--bg)',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '15px',
                      borderLeft: '4px solid var(--accent)'
                    }}>
                      <p style={{ margin: 0, lineHeight: '1.5' }}>
                        "{message.message}"
                      </p>
                    </div>

                    {/* Analysis Details */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                      {/* Grammar Errors */}
                      <div>
                        <h4 style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          margin: '0 0 10px 0',
                          fontSize: '14px'
                        }}>
                          <AlertTriangle size={16} color="#f59e0b" />
                          Gramer Hataları ({message.analysis.grammarErrors.length})
                        </h4>
                        {message.analysis.grammarErrors.length === 0 ? (
                          <p style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            fontSize: '13px',
                            color: '#059669',
                            margin: 0
                          }}>
                            <CheckCircle size={14} />
                            Gramer hatası bulunamadı
                          </p>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                            {message.analysis.grammarErrors.map((error, index) => (
                              <li key={index} style={{ marginBottom: '5px' }}>
                                <strong>{error.error}</strong>
                                <br />
                                <span style={{ color: 'var(--muted-text)' }}>
                                  Öneri: {error.suggestion}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Analysis Stats */}
                      <div>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
                          Analiz Detayları
                        </h4>
                        <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Kelime Sayısı:</span>
                            <strong>{message.analysis.wordCount}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Kelime Düzeyi:</span>
                            <strong style={{ textTransform: 'capitalize' }}>
                              {message.analysis.vocabularyLevel}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Cümle Yapısı:</span>
                            <strong style={{ textTransform: 'capitalize' }}>
                              {message.analysis.sentenceStructure}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Karmaşıklık:</span>
                            <strong>{message.analysis.complexityScore}%</strong>
                          </div>
                        </div>
                      </div>

                      {/* Improvements */}
                      {message.analysis.improvements.length > 0 && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
                            💡 Gelişim Önerileri
                          </h4>
                          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                            {message.analysis.improvements.map((improvement, index) => (
                              <li key={index} style={{ marginBottom: '3px' }}>
                                {improvement}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationAnalysis;