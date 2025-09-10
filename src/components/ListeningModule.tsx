import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Headphones } from 'lucide-react';

const ListeningModule: React.FC = () => {
  return (
    <div className="container">
      <div className="card">
        <div className="mb-4">
          <Link to="/" className="btn mb-2">
            <ArrowLeft style={{ marginRight: '8px' }} />
            Ana Sayfaya Dön
          </Link>
          <h1 className="module-header">
            <Headphones />
            Listening Modülü
          </h1>
        </div>

        <div className="grid">
          <div className="card">
            <h3>🎧 Ses Dosyaları</h3>
            <p>Çeşitli aksanlarda IELTS seviyesinde ses dosyalarını dinleyin</p>
            <button className="btn">Başla</button>
          </div>

          <div className="card">
            <h3>📝 Dinleme Soruları</h3>
            <p>Dinlediğiniz içerikle ilgili soruları cevaplayın</p>
            <button className="btn btn-secondary">Başla</button>
          </div>

          <div className="card">
            <h3>📊 Performans Takibi</h3>
            <p>Dinleme becerilerinizdeki gelişimi takip edin</p>
            <button className="btn btn-success">Görüntüle</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListeningModule;
