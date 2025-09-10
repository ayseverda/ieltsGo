import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, PenTool } from 'lucide-react';

const WritingModule: React.FC = () => {
  return (
    <div className="container">
      <div className="card">
        <div className="mb-4">
          <Link to="/" className="btn mb-2">
            <ArrowLeft style={{ marginRight: '8px' }} />
            Ana Sayfaya Dön
          </Link>
          <h1 className="module-header">
            <PenTool />
            Writing Modülü
          </h1>
        </div>

        <div className="grid">
          <div className="card">
            <h3>✍️ Task 1 - Grafik Analizi</h3>
            <p>Grafik, tablo ve diyagramları analiz ederek yazı yazın</p>
            <button className="btn">Başla</button>
          </div>

          <div className="card">
            <h3>📝 Task 2 - Essay Yazma</h3>
            <p>Verilen konu hakkında görüş bildiren essay yazın</p>
            <button className="btn btn-secondary">Başla</button>
          </div>

          <div className="card">
            <h3>🤖 AI Değerlendirme</h3>
            <p>Yazılarınızı AI ile değerlendirin ve geri bildirim alın</p>
            <button className="btn btn-success">Değerlendir</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WritingModule;
