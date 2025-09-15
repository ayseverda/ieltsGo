import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, PenTool, Headphones, Mic, Trophy } from 'lucide-react';
import { auth } from '../services/auth';

const HomePage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // Önce local storage'da token var mı kontrol et
      const hasToken = auth.isAuthenticated();
      
      if (!hasToken) {
        setIsAuthenticated(false);
        setUser(null);
        return;
      }

      // Token varsa backend'de doğrula (ama çok agresif olmasın)
      try {
        const isValid = await auth.validateToken();
        if (isValid) {
          const userData = auth.getCurrentUser();
          setIsAuthenticated(true);
          setUser(userData);
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Token doğrulama hatası:', error);
        // Hata durumunda token'ı geçerli kabul et (login döngüsünü önlemek için)
        const userData = auth.getCurrentUser();
        setIsAuthenticated(true);
        setUser(userData);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = () => {
    auth.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <div className="container">
      <div className="text-center mb-4">
        <h1 className="title">IELTS Go</h1>
        <p className="subtitle">Yapay Zeka Destekli IELTS Hazırlık Platformu</p>
        
        {isAuthenticated ? (
          <div className="auth-buttons">
            <span className="welcome-text">Hoş geldin, {user?.name || 'Kullanıcı'}!</span>
            <Link to="/dashboard" className="auth-btn dashboard-btn">📊 Dashboard</Link>
            <button onClick={handleLogout} className="auth-btn logout-btn">Çıkış Yap</button>
          </div>
        ) : (
          <div className="auth-buttons">
            <Link to="/login" className="auth-btn login-btn">Giriş Yap</Link>
            <Link to="/register" className="auth-btn register-btn">Kayıt Ol</Link>
          </div>
        )}
      </div>

      <div className="grid">
        <div className="card">
          <BookOpen className="icon" />
          <h2>Reading</h2>
          <p>
            Okuma becerilerinizi geliştirin. AI destekli pratik testleri ile 
            IELTS Reading bölümüne hazırlanın. Her test 1 metin ve 13 soru içerir.
          </p>
          <Link to="/reading" className="btn">
            Reading Pratik Yap
          </Link>
        </div>

        <div className="card">
          <PenTool className="icon" />
          <h2>Writing</h2>
          <p>
            Yazma becerilerinizi geliştirin. AI destekli yazı analizi ve 
            geri bildirim ile IELTS Writing bölümünde başarılı olun.
          </p>
          <Link to="/writing" className="btn btn-secondary">
            Writing Modülüne Git
          </Link>
        </div>

        <div className="card">
          <Headphones className="icon" />
          <h2>Listening</h2>
          <p>
            Dinleme becerilerinizi geliştirin. Çeşitli aksanlar ve konuşma 
            hızları ile IELTS Listening bölümüne hazırlanın.
          </p>
          <Link to="/listening" className="btn btn-success">
            Listening Modülüne Git
          </Link>
        </div>

        <div className="card">
          <Mic className="icon" />
          <h2>Speaking</h2>
          <p>
            Konuşma becerilerinizi geliştirin. AI destekli konuşma analizi 
            ve telaffuz değerlendirmesi ile IELTS Speaking bölümünde başarılı olun.
          </p>
          <Link to="/speaking" className="btn btn-warning">
            Speaking Modülüne Git
          </Link>
        </div>

        <div className="card">
          <Trophy className="icon" />
          <h2>Genel Deneme</h2>
          <p>
            Tüm modülleri içeren AI destekli genel IELTS denemesi yapın ve 
            puanınızı öğrenin. Gerçek sınav deneyimi yaşayın.
          </p>
          <Link to="/general-test" className="btn" style={{ background: "#FFD700", color: "#222" }}>
            Genel Deneme Modülüne Git
          </Link>
        </div>
      </div>

      <div className="card text-center">
        <h2>Özellikler</h2>
        <div className="grid">
          <div>
            <h3>🎯 Kişiselleştirilmiş Öğrenme</h3>
            <p>AI algoritmaları ile seviyenize uygun içerik ve öneriler</p>
          </div>
          <div>
            <h3>📊 Detaylı Analiz</h3>
            <p>Performansınızı takip edin ve gelişim alanlarınızı belirleyin</p>
          </div>
          <div>
            <h3>🔄 Sürekli Güncelleme</h3>
            <p>En güncel IELTS formatına uygun içerik ve sorular</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
