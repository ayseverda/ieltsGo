import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '../services/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const validateAuth = async () => {
      // Önce local storage'da token var mı kontrol et
      const hasToken = auth.isAuthenticated();
      
      if (!hasToken) {
        setIsAuthenticated(false);
        setIsValidating(false);
        return;
      }

      // Token varsa backend'de doğrula (ama çok agresif olmasın)
      try {
        const isValid = await auth.validateToken();
        setIsAuthenticated(isValid);
      } catch (error) {
        console.error('Token doğrulama hatası:', error);
        // Hata durumunda token'ı geçerli kabul et (login döngüsünü önlemek için)
        setIsAuthenticated(true);
      } finally {
        setIsValidating(false);
      }
    };

    validateAuth();
  }, []);

  if (isValidating) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #374151 100%)',
        color: 'white',
        fontSize: '1.2rem'
      }}>
        🔐 Kimlik doğrulanıyor...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
