import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinGame, getGameState, getRoster } from '../api';
import RulesContent from '../RulesContent';

// Seed the team picker with known leaf teams so the first players have options
// to choose from. Anyone not on these teams can still type their own.
const KNOWN_TEAMS = ['Maps', 'Ontology', 'Graph'];

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
  const [teamNames, setTeamNames] = useState(KNOWN_TEAMS);
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

  // While on the entry screen, keep a fresh list of distinct team names that
  // others have already entered, so players can pick one (avoids typos /
  // near-duplicate team names) or type their own.
  useEffect(() => {
    if (joined) return;
    let active = true;
    const fetchTeams = async () => {
      try {
        const data = await getRoster();
        if (!active) return;
        const names = Array.from(
          new Set([
            ...KNOWN_TEAMS,
            ...(data.roster || []).map((r) => (r.teamName || '').trim()).filter(Boolean),
          ])
        ).sort((a, b) => a.localeCompare(b));
        setTeamNames(names);
      } catch (e) {
        // ignore — list stays as-is
      }
    };
    fetchTeams();
    const interval = setInterval(fetchTeams, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [joined]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!alias.trim() || !displayName.trim() || !teamName.trim()) {
      setError('Please enter your alias, display name, and team name');
      return;
    }

    const ok = window.confirm(
      `Join as:\n\n` +
      `  Alias: ${alias.trim().toLowerCase()}\n` +
      `  Name: ${displayName.trim()}\n` +
      `  Team: ${teamName.trim()}\n\n` +
      `You won't be able to change these after joining. Continue?`
    );
    if (!ok) return;

    setLoading(true);
    setError('');

    // Join with one automatic retry — the first request to a cold function
    // instance can fail transiently while it warms up. Retrying is safe because
    // the backend treats a duplicate/idempotent join gracefully.
    const attemptJoin = async () => {
      const result = await joinGame(alias.trim(), displayName.trim(), teamName.trim());
      if (result.error) throw new Error(result.error);
      return result;
    };

    try {
      let result;
      try {
        result = await attemptJoin();
      } catch (firstErr) {
        await new Promise((r) => setTimeout(r, 800));
        result = await attemptJoin(); // surfaces error if this also fails
      }

      localStorage.setItem('bingo_alias', alias.trim().toLowerCase());
      localStorage.setItem('bingo_name', displayName.trim());
      localStorage.setItem('bingo_team', teamName.trim());
      setJoined(true);

      if (result.gameState === 'active') {
        navigate('/play');
      }
    } catch (e) {
      setError(e.message || 'Failed to join. Please try again.');
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

          <button
            type="button"
            className="btn"
            style={{ marginTop: '1rem', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)' }}
            onClick={() => setShowRules(!showRules)}
          >
            {showRules ? '▲ Hide Rules' : '📋 How to Play & Prizes'}
          </button>

          {showRules && (
            <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
              <RulesContent />
            </div>
          )}
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
            Microsoft Alias <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            className="input"
            type="text"
            placeholder="e.g., skamma"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />

          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Display Name <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            className="input"
            type="text"
            placeholder="e.g., Subbarayudu Kamma"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <label style={{ display: 'block', marginBottom: '0.1rem', fontWeight: 500 }}>
            Team Name <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            (your leaf team — the small group you attend daily standup with, not a broad org)
          </div>
          <input
            className="input"
            type="text"
            placeholder="Pick an existing team below or type your own"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            autoComplete="off"
          />
          {teamNames.length > 0 && (() => {
            const trimmed = teamName.trim().toLowerCase();
            const matches = teamNames.filter((t) => t.toLowerCase().includes(trimmed));
            const exact = teamNames.some((t) => t.toLowerCase() === trimmed);
            return (
              <div style={{ margin: '-0.25rem 0 0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  {matches.length > 0 ? 'Tap a team to pick it:' : 'Existing teams:'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {(matches.length > 0 ? matches : teamNames).map((t) => {
                    const selected = t.toLowerCase() === trimmed;
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setTeamName(t)}
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          cursor: 'pointer',
                          border: selected ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: selected ? 'var(--primary)' : 'transparent',
                          color: selected ? '#fff' : 'var(--text)',
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                {trimmed && !exact && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                    Starting a new team: “{teamName.trim()}”
                  </div>
                )}
              </div>
            );
          })()}

          {error && (
            <p style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              {error}
            </p>
          )}

          <div style={{
            marginBottom: '0.75rem', padding: '0.6rem 0.75rem',
            background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px',
          }}>
            <p style={{ fontSize: '0.8rem', color: '#92400e', margin: 0 }}>
              ⚠️ Please double-check your details — <strong>you can't change them after joining</strong>. Your name is how teammates will find you in the game.
            </p>
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !alias.trim() || !displayName.trim() || !teamName.trim()}
          >
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
          <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
            <RulesContent />
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
