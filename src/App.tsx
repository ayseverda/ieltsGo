import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
      </div>
    </Router>
  );
}

export default App;
