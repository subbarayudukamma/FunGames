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
        </form>
      </div>

      {playerCount > 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          {playerCount} players already in lobby
        </p>
      )}
    </div>
  );
}
