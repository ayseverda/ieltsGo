<<<<<<< HEAD
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
=======
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
>>>>>>> 091d9436fb64784688da7749c77dfa99f1b41a97
import HomePage from './components/HomePage';
import ReadingModule from './components/ReadingModule';
import WritingModule from './components/WritingModule';
import ListeningModule from './components/ListeningModule';
import SpeakingModule from './components/SpeakingModule';
import SpeechRecording from './components/SpeechRecording';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
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
    <Router basename="/ayseverda/ieltsGo">
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/reading" element={
            <ProtectedRoute>
              <ReadingModule />
            </ProtectedRoute>
          } />
          <Route path="/writing" element={
            <ProtectedRoute>
              <WritingModule />
            </ProtectedRoute>
          } />
          <Route path="/listening" element={
            <ProtectedRoute>
              <ListeningModule />
            </ProtectedRoute>
          } />
          <Route path="/speaking" element={
            <ProtectedRoute>
              <SpeakingModule />
            </ProtectedRoute>
          } />
          <Route path="/speech-recording" element={<SpeechRecording />} />
        </Routes>

        <button className="theme-toggle" onClick={toggleTheme} aria-label="Tema değiştir">
          {theme === 'dark' ? '🌙 dark' : '☀️ light'}
        </button>
      </div>
    </Router>
  );
}

export default App;
