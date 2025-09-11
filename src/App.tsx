import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import ReadingModule from './components/ReadingModule';
import WritingModule from './components/WritingModule';
import ListeningModule from './components/ListeningModule';
import SpeakingModule from './components/SpeakingModule';
import './App.css';

function App() {
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
      </div>
    </Router>
  );
}

export default App;
