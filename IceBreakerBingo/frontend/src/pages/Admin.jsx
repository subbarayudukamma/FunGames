import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  adminGetPlayers,
  adminGetDashboard,
  adminGetQuestions,
  adminSaveQuestions,
  adminRelease,
  adminReset,
  adminClaimWin,
  adminUnclaimWin,
  adminGetWinQueue,
  adminDismissQueueItem,
  adminExport,
  adminSetMode,
  adminCloseGame,
  adminDrawRaffle,
  adminResetRaffle,
  adminAddRaffleEntries,
  adminClaimSession,
  adminGetSession,
  getGameState,
} from '../api';

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [adminKey, setAdminKey] = useState(searchParams.get('key') || '');
  const [keyInput, setKeyInput] = useState('');
  const [adminName, setAdminName] = useState(() => sessionStorage.getItem('adminName') || '');
  const [adminNameInput, setAdminNameInput] = useState('');
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem('adminSessionId');
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem('adminSessionId', id);
    return id;
  });
  const [isActiveAdmin, setIsActiveAdmin] = useState(false);
  const [lockedOutBy, setLockedOutBy] = useState(null);
  const [adminNames, setAdminNames] = useState([]);
  const [activeTab, setActiveTab] = useState('lobby');
  const [players, setPlayers] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [importText, setImportText] = useState('');
  const [gameState, setGameState] = useState('lobby');
  const [playerCount, setPlayerCount] = useState(0);
  const [claimedWins, setClaimedWins] = useState({});
  const [winQueue, setWinQueue] = useState([]);
  const [gameMode, setGameMode] = useState('raffle');
  const [raffleResults, setRaffleResults] = useState([]);
  const [lastDrawn, setLastDrawn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [extraEntryCount, setExtraEntryCount] = useState(1);
  const [extraEntryPlayers, setExtraEntryPlayers] = useState([]);
  const [extraEntrySearch, setExtraEntrySearch] = useState('');

  const fetchData = useCallback(async () => {
    if (!adminKey || !adminName) return;

    // Check session status
    try {
      const sessionData = await adminGetSession(adminKey, sessionId);
      setAdminNames(sessionData.adminNames || []);
      if (sessionData.activeAdmin && sessionData.activeAdmin.sessionId !== sessionId) {
        setIsActiveAdmin(false);
        setLockedOutBy(sessionData.activeAdmin.name);
        return; // Don't fetch other data if locked out
      } else {
        setIsActiveAdmin(true);
        setLockedOutBy(null);
      }
    } catch (e) {
      // continue
    }

    try {
      const state = await getGameState();
      setGameState(state.gameState);
      setPlayerCount(state.playerCount);
      setClaimedWins(state.claimedWins || {});
      setGameMode(state.gameMode || 'raffle');
      setRaffleResults(state.raffleResults || []);

      if (activeTab === 'lobby') {
        const data = await adminGetPlayers(adminKey);
        if (data.players) setPlayers(data.players);
      } else if (activeTab === 'leaderboard') {
        const data = await adminGetDashboard(adminKey);
        if (data.leaderboard) setDashboard(data);
      } else if (activeTab === 'questions') {
        const data = await adminGetQuestions(adminKey);
        if (data.questions) setQuestions(data.questions);
      }

      // Always fetch players for extra raffle entries dropdown
      if (activeTab !== 'lobby' && state.gameMode === 'raffle' && (state.gameState === 'active' || state.gameState === 'closed')) {
        const data = await adminGetPlayers(adminKey);
        if (data.players) setPlayers(data.players);
      }

      // Always fetch win queue when game is active
      if (state.gameState === 'active') {
        const queueData = await adminGetWinQueue(adminKey);
        setWinQueue(queueData.winQueue || []);
      }
    } catch (e) {
      // retry
    }
  }, [adminKey, adminName, activeTab, sessionId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Re-claim session on page load if name was previously set (e.g. refresh)
  useEffect(() => {
    if (adminKey && adminName) {
      adminClaimSession(adminKey, adminName, sessionId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRelease = async () => {
    if (!window.confirm('Release bingo cards to all players?')) return;
    setLoading(true);
    const result = await adminRelease(adminKey);
    setMessage(result.message || result.error);
    setLoading(false);
    fetchData();
  };

  const handleReset = async () => {
    if (!window.confirm('Reset the entire game? This will delete all players and progress!')) return;
    setLoading(true);
    const result = await adminReset(adminKey);
    setMessage(result.message || result.error);
    setLoading(false);
    fetchData();
  };

  const handleSetMode = async (mode) => {
    setLoading(true);
    const result = await adminSetMode(adminKey, mode);
    setMessage(result.message || result.error);
    setLoading(false);
    fetchData();
  };

  const handleCloseGame = async () => {
    if (!window.confirm('Close the game? Players will no longer be able to submit answers. Ready for raffle draw!')) return;
    setLoading(true);
    const result = await adminCloseGame(adminKey);
    setMessage(result.message || result.error);
    setLoading(false);
    fetchData();
  };

  const handleDrawRaffle = async () => {
    setLoading(true);
    setLastDrawn(null);
    const result = await adminDrawRaffle(adminKey);
    if (result.error) {
      setMessage(result.error);
    } else {
      setLastDrawn(result);
      setMessage(`🎉 Winner #${result.drawNumber}: ${result.displayName} (${result.entries} entries)`);
    }
    setLoading(false);
    fetchData();
  };

  const handleResetRaffle = async () => {
    if (!window.confirm('Clear all raffle results? You can re-draw after this.')) return;
    setLoading(true);
    const result = await adminResetRaffle(adminKey);
    setMessage(result.message || result.error);
    setLastDrawn(null);
    setLoading(false);
    fetchData();
  };

  const handleAddExtraEntries = async () => {
    if (extraEntryPlayers.length === 0) {
      setMessage('Select at least one player to add entries');
      return;
    }
    setLoading(true);
    const result = await adminAddRaffleEntries(adminKey, extraEntryCount, extraEntryPlayers.map(p => p.alias));
    setMessage(result.message || result.error);
    setExtraEntryPlayers([]);
    setExtraEntrySearch('');
    setLoading(false);
    fetchData();
  };

  const handleAddQuestion = () => {
    if (!newQuestion.trim()) return;
    setQuestions([...questions, { id: `q${questions.length + 1}`, text: newQuestion.trim() }]);
    setNewQuestion('');
  };

  const handleDeleteQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSaveQuestions = async () => {
    setLoading(true);
    const result = await adminSaveQuestions(adminKey, questions);
    setMessage(result.message || result.error);
    setLoading(false);
  };

  const handleClaimWin = async (category, winner) => {
    setLoading(true);
    const result = await adminClaimWin(adminKey, category, winner);
    setMessage(result.message || result.error);
    setLoading(false);
    fetchData();
  };

  const handleUnclaimWin = async (category) => {
    setLoading(true);
    const result = await adminUnclaimWin(adminKey, category);
    setMessage(result.message || result.error);
    setLoading(false);
    fetchData();
  };

  const handleDismiss = async (category, player) => {
    setLoading(true);
    await adminDismissQueueItem(adminKey, category, player);
    setLoading(false);
    fetchData();
  };

  const formatCategory = (cat) => {
    if (cat === 'first5') return '🎯 First 5';
    if (cat === 'blackout') return '🏆 Blackout';
    if (cat.startsWith('row-')) return `➡️ Row ${parseInt(cat.split('-')[1]) + 1}`;
    if (cat.startsWith('col-')) return `⬇️ Col ${parseInt(cat.split('-')[1]) + 1}`;
    if (cat.startsWith('diag-')) return `↗️ Diagonal ${parseInt(cat.split('-')[1]) + 1}`;
    return cat;
  };

  const handleKeySubmit = (e) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    const newKey = keyInput.trim();
    setAdminKey(newKey);
    setSearchParams((prev) => {
      prev.set('key', newKey);
      return prev;
    });
  };

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    if (!adminNameInput.trim()) return;
    const name = adminNameInput.trim();
    setAdminName(name);
    sessionStorage.setItem('adminName', name);
    // Claim session immediately
    await adminClaimSession(adminKey, name, sessionId);
    setIsActiveAdmin(true);
    setLockedOutBy(null);
  };

  const handleReclaimSession = async () => {
    await adminClaimSession(adminKey, adminName, sessionId);
    setIsActiveAdmin(true);
    setLockedOutBy(null);
    fetchData();
  };

  if (!adminKey) {
    return (
      <div className="container">
        <div className="header">
          <h1>🔐 Admin Access Required</h1>
          <p>Enter your admin key to continue</p>
        </div>
        <form onSubmit={handleKeySubmit} style={{ maxWidth: '400px', margin: '1.5rem auto' }}>
          <input
            className="input"
            type="password"
            placeholder="Enter admin key..."
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary" type="submit" style={{ marginTop: '0.5rem' }}>
            🔓 Access Admin Panel
          </button>
        </form>
      </div>
    );
  }

  if (!adminName) {
    return (
      <div className="container">
        <div className="header">
          <h1>🎯 Bingo Admin</h1>
          <p>Enter your name to continue</p>
        </div>
        <form onSubmit={handleNameSubmit} style={{ maxWidth: '400px', margin: '1.5rem auto' }}>
          <input
            className="input"
            type="text"
            placeholder="Your name (e.g., Subba)"
            value={adminNameInput}
            onChange={(e) => setAdminNameInput(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary" type="submit" style={{ marginTop: '0.5rem' }}>
            ▶️ Start Admin Session
          </button>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center' }}>
            Only one admin can be active at a time. Starting a session will take control from any other active admin.
          </p>
        </form>
      </div>
    );
  }

  if (lockedOutBy) {
    return (
      <div className="container">
        <div className="header">
          <h1>🎯 Bingo Admin</h1>
        </div>
        <div className="card" style={{ textAlign: 'center', background: '#fef2f2', border: '1px solid #fca5a5' }}>
          <h2 style={{ color: '#dc2626' }}>⚠️ Session Taken Over</h2>
          <p style={{ marginTop: '0.75rem', fontSize: '1rem' }}>
            <strong>{lockedOutBy}</strong> is now the active admin.
          </p>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Auto-refresh has been stopped. You cannot make changes while another admin is active.
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: '1rem', width: 'auto' }}
            onClick={handleReclaimSession}
          >
            🔁 Take Back Control
          </button>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            This will notify the other admin that you've taken over.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-wide">
      <div className="header">
        <h1>🎯 Bingo Admin</h1>
        <p>
          Game Status: <span className={`status-${gameState}`}><strong>{gameState.toUpperCase()}</strong></span>
          {' | '}
          Mode: <strong>{gameMode === 'raffle' ? '🎟️ Raffle' : '🏆 Classic'}</strong>
          {' | '}
          Players: <strong>{playerCount}</strong>
          {' | '}
          Admin: <strong>{adminName}</strong>
          {adminNames.length > 1 && <span style={{ color: '#f59e0b' }}> (Online: {adminNames.join(', ')})</span>}
        </p>
      </div>

      {message && (
        <div className="card" style={{ background: '#d1fae5', textAlign: 'center' }}>
          {message}
          <button onClick={() => setMessage('')} style={{ marginLeft: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Game Mode Selector - visible in lobby */}
      {gameState === 'lobby' && (
        <div className="card">
          <h2>🎮 Game Mode</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Choose how winners are determined. This cannot be changed after releasing cards.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn ${gameMode === 'classic' ? 'btn-primary' : ''}`}
              style={{ flex: 1 }}
              onClick={() => handleSetMode('classic')}
              disabled={loading || gameMode === 'classic'}
            >
              🏆 Classic Bingo
              <br /><small style={{ fontWeight: 'normal' }}>Rows, columns, diagonals win</small>
            </button>
            <button
              className={`btn ${gameMode === 'raffle' ? 'btn-primary' : ''}`}
              style={{ flex: 1 }}
              onClick={() => handleSetMode('raffle')}
              disabled={loading || gameMode === 'raffle'}
            >
              🎟️ Raffle Bingo
              <br /><small style={{ fontWeight: 'normal' }}>Each box = 1 raffle entry</small>
            </button>
          </div>
        </div>
      )}

      {/* Game Controls */}
      <div className="card" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className="btn btn-success"
          style={{ flex: 1, minWidth: '120px' }}
          onClick={handleRelease}
          disabled={loading || gameState === 'active' || gameState === 'closed'}
        >
          🚀 Release Bingo
        </button>
        {gameMode === 'raffle' && gameState === 'active' && (
          <button
            className="btn btn-warning"
            style={{ flex: 1, minWidth: '120px' }}
            onClick={handleCloseGame}
            disabled={loading}
          >
            🔒 Close Game
          </button>
        )}
        <button
          className="btn btn-danger"
          style={{ flex: 0, minWidth: '80px', fontSize: '0.75rem', padding: '4px 10px' }}
          onClick={handleReset}
          disabled={loading}
        >
          🔄 Reset
        </button>
        <button
          className="btn"
          style={{ flex: 1, minWidth: '120px', background: '#6366f1', color: 'white' }}
          onClick={async () => {
            const data = await adminExport(adminKey);
            if (data.error) { setMessage(data.error); return; }
            const now = new Date();
            const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`;
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `bingo-export_${ts}.json`;
            link.click();
            URL.revokeObjectURL(url);
            setMessage('Export downloaded!');
          }}
          disabled={loading}
        >
          📥 Export Game
        </button>
      </div>

      {/* Win Notification Queue - visible when game is active AND classic mode */}
      {gameState === 'active' && gameMode === 'classic' && (
        <div className="card">
          <h2>🔔 Verification Queue {winQueue.length > 0 && <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>{winQueue.length} pending</span>}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Players who completed a line appear here. Verify in person, then claim to notify all players.
          </p>

          {winQueue.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No pending verifications.</p>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {winQueue.map((item, idx) => (
                <div key={`${item.category}-${item.player}-${idx}`} style={{
                  padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px',
                  marginBottom: '0.5rem', background: '#fffbeb',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{formatCategory(item.category)}</span>
                      <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}>
                        — {item.displayName} ({item.player})
                      </span>
                      <br />
                      <small style={{ color: 'var(--text-muted)' }}>
                        {new Date(item.completedAt).toLocaleTimeString()}
                      </small>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        className="btn btn-success"
                        style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => handleClaimWin(item.category, item.player)}
                        disabled={loading || claimedWins[item.category]}
                        title="Verify & Claim"
                      >
                        ✓ Claim
                      </button>
                      <button
                        className="btn"
                        style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'var(--border)' }}
                        onClick={() => handleDismiss(item.category, item.player)}
                        disabled={loading}
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {/* Player's answers for this winning line */}
                  {item.answers && item.answers.length > 0 && (
                    <details style={{ marginTop: '0.5rem' }}>
                      <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 500 }}>
                        View answers ({item.answers.filter(a => a.answer).length} cells)
                      </summary>
                      <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', background: '#fff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                        {item.answers.filter(a => a.answer).map((a, i) => (
                          <div key={i} style={{ marginBottom: '0.3rem', paddingBottom: '0.3rem', borderBottom: i < item.answers.filter(x => x.answer).length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Q: </span>{a.question}<br/>
                            <span style={{ color: 'var(--text-muted)' }}>A: </span><strong>{a.answer}</strong>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Claimed wins summary */}
          {Object.keys(claimedWins).length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>✅ Claimed Winners</h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {Object.entries(claimedWins).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                      {formatCategory(key)}: {val.winner}
                    </span>
                    <button
                      onClick={() => handleUnclaimWin(key)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.8rem' }}
                      title="Unclaim"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Raffle Draw Panel - visible when game is closed and raffle mode */}
      {gameState === 'closed' && gameMode === 'raffle' && (
        <div className="card">
          <h2>🎟️ Raffle Draw</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Game is closed! Each completed box gave players raffle entries. Draw winners one at a time.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              className="btn btn-success"
              style={{ flex: 1 }}
              onClick={handleDrawRaffle}
              disabled={loading}
            >
              🎰 Draw Next Winner
            </button>
            <button
              className="btn"
              style={{ width: 'auto', background: 'var(--border)' }}
              onClick={handleResetRaffle}
              disabled={loading || raffleResults.length === 0}
              title="Clear all draws and start over"
            >
              ↺ Reset Draws
            </button>
          </div>

          {/* Last drawn winner highlight */}
          {lastDrawn && (
            <div style={{
              padding: '1.25rem', marginBottom: '1rem', borderRadius: '12px',
              background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
              textAlign: 'center', border: '2px solid #f59e0b',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🎉</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{lastDrawn.displayName}</div>
              <div style={{ fontSize: '1rem', color: '#78350f', marginTop: '0.25rem' }}>@{lastDrawn.winner}</div>
              <div style={{ fontSize: '0.9rem', color: '#92400e', marginTop: '0.15rem' }}>{lastDrawn.teamName || 'No team'}</div>
              <div style={{ fontSize: '0.85rem', color: '#92400e', marginTop: '0.5rem' }}>
                Winner #{lastDrawn.drawNumber} • {lastDrawn.entries} entries out of {lastDrawn.totalPoolEntries} total
              </div>
              <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '0.25rem' }}>
                {lastDrawn.remainingPlayers} players remaining in pool
              </div>
            </div>
          )}

          {/* Raffle results log */}
          {raffleResults.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>🏆 Winners Log ({raffleResults.length})</h3>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Alias</th>
                    <th>Team</th>
                    <th>Entries</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {raffleResults.map((r, i) => (
                    <tr key={i}>
                      <td>{r.drawNumber || i + 1}</td>
                      <td><strong>{r.displayName}</strong></td>
                      <td>@{r.winner}</td>
                      <td>{r.teamName || '—'}</td>
                      <td>{r.entries}</td>
                      <td><small>{new Date(r.drawnAt).toLocaleTimeString()}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Raffle mode info when game is active */}
      {gameState === 'active' && gameMode === 'raffle' && (
        <div className="card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <h2>🎟️ Raffle Mode Active</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Players are collecting raffle entries by completing boxes. Each box = 1 entry into the weighted raffle.
            When ready, click <strong>Close Game</strong> to stop submissions and begin drawing winners.
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            💡 Everyone who joined gets at least 1 entry (free space).
          </p>
        </div>
      )}

      {/* Extra Raffle Entries - visible when raffle mode and game is active or closed */}
      {gameMode === 'raffle' && (gameState === 'active' || gameState === 'closed') && (
        <div className="card">
          <h2>🎁 Add Extra Raffle Entries</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Award bonus raffle entries to specific players (e.g., for participation prizes, challenges, etc.)
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' }}>Entries to add:</label>
            <input
              className="input"
              type="number"
              min="1"
              max="100"
              value={extraEntryCount}
              onChange={(e) => setExtraEntryCount(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '80px', marginBottom: 0 }}
            />
          </div>

          {/* Player search / selection */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <input
              className="input"
              style={{ marginBottom: 0 }}
              placeholder="Search players by name or alias..."
              value={extraEntrySearch}
              onChange={(e) => setExtraEntrySearch(e.target.value)}
            />
            {extraEntrySearch.trim() && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: 'white', border: '1px solid var(--border)', borderRadius: '8px',
                maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}>
                {players
                  .filter(p =>
                    !extraEntryPlayers.find(ep => ep.alias === p.alias) &&
                    (p.displayName.toLowerCase().includes(extraEntrySearch.toLowerCase()) ||
                     p.alias.toLowerCase().includes(extraEntrySearch.toLowerCase()))
                  )
                  .map(p => (
                    <div
                      key={p.alias}
                      style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                      onClick={() => {
                        setExtraEntryPlayers([...extraEntryPlayers, p]);
                        setExtraEntrySearch('');
                      }}
                    >
                      <strong>{p.displayName}</strong> <span style={{ color: 'var(--text-muted)' }}>@{p.alias}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {/* Selected players as chips */}
          {extraEntryPlayers.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {extraEntryPlayers.map(p => (
                <span key={p.alias} style={{
                  background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: '16px',
                  padding: '0.25rem 0.6rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                }}>
                  {p.displayName}
                  <button
                    onClick={() => setExtraEntryPlayers(extraEntryPlayers.filter(ep => ep.alias !== p.alias))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', fontWeight: 700, fontSize: '0.85rem' }}
                  >×</button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-primary"
              style={{ width: 'auto' }}
              onClick={handleAddExtraEntries}
              disabled={loading || extraEntryPlayers.length === 0}
            >
              ➕ Add {extraEntryCount} {extraEntryCount === 1 ? 'Entry' : 'Entries'} to {extraEntryPlayers.length} {extraEntryPlayers.length === 1 ? 'Player' : 'Players'}
            </button>
            {extraEntryPlayers.length > 0 && (
              <button
                className="btn"
                style={{ width: 'auto', background: 'var(--border)' }}
                onClick={() => { setExtraEntryPlayers([]); setExtraEntrySearch(''); }}
              >
                Clear Selection
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {['lobby', 'questions', 'leaderboard'].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'lobby' && '👥 Lobby'}
            {tab === 'questions' && '❓ Questions'}
            {tab === 'leaderboard' && '🏆 Leaderboard'}
          </button>
        ))}
      </div>

      {/* Lobby Tab */}
      {activeTab === 'lobby' && (
        <div className="card">
          <h2>Players in Lobby ({players.length})</h2>
          {players.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No players have joined yet.</p>
          ) : (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Alias</th>
                  <th>Name</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.alias}>
                    <td>{p.alias}</td>
                    <td>{p.displayName}</td>
                    <td>{new Date(p.joinedAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div className="card">
          <h2>Bingo Questions ({questions.length}/25+)</h2>
          <p style={{ color: questions.length >= 24 ? 'var(--success)' : 'var(--danger)', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {questions.length >= 24 ? '✓ Enough questions!' : `Need at least 24 questions (have ${questions.length})`}
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              className="input"
              style={{ marginBottom: 0 }}
              placeholder="Add a new question..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
            />
            <button className="btn btn-primary" style={{ width: 'auto', whiteSpace: 'nowrap' }} onClick={handleAddQuestion}>
              + Add
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              className="btn btn-warning"
              style={{ width: 'auto', fontSize: '0.85rem' }}
              onClick={() => {
                const generated = Array.from({ length: 30 }, (_, i) => ({
                  id: `q${i + 1}`,
                  text: `Random${i + 1}`,
                }));
                setQuestions(generated);
              }}
            >
              🎲 Generate 30 Random Questions
            </button>
          </div>

          {/* Import from file or paste */}
          <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px dashed var(--border)', borderRadius: '0.5rem' }}>
            <p style={{ fontWeight: 500, marginBottom: '0.5rem', fontSize: '0.9rem' }}>📥 Import Questions (one per line)</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="file"
                accept=".txt"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (ev) => {
                    const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean);
                    const imported = lines.map((text, i) => ({ id: `imp${i + 1}`, text }));
                    setQuestions(imported);
                    setLoading(true);
                    const result = await adminSaveQuestions(adminKey, imported);
                    setMessage(result.message || result.error || `Imported & saved ${imported.length} questions from file`);
                    setLoading(false);
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
                style={{ fontSize: '0.85rem' }}
              />
            </div>
            <textarea
              className="input"
              style={{ minHeight: '80px', marginBottom: '0.5rem' }}
              placeholder="Or paste questions here (one per line)..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <button
              className="btn"
              style={{ width: 'auto', fontSize: '0.85rem', background: 'var(--primary)', color: 'white' }}
              onClick={async () => {
                const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length === 0) return;
                const imported = lines.map((text, i) => ({ id: `imp${i + 1}`, text }));
                setQuestions(imported);
                setImportText('');
                setLoading(true);
                const result = await adminSaveQuestions(adminKey, imported);
                setMessage(result.message || result.error || `Imported & saved ${imported.length} questions`);
                setLoading(false);
              }}
            >
              📋 Import from Paste
            </button>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {questions.map((q, i) => (
              <div className="question-item" key={q.id || i}>
                <span style={{ color: 'var(--text-muted)', minWidth: '30px' }}>{i + 1}.</span>
                <input
                  value={q.text}
                  onChange={(e) => {
                    const updated = [...questions];
                    updated[i] = { ...updated[i], text: e.target.value };
                    setQuestions(updated);
                  }}
                />
                <button onClick={() => handleDeleteQuestion(i)}>✕</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleSaveQuestions}
              disabled={loading}
            >
              💾 Save Questions
            </button>
            <button
              className="btn"
              style={{ background: 'var(--danger)', color: 'white' }}
              onClick={async () => {
                if (!window.confirm('Clear ALL questions?')) return;
                setQuestions([]);
                setLoading(true);
                const result = await adminSaveQuestions(adminKey, []);
                setMessage(result.message || 'All questions cleared');
                setLoading(false);
              }}
              disabled={loading}
            >
              🗑️ Clear All
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && dashboard && (
        <div className="card">
          <h2>Leaderboard</h2>

          {dashboard.blackoutCompleters?.length > 0 && (
            <div style={{ marginBottom: '1rem', padding: '0.5rem', background: '#fef3c7', borderRadius: '8px' }}>
              🏆 <strong>BLACKOUT:</strong> {dashboard.blackoutCompleters.map(p => p.displayName).join(', ')}
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Done</th>
                  {gameMode === 'raffle' && <th>Bingo Entries</th>}
                  {gameMode === 'raffle' && <th>Extra</th>}
                  {gameMode === 'raffle' && <th>Total Entries</th>}
                  <th>Row</th>
                  <th>Col</th>
                  <th>Diag</th>
                  <th>Blackout</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.leaderboard?.map((p, i) => (
                  <tr key={p.alias}>
                    <td>{i + 1}</td>
                    <td><strong>{p.displayName}</strong><br/><small>{p.alias}</small></td>
                    <td>{p.completedCount}/25</td>
                    {gameMode === 'raffle' && <td>{p.completedCount || 1}</td>}
                    {gameMode === 'raffle' && <td>{p.extraRaffleEntries || 0}</td>}
                    {gameMode === 'raffle' && <td><strong>{(p.completedCount || 1) + (p.extraRaffleEntries || 0)}</strong></td>}
                    <td>{p.hasRow ? <span className="badge badge-success">✓</span> : '—'}</td>
                    <td>{p.hasColumn ? <span className="badge badge-success">✓</span> : '—'}</td>
                    <td>{p.hasDiagonal ? <span className="badge badge-success">✓</span> : '—'}</td>
                    <td>{p.hasBlackout ? <span className="badge badge-warning">🏆</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Quick Stats</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              🎯 First 5 done: {dashboard.first5Done?.length || 0} players<br/>
              ➡️ Row completers: {dashboard.rowCompleters?.length || 0}<br/>
              ⬇️ Column completers: {dashboard.columnCompleters?.length || 0}<br/>
              ↗️ Diagonal completers: {dashboard.diagonalCompleters?.length || 0}<br/>
              🏆 Blackout: {dashboard.blackoutCompleters?.length || 0}
            </p>
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>📤 Export Data</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Download all players' answers so they can stay in touch with the people they met.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: 'auto', fontSize: '0.85rem' }}
              onClick={async () => {
                const data = await adminExport(adminKey);
                if (data.error) { setMessage(data.error); return; }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `bingo-export-${new Date().toISOString().slice(0,10)}.json`;
                link.click();
                URL.revokeObjectURL(url);
                setMessage('Export downloaded!');
              }}
            >
              📥 Export as JSON
            </button>
          </div>
        </div>
      )}

      {/* Refresh button */}
      <button className="refresh-btn" onClick={fetchData} title="Refresh">
        🔄
      </button>
    </div>
  );
}
