const API_BASE = '/api';

export async function joinGame(alias, displayName, teamName) {
  const res = await fetch(`${API_BASE}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias, displayName, teamName }),
  });
  return res.json();
}

export async function getGameState() {
  const res = await fetch(`${API_BASE}/game-state`);
  return res.json();
}

export async function getRoster() {
  const res = await fetch(`${API_BASE}/roster`);
  return res.json();
}

export async function getMyCard(alias) {
  const res = await fetch(`${API_BASE}/my-card?alias=${encodeURIComponent(alias)}`);
  return res.json();
}

export async function submitAnswer(alias, questionId, answer) {
  const res = await fetch(`${API_BASE}/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias, questionId, answer }),
  });
  return res.json();
}

export async function adminGetPlayers(key) {
  const res = await fetch(`${API_BASE}/game-admin/players?key=${encodeURIComponent(key)}`);
  return res.json();
}

export async function adminGetDashboard(key) {
  const res = await fetch(`${API_BASE}/game-admin/dashboard?key=${encodeURIComponent(key)}`);
  return res.json();
}

export async function adminRelease(key) {
  const res = await fetch(`${API_BASE}/game-admin/release?key=${encodeURIComponent(key)}`, {
    method: 'POST',
  });
  return res.json();
}

export async function adminReset(key) {
  const res = await fetch(`${API_BASE}/game-admin/reset?key=${encodeURIComponent(key)}`, {
    method: 'POST',
  });
  return res.json();
}

export async function adminGetQuestions(key) {
  const res = await fetch(`${API_BASE}/game-admin/questions?key=${encodeURIComponent(key)}`);
  return res.json();
}

export async function adminSaveQuestions(key, questions) {
  const res = await fetch(`${API_BASE}/game-admin/questions?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  return res.json();
}

export async function adminClaimWin(key, category, winner) {
  const res = await fetch(`${API_BASE}/game-admin/claim-win?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, winner }),
  });
  return res.json();
}

export async function adminUnclaimWin(key, category) {
  const res = await fetch(`${API_BASE}/game-admin/unclaim-win?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  });
  return res.json();
}

export async function adminGetWinQueue(key) {
  const res = await fetch(`${API_BASE}/game-admin/win-queue?key=${encodeURIComponent(key)}`);
  return res.json();
}

export async function adminDismissQueueItem(key, category, player) {
  const res = await fetch(`${API_BASE}/game-admin/dismiss-queue-item?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, player }),
  });
  return res.json();
}

export async function adminExport(key) {
  const res = await fetch(`${API_BASE}/game-admin/export?key=${encodeURIComponent(key)}`);
  return res.json();
}
