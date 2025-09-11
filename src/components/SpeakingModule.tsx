import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mic } from 'lucide-react';

const SpeakingModule: React.FC = () => {
  return (
    <div className="container">
      <div className="card">
        <div className="mb-4">
          <Link to="/" className="btn mb-2">
            <ArrowLeft style={{ marginRight: '8px' }} />
            Ana Sayfaya Dön
          </Link>
          <h1 className="module-header">
            <Mic />
            Speaking Modülü
          </h1>
        </div>

        <div className="grid">
          <div className="card">
            <h3>🎤 Konuşma Kaydı</h3>
            <p>AI öğretmen ile konuşma pratiği yapın. Ses kaydı yapın, metin dönüştürme ve AI yanıtları alın.</p>
            <Link to="/speech-recording" className="btn" style={{ textDecoration: 'none' }}>
              <Mic style={{ marginRight: '8px' }} />
              START SPEECH RECORDING
            </Link>
          </div>

          <div className="card">
            <h3>🗣️ Telaffuz Analizi</h3>
            <p>Konuşmanızın telaffuz ve akıcılığını analiz edin</p>
            <button className="btn btn-secondary" disabled>
              Analiz Et (Yakında)
            </button>
          </div>

          <div className="card">
            <h3>📈 Gelişim Takibi</h3>
            <p>Konuşma becerilerinizdeki gelişimi takip edin</p>
            <button className="btn btn-success" disabled>
              Görüntüle (Yakında)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeakingModule;
