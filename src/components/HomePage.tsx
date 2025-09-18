import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, PenTool, Headphones, Mic, Trophy, BarChart3 } from 'lucide-react';
import { auth } from '../services/auth';

// Logo imports
import headerLogo from '../assets/ieltsgoyazi.png';
import mainLogo from '../assets/logo.png';
import kitapLogo from '../assets/ieltsgokitap.png';


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
    <div className="homepage-container">
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
          
          {isAuthenticated && (
            <div className="user-section">
              <span className="welcome-text">Hoş geldin, {user?.name || 'Kullanıcı'}!</span>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-layout">
            <div className="hero-text">
              <h2 className="hero-title">Yapay Zeka Destekli IELTS Hazırlık</h2>
              <p className="hero-subtitle">Tüm modüllerde profesyonel seviyede pratik yapın ve gerçek sınav deneyimi yaşayın</p>
            </div>
            <div className="main-logo-container">
              <img 
                src={mainLogo} 
                alt="IELTSGO" 
                className="main-logo-image"
              />
            </div>
          </div>
          
          {!isAuthenticated && (
            <div className="auth-buttons">
              <Link to="/login" className="auth-btn login-btn">Giriş Yap</Link>
              <Link to="/register" className="auth-btn register-btn">Kayıt Ol</Link>
            </div>
          )}
        </div>
      </section>

      {/* Modules Grid */}
      <section className="modules-section">
        <div className="modules-grid">
          <div className="module-card">
            <div className="module-icon">
              <BookOpen size={32} />
            </div>
            <h3 className="module-title">Reading</h3>
            <p className="module-description">
              Okuma becerilerinizi geliştirin. AI destekli pratik testleri ile 
              IELTS Reading bölümüne hazırlanın.
            </p>
            <Link to="/reading" className="module-btn">
              Reading Pratik Yap
            </Link>
          </div>

          <div className="module-card">
            <div className="module-icon">
              <PenTool size={32} />
            </div>
            <h3 className="module-title">Writing</h3>
            <p className="module-description">
              Yazma becerilerinizi geliştirin. AI destekli yazı analizi ve 
              geri bildirim ile IELTS Writing bölümünde başarılı olun.
            </p>
            <Link to="/writing" className="module-btn">
              Writing Modülüne Git
            </Link>
          </div>

          <div className="module-card">
            <div className="module-icon">
              <Headphones size={32} />
            </div>
            <h3 className="module-title">Listening</h3>
            <p className="module-description">
              Dinleme becerilerinizi geliştirin. Çeşitli aksanlar ve konuşma 
              hızları ile IELTS Listening bölümüne hazırlanın.
            </p>
            <Link to="/listening" className="module-btn">
              Listening Modülüne Git
            </Link>
          </div>

          <div className="module-card">
            <div className="module-icon">
              <Mic size={32} />
            </div>
            <h3 className="module-title">Speaking</h3>
            <p className="module-description">
              Konuşma becerilerinizi geliştirin. AI destekli konuşma analizi 
              ve telaffuz değerlendirmesi ile IELTS Speaking bölümünde başarılı olun.
            </p>
            <Link to="/speaking" className="module-btn">
              Speaking Modülüne Git
            </Link>
          </div>

          <div className="module-card featured">
            <div className="module-icon">
              <Trophy size={32} />
            </div>
            <h3 className="module-title">Genel Deneme</h3>
            <p className="module-description">
              Tüm modülleri içeren AI destekli genel IELTS denemesi yapın ve 
              puanınızı öğrenin. Gerçek sınav deneyimi yaşayın.
            </p>
            <Link to="/general-test" className="module-btn featured-btn">
              Genel Deneme Modülüne Git
            </Link>
          </div>

          <div className="module-card">
            <div className="module-icon">
              <BarChart3 size={32} />
            </div>
            <h3 className="module-title">Dashboard</h3>
            <p className="module-description">
              Tüm modüllerdeki performansını tek ekranda takip et. Gelişimini,
              en iyi skorlarını ve son test sonuçlarını görüntüle.
            </p>
            <Link to="/dashboard" className="module-btn">
              Dashboard'a Git
            </Link>
            {isAuthenticated && (
              <button onClick={handleLogout} className="logout-btn-card">
                Çıkış Yap
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <h2 className="features-title">Neden IELTSGO?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Kişiselleştirilmiş Öğrenme</h3>
              <p>AI algoritmaları ile seviyenize uygun içerik ve öneriler</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Detaylı Analiz</h3>
              <p>Performansınızı takip edin ve gelişim alanlarınızı belirleyin</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Sürekli Güncelleme</h3>
              <p>En güncel IELTS formatına uygun içerik ve sorular</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
