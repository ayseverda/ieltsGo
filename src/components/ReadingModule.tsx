import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';

const ReadingModule: React.FC = () => {
  return (
    <div className="container">
      <div className="card">
        <div className="mb-4">
          <Link to="/" className="btn mb-2">
            <ArrowLeft style={{ marginRight: '8px' }} />
            Ana Sayfaya Dön
          </Link>
          <h1 className="module-header">
            <BookOpen />
            Reading Modülü
          </h1>
        </div>

        <div className="grid">
          <div className="card">
            <h3>📖 Metin Okuma</h3>
            <p>Çeşitli konularda IELTS seviyesinde metinler okuyun</p>
            <button className="btn">Başla</button>
          </div>

          <div className="card">
            <h3>❓ Soru Çözme</h3>
            <p>Okuduğunuz metinlerle ilgili soruları çözün</p>
            <button className="btn btn-secondary">Başla</button>
          </div>

          <div className="card">
            <h3>📊 Performans Analizi</h3>
            <p>Çözümlerinizi analiz edin ve gelişim alanlarınızı görün</p>
            <button className="btn btn-success">Görüntüle</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReadingModule;
