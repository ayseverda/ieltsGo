import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/auth';
import './Dashboard.css';
import PlantGrowth from './PlantGrowth';

interface UserStats {
  listening: {
    totalTests: number;
    averageScore: number;
    bestScore: number;
  };
  reading: {
    totalTests: number;
    averageScore: number;
    bestScore: number;
  };
  writing: {
    totalEssays: number;
    averageScore: number;
    bestScore: number;
  };
  speaking: {
    totalSessions: number;
    averageScore: number;
    bestScore: number;
  };
  overall: {
    totalTests: number;
    ieltsBandScore: number;
    improvementRate: number;
    streak: number;
  };
}

const Dashboard: React.FC = () => {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchUserStats();
    fetchUserInfo();
  }, []);

  const fetchUserStats = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔍 Dashboard - localStorage token:', token ? 'Token var' : 'Token yok');
      console.log('🔍 Dashboard - localStorage keys:', Object.keys(localStorage));
      
      if (!token) {
        // Kullanıcı giriş yapmamış
        const defaultStats: UserStats = {
          listening: { totalTests: 0, averageScore: 0, bestScore: 0 },
          reading: { totalTests: 0, averageScore: 0, bestScore: 0 },
          writing: { totalEssays: 0, averageScore: 0, bestScore: 0 },
          speaking: { totalSessions: 0, averageScore: 0, bestScore: 0 },
          overall: { totalTests: 0, ieltsBandScore: 0, improvementRate: 0, streak: 0 }
        };
        setUserStats(defaultStats);
        setIsLoading(false);
        return;
      }

      // Backend'den gerçek verileri çek
      console.log('📊 Dashboard - İstatistik isteği gönderiliyor...');
      console.log('🔑 Dashboard - Token:', token ? `${token.substring(0, 20)}...` : 'Token yok');
      
       const response = await auth.secureFetch('http://localhost:8000/api/user-stats');

      console.log('📥 Dashboard - Backend yanıtı:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Dashboard - İstatistik verileri alındı:', data);
        
        // Backend'den gelen veriyi frontend formatına çevir
        const stats: UserStats = {
          listening: {
            totalTests: data.listening.test_count,
            averageScore: data.listening.average,
            bestScore: data.listening.best
          },
          reading: {
            totalTests: data.reading.test_count,
            averageScore: data.reading.average,
            bestScore: data.reading.best
          },
          writing: {
            totalEssays: data.writing.test_count,
            averageScore: data.writing.average,
            bestScore: data.writing.best
          },
          speaking: {
            totalSessions: data.speaking.test_count,
            averageScore: data.speaking.average,
            bestScore: data.speaking.best
          },
          overall: {
            totalTests: data.overall.total_tests,
            ieltsBandScore: data.overall.estimated_ielts,
            improvementRate: 0, // TODO: Hesaplanacak
            streak: 0 // TODO: Hesaplanacak
          }
        };
        
        setUserStats(stats);
        setLastUpdated(new Date());
        console.log('✅ Dashboard verileri güncellendi:', new Date().toLocaleTimeString());
      } else {
        throw new Error('İstatistik yükleme hatası');
      }
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error);
      // Hata durumunda varsayılan değerler
      const defaultStats: UserStats = {
        listening: { totalTests: 0, averageScore: 0, bestScore: 0 },
        reading: { totalTests: 0, averageScore: 0, bestScore: 0 },
        writing: { totalEssays: 0, averageScore: 0, bestScore: 0 },
        speaking: { totalSessions: 0, averageScore: 0, bestScore: 0 },
        overall: { totalTests: 0, ieltsBandScore: 0, improvementRate: 0, streak: 0 }
      };
      setUserStats(defaultStats);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const userData = auth.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  const handleLogout = () => {
    auth.logout();
    window.location.href = '/login';
  };

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-title">
          <Link to="/" className="home-link">🏠 Anasayfa</Link>
          <h1>📊 IELTS Go Dashboard</h1>
        </div>
        <div className="user-info">
          <span>Hoş geldin, {user?.name || 'Öğrenci'}!</span>
          <button className="refresh-btn" onClick={fetchUserStats} disabled={isLoading}>
            {isLoading ? '🔄 Yükleniyor...' : '🔄 Yenile'}
          </button>
          <button className="logout-btn" onClick={handleLogout}>Çıkış Yap</button>
        </div>
      </div>

      {lastUpdated && (
        <div className="last-updated">
          <span>📅 Son güncelleme: {lastUpdated.toLocaleTimeString('tr-TR')}</span>
        </div>
      )}

      <div className="stats-overview">
        <div className="stat-card overall">
          <h3>🎯 Genel IELTS Puanı</h3>
          <div className="score">{userStats?.overall.ieltsBandScore.toFixed(1) || '0.0'}</div>
          <div className="improvement">+{userStats?.overall.improvementRate || '0'}% gelişim</div>
        </div>

        <div className="stat-card streak" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <h3>🔥 Seri</h3>
          <PlantGrowth streak={userStats?.overall.streak || 0} size={160} />
          <div className="improvement" style={{ marginTop: 8 }}>Günlük çalışma</div>
        </div>

        <div className="stat-card total">
          <h3>📝 Toplam Test</h3>
          <div className="score">{userStats?.overall.totalTests || '0'}</div>
          <div className="improvement">Test tamamlandı</div>
        </div>
      </div>

      <div className="modules-stats">
        <h2>📚 Modül İstatistikleri</h2>
        
        <div className="module-cards">
          <div className="module-card">
            <div className="module-header">
              <h3>🎧 Listening</h3>
              <Link to="/listening" className="practice-btn">Pratik Yap</Link>
            </div>
            <div className="module-stats">
              <div className="stat">
                <span className="label">Test Sayısı:</span>
                <span className="value">{userStats?.listening.totalTests || '0'}</span>
              </div>
              <div className="stat">
                <span className="label">Ortalama:</span>
                <span className="value">{userStats?.listening.averageScore?.toFixed(1) || '0.0'}</span>
              </div>
              <div className="stat">
                <span className="label">En İyi:</span>
                <span className="value">{userStats?.listening.bestScore?.toFixed(1) || '0.0'}</span>
              </div>
            </div>
          </div>

          <div className="module-card">
            <div className="module-header">
              <h3>📖 Reading</h3>
              <Link to="/reading" className="practice-btn">Pratik Yap</Link>
            </div>
            <div className="module-stats">
              <div className="stat">
                <span className="label">Test Sayısı:</span>
                <span className="value">{userStats?.reading.totalTests || '0'}</span>
              </div>
              <div className="stat">
                <span className="label">Ortalama:</span>
                <span className="value">{userStats?.reading.averageScore?.toFixed(1) || '0.0'}</span>
              </div>
              <div className="stat">
                <span className="label">En İyi:</span>
                <span className="value">{userStats?.reading.bestScore?.toFixed(1) || '0.0'}</span>
              </div>
            </div>
          </div>

          <div className="module-card">
            <div className="module-header">
              <h3>✍️ Writing</h3>
              <Link to="/writing" className="practice-btn">Pratik Yap</Link>
            </div>
            <div className="module-stats">
              <div className="stat">
                <span className="label">Essay Sayısı:</span>
                <span className="value">{userStats?.writing.totalEssays || '0'}</span>
              </div>
              <div className="stat">
                <span className="label">Ortalama:</span>
                <span className="value">{userStats?.writing.averageScore?.toFixed(1) || '0.0'}</span>
              </div>
              <div className="stat">
                <span className="label">En İyi:</span>
                <span className="value">{userStats?.writing.bestScore?.toFixed(1) || '0.0'}</span>
              </div>
            </div>
          </div>

          <div className="module-card">
            <div className="module-header">
              <h3>🗣️ Speaking</h3>
              <Link to="/speaking" className="practice-btn">Pratik Yap</Link>
            </div>
            <div className="module-stats">
              <div className="stat">
                <span className="label">Session Sayısı:</span>
                <span className="value">{userStats?.speaking.totalSessions || '0'}</span>
              </div>
              <div className="stat">
                <span className="label">Ortalama:</span>
                <span className="value">{userStats?.speaking.averageScore?.toFixed(1) || '0.0'}</span>
              </div>
              <div className="stat">
                <span className="label">En İyi:</span>
                <span className="value">{userStats?.speaking.bestScore?.toFixed(1) || '0.0'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
