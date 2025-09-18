import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, PenTool, Headphones, Mic, Trophy, BarChart3 } from 'lucide-react';
import { auth } from '../services/auth';
import './RegisterPage.css';

// Logo imports
import headerLogo from '../assets/ieltsgoyazi.png';
import kitapLogo from '../assets/ieltsgokitap.png';

const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    // Validation
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      setIsLoading(false);
      return;
    }

    try {
      await auth.register({ name, email, password });
      
      // Kayıt başarılı mesajı göster
      setSuccessMessage('🎉 Kayıt başarılı! Giriş yapabilirsiniz.');
      
      // 2 saniye sonra giriş sayfasına yönlendir
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Kayıt olunamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
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
        </div>
      </header>

      <div className="register-content">
        <div className="register-card">
          <div className="register-header">
            <h1>🎯 IELTS Go</h1>
            <p>Yeni hesap oluşturun</p>
          </div>

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label htmlFor="name">Ad Soyad</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Adınız ve soyadınız"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">E-posta</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="ornek@email.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Şifre</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="En az 6 karakter"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Şifre Tekrar</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Şifrenizi tekrar girin"
              minLength={6}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          <button 
            type="submit" 
            className="register-button"
            disabled={isLoading}
          >
            {isLoading ? 'Kayıt olunuyor...' : 'Kayıt Ol'}
          </button>
        </form>

          <div className="register-footer">
            <p>
              Zaten hesabınız var mı?{' '}
              <Link to="/login" className="link">
                Giriş yapın
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
