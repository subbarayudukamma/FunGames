import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinGame, getGameState } from '../api';

export default function PlayerEntry() {
  const [alias, setAlias] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [joined, setJoined] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const navigate = useNavigate();

  // Check if player already joined (from localStorage)
  useEffect(() => {
    const savedAlias = localStorage.getItem('bingo_alias');
    const savedName = localStorage.getItem('bingo_name');
    if (savedAlias && savedName) {
      setAlias(savedAlias);
      setDisplayName(savedName);
      setTeamName(localStorage.getItem('bingo_team') || '');
      setJoined(true);
    }
  }, []);

  // Poll game state
  useEffect(() => {
    const fetchState = async () => {
      try {
        const data = await getGameState();
        setGameState(data.gameState);
        setPlayerCount(data.playerCount);

        if (data.gameState === 'active' && joined) {
          navigate('/play');
        }

        // If game was reset while player was in lobby, clear their session
        if (data.gameState === 'lobby' && joined && data.playerCount === 0) {
          localStorage.removeItem('bingo_alias');
          localStorage.removeItem('bingo_name');
          localStorage.removeItem('bingo_team');
          setJoined(false);
          setAlias('');
          setDisplayName('');
          setTeamName('');
        }

        // If game was closed/ended, clear joined state so player sees the waiting screen
        if (data.gameState === 'closed' && joined) {
          // Keep localStorage but show closed message
        }
      } catch (e) {
        // API not available yet
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, [joined, navigate]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!alias.trim() || !displayName.trim()) {
      setError('Please enter both alias and display name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await joinGame(alias.trim(), displayName.trim(), teamName.trim());
      if (result.error) {
        setError(result.error);
      } else {
        localStorage.setItem('bingo_alias', alias.trim().toLowerCase());
        localStorage.setItem('bingo_name', displayName.trim());
        localStorage.setItem('bingo_team', teamName.trim());
        setJoined(true);

        if (result.gameState === 'active') {
          navigate('/play');
        }
      }
    } catch (e) {
      setError('Failed to join. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show closed state - game is not accepting new players
  if (gameState === 'closed') {
    return (
      <div className="container">
        <div className="header">
          <h1>🎯 Icebreaker Bingo</h1>
          <p>Team bonding, one square at a time!</p>
        </div>
        <div className="card waiting">
          <h2>🔒 Game is currently closed</h2>
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
            The current round has ended. Please wait for the admin to start a new round.
          </p>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            This page will automatically update when a new game begins.
          </p>
        </div>
      </div>
    );
  }

  if (joined && gameState !== 'active') {
    return (
      <div className="container">
        <div className="header">
          <h1>🎯 Icebreaker Bingo</h1>
          <p>Team bonding, one square at a time!</p>
        </div>
        <div className="card waiting">
          <h2 className="pulse">⏳ Waiting for admin to start the game...</h2>
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
            <strong>{playerCount}</strong> players in lobby
          </p>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Joined as <strong>{displayName}</strong> ({alias})
          </p>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            You'll be taken to your bingo card automatically when the game starts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>🎯 Icebreaker Bingo</h1>
        <p>Team bonding, one square at a time!</p>
      </div>

      <div className="card">
        <form onSubmit={handleJoin}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Microsoft Alias
          </label>
          <input
            className="input"
            type="text"
            placeholder="e.g., skamma"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />

          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Display Name
          </label>
          <input
            className="input"
            type="text"
            placeholder="e.g., Subbarayudu Kamma"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Team Name
          </label>
          <input
            className="input"
            type="text"
            placeholder="e.g., Azure Compute"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />

          {error && (
            <p style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              {error}
            </p>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Joining...' : '🎮 Join Game'}
          </button>

          <button
            type="button"
            className="btn"
            style={{ marginTop: '0.5rem', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)' }}
            onClick={() => setShowRules(!showRules)}
          >
            {showRules ? '▲ Hide Rules' : '📋 How to Play & Prizes'}
          </button>
        </form>

        {showRules && (
          <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>🎯 How It Works</h3>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.7', fontSize: '0.9rem', margin: '0 0 1rem' }}>
              <li>Each tile = a prompt that encourages you to interact with someone</li>
              <li>Your answers are the <strong>people you meet and talk to</strong></li>
              <li><strong>Twist:</strong> Your answers can't be from your own team — expand your people graph! 🙂</li>
            </ul>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', fontStyle: 'italic' }}>
              💡 Don't worry if you don't remember all the names you entered. We'll connect you with the people in your answers via email after the game.
            </p>

            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>🎁 Raffle & Prizes</h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>We'll wrap up with a raffle — <strong>10 winners</strong> in total!</p>

            <p style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.25rem' }}>How entries work:</p>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.7', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>
              <li>✅ Log into the app → <strong>1 raffle entry</strong></li>
              <li>✅ Each bingo tile you complete → <strong>+1 entry</strong></li>
              <li>✅ Form table groups by completing the puzzle from the entrance → <strong>bonus entries</strong></li>
            </ul>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              The more people you connect with, the better your odds! 🎉
            </p>

            <p style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.25rem' }}>What can be won?</p>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.7', fontSize: '0.9rem', margin: '0' }}>
              <li>🎁 6 Gift cards</li>
              <li>🍽️ 4 opportunities for a 1:1 lunch with:</li>
              <ul style={{ paddingLeft: '1.25rem', listStyle: 'none' }}>
                <li>• Raja</li>
                <li>• Tessa</li>
                <li>• Alexei</li>
                <li>• Kati</li>
              </ul>
            </ul>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              🏆 Winners will be chosen in order of the draw.
            </p>
          </div>
        )}
      </div>

      {playerCount > 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          {playerCount} players already in lobby
        </p>
      )}
    </div>
  );
}
