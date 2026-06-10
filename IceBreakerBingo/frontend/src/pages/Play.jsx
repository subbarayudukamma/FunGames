import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyCard, submitAnswer, getGameState, getRoster } from '../api';

const ROWS = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24]];
const COLS = [[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24]];
const DIAGS = [[0,6,12,18,24],[4,8,12,16,20]];

export default function Play() {
  const [card, setCard] = useState([]);
  const [playerData, setPlayerData] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState('active');
  const [roster, setRoster] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();

  const alias = localStorage.getItem('bingo_alias');

  const fetchCard = useCallback(async () => {
    if (!alias) {
      navigate('/');
      return;
    }
    try {
      const data = await getMyCard(alias);
      if (data.error) {
        // Player not found — game was likely reset
        localStorage.removeItem('bingo_alias');
        localStorage.removeItem('bingo_name');
        localStorage.removeItem('bingo_team');
        navigate('/');
        return;
      }
      setCard(data.card || []);
      setPlayerData(data);
      setGameState(data.gameState);
    } catch (e) {
      // retry on next poll
    }
  }, [alias, navigate]);

  useEffect(() => {
    fetchCard();
    const interval = setInterval(fetchCard, 5000);
    return () => clearInterval(interval);
  }, [fetchCard]);

  // Fetch roster for autocomplete
  useEffect(() => {
    getRoster().then(data => {
      if (data.roster) setRoster(data.roster);
    }).catch(() => {});
  }, []);

  const handleAnswerChange = (value) => {
    setAnswer(value);
    if (value.trim().length > 0) {
      const lower = value.toLowerCase();
      const matches = roster.filter(r =>
        r.displayName.toLowerCase().includes(lower) ||
        (r.teamName && r.teamName.toLowerCase().includes(lower))
      ).slice(0, 8);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (name) => {
    setAnswer(name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      const result = await submitAnswer(alias, selectedCell.questionId, answer.trim());
      if (result.error) {
        setError(result.error);
      } else {
        setSelectedCell(null);
        setAnswer('');
        fetchCard();
      }
    } catch (e) {
      setError('Failed to submit. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCellHighlight = (position) => {
    if (!playerData) return '';
    const classes = new Set();
    const completedRows = playerData.completedRows || [];
    const completedColumns = playerData.completedColumns || [];
    const completedDiagonals = playerData.completedDiagonals || [];
    const claimed = playerData.claimedWins || {};

    // Highlight cells in completed rows — red if that specific row is claimed
    for (const rowIdx of completedRows) {
      if (ROWS[rowIdx] && ROWS[rowIdx].includes(position)) {
        classes.add(claimed[`row-${rowIdx}`] ? 'line-claimed' : 'line-complete');
      }
    }
    for (const colIdx of completedColumns) {
      if (COLS[colIdx] && COLS[colIdx].includes(position)) {
        classes.add(claimed[`col-${colIdx}`] ? 'line-claimed' : 'line-complete');
      }
    }
    for (const diagIdx of completedDiagonals) {
      if (DIAGS[diagIdx] && DIAGS[diagIdx].includes(position)) {
        classes.add(claimed[`diag-${diagIdx}`] ? 'line-claimed' : 'line-complete');
      }
    }
    return [...classes].join(' ');
  };

  const claimedWins = playerData?.claimedWins || {};

  const formatCategory = (cat) => {
    if (cat === 'first5') return '🎯 First 5';
    if (cat === 'blackout') return '🏆 Blackout';
    if (cat.startsWith('row-')) return `➡️ Row ${parseInt(cat.split('-')[1]) + 1}`;
    if (cat.startsWith('col-')) return `⬇️ Col ${parseInt(cat.split('-')[1]) + 1}`;
    if (cat.startsWith('diag-')) return `↗️ Diagonal ${parseInt(cat.split('-')[1]) + 1}`;
    return cat;
  };

  if (gameState === 'lobby') {
    return (
      <div className="container">
        <div className="header">
          <h1>🎯 Icebreaker Bingo</h1>
        </div>
        <div className="card waiting">
          <h2 className="pulse">⏳ Game hasn't started yet...</h2>
          <p style={{ marginTop: '1rem' }}>Waiting for admin to release the bingo cards.</p>
        </div>
      </div>
    );
  }

  if (gameState === 'ended') {
    return (
      <div className="container">
        <div className="header">
          <h1>🎯 Icebreaker Bingo</h1>
        </div>
        <div className="card">
          <h2>🎉 Game Over!</h2>
          <p>Thanks for playing! You completed {playerData?.completedCount || 0}/25 squares.</p>
        </div>
      </div>
    );
  }

  const completedCount = playerData?.completedCount || 0;

  return (
    <div className="container">
      <div className="header">
        <h1>🎯 Icebreaker Bingo</h1>
        <p>{localStorage.getItem('bingo_name')}'s Card</p>
      </div>

      {/* Progress */}
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span>{completedCount}/25 completed</span>
          <span>
            {playerData?.hasBlackout && '🏆 BLACKOUT! '}
            {playerData?.hasDiagonal && '↗️ Diagonal! '}
            {playerData?.hasRow && '➡️ Row! '}
            {playerData?.hasColumn && '⬇️ Column! '}
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(completedCount / 25) * 100}%` }} />
        </div>
      </div>

      {/* Claimed wins banner */}
      {Object.keys(claimedWins).length > 0 && (
        <div className="card" style={{ padding: '0.75rem', background: '#fef2f2', borderLeft: '4px solid var(--danger)' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '0.25rem' }}>
            🏆 Already Won:
          </p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {Object.entries(claimedWins).map(([key, val]) => (
              <span key={key} style={{ marginRight: '0.25rem' }}>
                {formatCategory(key)} — {val.winner}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bingo Grid */}
      <div className="bingo-grid">
        {card.sort((a, b) => a.position - b.position).map((cell) => {
          const isCompleted = cell.answer !== null;
          const isFree = cell.questionId === 'free';
          const highlight = getCellHighlight(cell.position);

          return (
            <div
              key={cell.position}
              className={`bingo-cell ${isCompleted ? 'completed' : ''} ${isFree ? 'free' : ''} ${highlight}`}
              onClick={() => {
                if (!isCompleted && !isFree) {
                  setSelectedCell(cell);
                  setAnswer('');
                  setError('');
                } else if (isCompleted && !isFree) {
                  setSelectedCell({ ...cell, viewOnly: true });
                }
              }}
            >
              {isCompleted && <span className="checkmark">✓</span>}
              {isFree ? '⭐ FREE' : cell.questionText}
            </div>
          );
        })}
      </div>

      {/* Answer Modal */}
      {selectedCell && (
        <div className="modal-overlay" onClick={() => setSelectedCell(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {selectedCell.viewOnly ? (
              <>
                <h3>✅ Your Answer</h3>
                <p style={{ fontSize: '1rem', color: 'var(--text)' }}>{selectedCell.questionText}</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.75rem', padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  {selectedCell.answer}
                </p>
                <div className="modal-actions">
                  <button className="btn" style={{ background: 'var(--border)' }} onClick={() => setSelectedCell(null)}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>📝 Answer This Question</h3>
                <p style={{ fontSize: '1rem', color: 'var(--text)' }}>{selectedCell.questionText}</p>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type="text"
                    placeholder="Start typing a name..."
                    value={answer}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onFocus={() => answer.trim() && suggestions.length > 0 && setShowSuggestions(true)}
                  />
                  {showSuggestions && (
                    <ul className="autocomplete-list">
                      {suggestions.map((s, i) => (
                        <li key={i} onMouseDown={() => selectSuggestion(s.displayName)}>
                          <strong>{s.displayName}</strong>
                          {s.teamName && <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>({s.teamName})</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {error && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>
                )}
                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={handleSubmitAnswer} disabled={submitting || !answer.trim()}>
                    {submitting ? 'Submitting...' : '✅ Submit'}
                  </button>
                  <button className="btn" style={{ background: 'var(--border)' }} onClick={() => setSelectedCell(null)}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Refresh button */}
      <button className="refresh-btn" onClick={fetchCard} title="Refresh">
        🔄
      </button>
    </div>
  );
}
