import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, PenTool, Headphones, Mic, Trophy, BarChart3 } from 'lucide-react';
import { auth } from '../services/auth';

// Logo imports
import headerLogo from '../assets/ieltsgoyazi.png';
import kitapLogo from '../assets/ieltsgokitap.png';

const SpeakingModule: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = () => {
      const user = auth.getCurrentUser();
      if (user) {
        setIsAuthenticated(true);
        setUser(user);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate]);

  const handleLogout = () => {
    auth.logout();
    setIsAuthenticated(false);
    setUser(null);
    navigate('/');
  };

  if (!isAuthenticated) {
    return (
      <div className="speaking-module">
        <div className="module-content">
          <div className="card" style={{ width: '100%', maxWidth: 'none' }}>
            <h2>Giriş Yapmanız Gerekiyor</h2>
            <p>Speaking modülünü kullanmak için giriş yapmalısınız.</p>
            <Link to="/login" className="module-btn">
              Giriş Yap
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="speaking-module">
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
            <Link to="/writing" className="nav-item">
              <PenTool size={20} />
              <span>Writing</span>
            </Link>
            <Link to="/listening" className="nav-item">
              <Headphones size={20} />
              <span>Listening</span>
            </Link>
            <Link to="/speaking" className="nav-item active">
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
              <Mic />
              Speaking Modülü
            </h1>
            <p className="module-description">
              IELTS Speaking sınavına hazırlanmak için konuşma pratiği yapın ve performansınızı değerlendirin.
            </p>
          </div>

          <div className="grid">
            <div className="card">
              <div className="card-icon">
                <Mic size={32} />
              </div>
              <h3>🎤 Konuşma Pratiği</h3>
              <p>AI öğretmen ile konuşma pratiği yapın. Ses kaydı yapın, metin dönüştürme ve AI yanıtları alın. Session sonunda IELTS değerlendirmesi alın.</p>
              <Link to="/speech-recording" className="module-btn" style={{ textDecoration: 'none' }}>
                <Mic size={16} style={{ marginRight: '8px' }} />
                Konuşma Pratiğine Başla
              </Link>
            </div>

            <div className="card">
              <div className="card-icon">
                <BarChart3 size={32} />
              </div>
              <h3>📊 Konuşma Analizi</h3>
              <p>Geçmiş konuşmalarınızın gramer, kelime dağarcığı ve cümle yapısı analizini görüntüleyin.</p>
              <Link to="/conversation-analysis" className="module-btn" style={{ textDecoration: 'none' }}>
                <BarChart3 size={16} style={{ marginRight: '8px' }} />
                Analiz Görüntüle
              </Link>
            </div>

            <div className="card">
              <div className="card-icon">
                <Trophy size={32} />
              </div>
              <h3>🏆 IELTS Speaking Test</h3>
              <p>Gerçek IELTS Speaking test formatında pratik yapın. 3 bölümden oluşan tam kapsamlı test deneyimi.</p>
              <Link to="/general-test" className="module-btn featured-btn" style={{ textDecoration: 'none' }}>
                <Trophy size={16} style={{ marginRight: '8px' }} />
                IELTS Speaking Test
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeakingModule;