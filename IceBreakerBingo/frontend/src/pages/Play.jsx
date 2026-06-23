import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyCard, submitAnswer, getGameState, getRoster } from '../api';
import RulesContent from '../RulesContent';

const ROWS = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24]];
const COLS = [[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24]];
const DIAGS = [[0,6,12,18,24],[4,8,12,16,20]];

export default function Play() {
  const [card, setCard] = useState([]);
  const [playerData, setPlayerData] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState('active');
  const [roster, setRoster] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showRules, setShowRules] = useState(false);
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

  // Fetch roster for autocomplete (refresh periodically to pick up new players)
  const fetchRoster = useCallback(() => {
    getRoster().then(data => {
      if (data.roster) setRoster(data.roster);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchRoster();
    const interval = setInterval(fetchRoster, 15000);
    return () => clearInterval(interval);
  }, [fetchRoster]);

  const handleAnswerChange = (value) => {
    setSearchText(value);
    if (value.trim().length > 0) {
      const lower = value.toLowerCase();
      const alreadySelected = new Set(selectedPeople.map(p => p.alias));
      const matches = roster.filter(r =>
        !alreadySelected.has(r.alias) &&
        r.alias !== alias &&
        (r.displayName.toLowerCase().includes(lower) ||
        r.alias.toLowerCase().includes(lower) ||
        (r.teamName && r.teamName.toLowerCase().includes(lower)))
      ).slice(0, 8);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (person) => {
    setSelectedPeople([...selectedPeople, person]);
    setSearchText('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const removePerson = (aliasToRemove) => {
    setSelectedPeople(selectedPeople.filter(p => p.alias !== aliasToRemove));
  };

  const handleSubmitAnswer = async () => {
    if (selectedPeople.length === 0) return;
    setSubmitting(true);
    setError('');

    try {
      const answerData = selectedPeople.map(p => ({ alias: p.alias, displayName: p.displayName, teamName: p.teamName }));
      const result = await submitAnswer(alias, selectedCell.questionId, answerData);
      if (result.error) {
        setError(result.error);
      } else {
        setSelectedCell(null);
        setSelectedPeople([]);
        setSearchText('');
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

  if (gameState === 'closed') {
    const myAlias = alias;
    const myWin = (playerData?.raffleResults || []).find(r => r.winner === myAlias);

    return (
      <div className="container">
        <div className="header">
          <h1>🎯 Icebreaker Bingo</h1>
        </div>
        {myWin ? (
          <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '2px solid #f59e0b' }}>
            <div style={{ fontSize: '3rem' }}>🎉🏆🎉</div>
            <h2 style={{ color: '#78350f' }}>You Won!</h2>
            <p style={{ fontSize: '1.1rem', marginTop: '0.5rem', fontWeight: 600 }}>
              Winner #{myWin.drawNumber}
            </p>
            <p style={{ fontSize: '1rem', marginTop: '0.75rem', color: '#92400e', fontWeight: 600 }}>
              🎤 Please come see the Game Admin to claim your prize!
            </p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#92400e' }}>
              You had {myWin.entries} raffle entries
            </p>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>🎟️ Game Closed — Raffle Time!</h2>
            <p style={{ marginTop: '0.5rem' }}>
              You completed <strong>{playerData?.completedCount || 0}/25</strong> squares
            </p>
            <p style={{ marginTop: '0.5rem', fontSize: '1.1rem' }}>
              🎟️ Your total raffle entries: <strong style={{ color: 'var(--primary)' }}>{(playerData?.score ?? playerData?.completedCount ?? 0) + (playerData?.extraRaffleEntries || 0)}</strong>
            </p>
            {(playerData?.extraRaffleEntries || 0) > 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ({playerData?.score ?? playerData?.completedCount ?? 0} from bingo + {playerData?.extraRaffleEntries || 0} bonus)
              </p>
            )}
            <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
              Winners are being drawn now. Good luck! 🍀
            </p>
          </div>
        )}
      </div>
    );
  }

  const completedCount = playerData?.completedCount || 0;
  const score = playerData?.score ?? completedCount;
  const extraRaffleEntries = playerData?.extraRaffleEntries || 0;
  const totalEntries = score + extraRaffleEntries;

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
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
          <span>🎟️ Raffle entries: <strong style={{ color: 'var(--primary)' }}>{totalEntries}</strong></span>
          <span style={{ fontSize: '0.75rem' }}>
            ({score} bingo{extraRaffleEntries > 0 && ` + ${extraRaffleEntries} bonus`})
          </span>
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
                  setSelectedPeople([]);
                  setSearchText('');
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
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  {(() => {
                    const ans = selectedCell.answer;
                    if (Array.isArray(ans)) {
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {ans.map((p, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', padding: '0.3rem 0.6rem', background: '#dbeafe', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 500 }}>
                              {p.displayName || p}
                              {p.teamName && <span style={{ marginLeft: '0.3rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>({p.teamName})</span>}
                            </span>
                          ))}
                        </div>
                      );
                    }
                    return <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{ans}</p>;
                  })()}
                </div>
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

                {/* Selected people tags */}
                {selectedPeople.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
                    {selectedPeople.map((p) => (
                      <span key={p.alias} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.3rem 0.6rem', background: '#dbeafe', borderRadius: '9999px',
                        fontSize: '0.85rem', fontWeight: 500, border: '1px solid #93c5fd',
                      }}>
                        {p.displayName}
                        {p.teamName && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({p.teamName})</span>}
                        <button
                          onClick={() => removePerson(p.alias)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: '0.9rem', padding: '0 0.15rem', lineHeight: 1 }}
                          title="Remove"
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type="text"
                    placeholder="Search for a person by name or alias..."
                    value={searchText}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    autoFocus
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onFocus={() => searchText.trim() && suggestions.length > 0 && setShowSuggestions(true)}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                    Don't see someone? They may not have joined yet. List refreshes automatically.
                  </p>
                  {showSuggestions && (
                    <ul className="autocomplete-list">
                      {suggestions.map((s, i) => (
                        <li key={i} onMouseDown={() => selectSuggestion(s)}>
                          <strong>{s.displayName}</strong>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>@{s.alias}</span>
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
                  <button className="btn btn-primary" onClick={handleSubmitAnswer} disabled={submitting || selectedPeople.length === 0}>
                    {submitting ? 'Submitting...' : `✅ Submit (${selectedPeople.length})`}
                  </button>
                  <button className="btn" style={{ background: 'var(--border)' }} onClick={() => { setSelectedCell(null); setSelectedPeople([]); setSearchText(''); }}>
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

      {/* Rules / Help button */}
      <button
        onClick={() => setShowRules(true)}
        title="How to play & prizes"
        style={{
          position: 'fixed', bottom: '1rem', left: '1rem', zIndex: 1000,
          width: '44px', height: '44px', borderRadius: '50%',
          background: 'var(--primary, #3b82f6)', color: 'white',
          border: 'none', cursor: 'pointer', fontSize: '1.4rem',
          fontWeight: 700, display: 'flex', alignItems: 'center',
          justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        ?
      </button>

      {/* Rules modal */}
      {showRules && (
        <div className="modal-overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>📋 How to Play & Prizes</h3>
            <RulesContent showVersion />
            <div className="modal-actions">
              <button className="btn" style={{ background: 'var(--border)' }} onClick={() => setShowRules(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
