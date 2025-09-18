import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, PenTool, Headphones, Mic, Trophy, BarChart3 } from 'lucide-react';
import { auth } from '../services/auth';
import './LoginPage.css';

// Logo imports
import headerLogo from '../assets/ieltsgoyazi.png';
import kitapLogo from '../assets/ieltsgokitap.png';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await auth.login({ email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
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

      <div className="login-content">
        <div className="login-card">
          <div className="login-header">
            <h1>🎯 IELTS Go</h1>
            <p>Hesabınıza giriş yapın</p>
          </div>

        <form onSubmit={handleSubmit} className="login-form">
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
              placeholder="••••••••"
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

          <div className="login-footer">
            <p>
              Hesabınız yok mu?{' '}
              <Link to="/register" className="link">
                Kayıt olun
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
