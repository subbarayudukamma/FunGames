import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import PlayerEntry from './pages/PlayerEntry';
import Play from './pages/Play';
import Admin from './pages/Admin';
import { hasPlayroom } from './api';
import './App.css';

function App() {
  const [playroomValid, setPlayroomValid] = useState(false);

  useEffect(() => {
    // Check URL params first, then localStorage
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('playroom');
    if (fromUrl) {
      localStorage.setItem('bingo_playroom', fromUrl);
      setPlayroomValid(true);
    } else if (localStorage.getItem('bingo_playroom')) {
      setPlayroomValid(true);
    }
  }, []);

  if (!playroomValid) {
    return (
      <div className="app-container" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <h1>🎯 Icebreaker Bingo</h1>
        <p style={{ fontSize: '1.2rem', marginTop: '1.5rem', color: '#888' }}>
          Access denied. Please use the QR code or link provided by your event organizer.
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlayerEntry />} />
        <Route path="/play" element={<Play />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
