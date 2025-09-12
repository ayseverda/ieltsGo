import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import ReadingModule from './components/ReadingModule';
import WritingModule from './components/WritingModule';
import ListeningModule from './components/ListeningModule';
import SpeakingModule from './components/SpeakingModule';
import './App.css';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/reading" element={<ReadingModule />} />
          <Route path="/writing" element={<WritingModule />} />
          <Route path="/listening" element={<ListeningModule />} />
          <Route path="/speaking" element={<SpeakingModule />} />
        </Routes>

        <button className="theme-toggle" onClick={toggleTheme} aria-label="Tema değiştir">
          {theme === 'dark' ? '🌙 dark' : '☀️ light'}
        </button>
      </div>
    </Router>
  );
}

export default App;
