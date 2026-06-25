const API_BASE = import.meta.env.PROD
  ? 'https://sk-icebreaker-bingo-api.azurewebsites.net/api'
  : '/api';

// Get playroom from URL or localStorage
function getPlayroom() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('playroom');
  if (fromUrl) {
    localStorage.setItem('bingo_playroom', fromUrl);
    return fromUrl;
  }
  return localStorage.getItem('bingo_playroom') || '';
}

function withPlayroom(url) {
  const playroom = getPlayroom();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}playroom=${encodeURIComponent(playroom)}`;
}

export function hasPlayroom() {
  const params = new URLSearchParams(window.location.search);
  return !!(params.get('playroom') || localStorage.getItem('bingo_playroom'));
}

export async function joinGame(alias, displayName, teamName) {
  const res = await fetch(withPlayroom(`${API_BASE}/join`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias, displayName, teamName }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    // Non-JSON response (e.g. cold-start gateway/503) — synthesize an error.
    data = {};
  }
  if (!res.ok && !data.error) {
    data.error = `Server is waking up (status ${res.status}). Please try again.`;
  }
  return data;
}

export async function getGameState() {
  const res = await fetch(withPlayroom(`${API_BASE}/game-state`));
  return res.json();
}

export async function getRoster() {
  const res = await fetch(withPlayroom(`${API_BASE}/roster`));
  return res.json();
}

export async function getMyCard(alias) {
  const res = await fetch(withPlayroom(`${API_BASE}/my-card?alias=${encodeURIComponent(alias)}`));
  return res.json();
}

export async function submitAnswer(alias, questionId, answer) {
  const res = await fetch(withPlayroom(`${API_BASE}/submit-answer`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias, questionId, answer }),
  });
  return res.json();
}

export async function adminGetPlayers(key) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/players?key=${encodeURIComponent(key)}`));
  return res.json();
}

export async function adminGetDashboard(key) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/dashboard?key=${encodeURIComponent(key)}`));
  return res.json();
}

export async function adminRelease(key) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/release?key=${encodeURIComponent(key)}`), {
    method: 'POST',
  });
  return res.json();
}

export async function adminReset(key) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/reset?key=${encodeURIComponent(key)}`), {
    method: 'POST',
  });
  return res.json();
}

export async function adminGetQuestions(key) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/questions?key=${encodeURIComponent(key)}`));
  return res.json();
}

export async function adminSaveQuestions(key, questions) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/questions?key=${encodeURIComponent(key)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  return res.json();
}

export async function adminClaimWin(key, category, winner) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/claim-win?key=${encodeURIComponent(key)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, winner }),
  });
  return res.json();
}

export async function adminUnclaimWin(key, category) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/unclaim-win?key=${encodeURIComponent(key)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  });
  return res.json();
}

export async function adminGetWinQueue(key) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/win-queue?key=${encodeURIComponent(key)}`));
  return res.json();
}

export async function adminDismissQueueItem(key, category, player) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/dismiss-queue-item?key=${encodeURIComponent(key)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, player }),
  });
  return res.json();
}

export async function adminExport(key) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/export?key=${encodeURIComponent(key)}`));
  return res.json();
}

export async function adminGetPlayerAnswers(key, alias) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/player-answers?key=${encodeURIComponent(key)}&alias=${encodeURIComponent(alias)}`));
  return res.json();
}

export async function adminSetMode(key, mode) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/set-mode?key=${encodeURIComponent(key)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  return res.json();
}

export async function adminCloseGame(key) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/close-game?key=${encodeURIComponent(key)}`), {
    method: 'POST',
  });
  return res.json();
}

export async function adminDrawRaffle(key) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/draw-raffle?key=${encodeURIComponent(key)}`), {
    method: 'POST',
  });
  return res.json();
}

export async function adminResetRaffle(key) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/reset-raffle?key=${encodeURIComponent(key)}`), {
    method: 'POST',
  });
  return res.json();
}

export async function adminAddRaffleEntries(key, entries, players) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/add-raffle-entries?key=${encodeURIComponent(key)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries, players }),
  });
  return res.json();
}

export async function adminClaimSession(key, name, sessionId) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/claim-session?key=${encodeURIComponent(key)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, sessionId }),
  });
  return res.json();
}

export async function adminGetSession(key, sessionId) {
  const res = await fetch(withPlayroom(`${API_BASE}/game-admin/session?key=${encodeURIComponent(key)}&sessionId=${encodeURIComponent(sessionId)}`));
  return res.json();
}
