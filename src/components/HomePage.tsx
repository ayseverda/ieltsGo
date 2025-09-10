import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, PenTool, Headphones, Mic } from 'lucide-react';

const HomePage: React.FC = () => {
  return (
    <div className="container">
      <div className="text-center mb-4">
        <h1 className="title">IELTS Go</h1>
        <p className="subtitle">Yapay Zeka Destekli IELTS Hazırlık Platformu</p>
      </div>

      <div className="grid">
        <div className="card">
          <BookOpen className="icon" />
          <h2>Reading</h2>
          <p>
            Okuma becerilerinizi geliştirin. Yapay zeka destekli metin analizi 
            ve soru çözme teknikleri ile IELTS Reading bölümüne hazırlanın.
          </p>
          <Link to="/reading" className="btn">
            Reading Modülüne Git
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
