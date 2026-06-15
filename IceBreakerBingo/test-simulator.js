#!/usr/bin/env node
/**
 * Icebreaker Bingo - Test Simulator
 * 
 * Simulates multiple players joining, submitting answers, and tests
 * admin operations including extra raffle entries.
 * 
 * Usage:
 *   node test-simulator.js [API_URL] [PLAYROOM_KEY] [ADMIN_KEY] [PLAYER_COUNT]
 * 
 * Examples:
 *   node test-simulator.js http://localhost:7071/api localkey bingo-admin-2026 50
 *   node test-simulator.js https://sk-icebreaker-bingo-api.azurewebsites.net/api PLAYROOM_KEY ADMIN_KEY 100
 */

const API_BASE = process.argv[2] || 'http://localhost:7071/api';
const PLAYROOM_KEY = process.argv[3] || '';
const ADMIN_KEY = process.argv[4] || 'bingo-admin-2026';
const PLAYER_COUNT = parseInt(process.argv[5]) || 50;

function withPlayroom(url) {
  if (!PLAYROOM_KEY) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}playroom=${encodeURIComponent(PLAYROOM_KEY)}`;
}

async function api(method, path, body) {
  const url = withPlayroom(`${API_BASE}${path}`);
  const opts = { method, headers: {} };
  if (method === 'POST') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body || {});
  }
  if (process.env.DEBUG) console.log(`  [DEBUG] ${method} ${url}`);
  const res = await fetch(url, opts);
  if (process.env.DEBUG) console.log(`  [DEBUG] → ${res.status} ${res.statusText}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status} on ${method} ${path}: ${text.slice(0, 200)}`);
  }
}

async function adminApi(method, path, body) {
  const sep = path.includes('?') ? '&' : '?';
  return api(method, `${path}${sep}key=${encodeURIComponent(ADMIN_KEY)}`, body);
}

// Fake data generators
const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank', 'Iris', 'Jack',
  'Karen', 'Leo', 'Mona', 'Nate', 'Olivia', 'Pete', 'Quinn', 'Rose', 'Sam', 'Tina',
  'Uma', 'Victor', 'Wendy', 'Xavier', 'Yara', 'Zach', 'Amy', 'Brad', 'Cathy', 'Dave'];
const LAST_NAMES = ['Smith', 'Johnson', 'Brown', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas',
  'Jackson', 'White', 'Harris', 'Martin', 'Garcia', 'Lee', 'Clark', 'Hall', 'Young', 'King', 'Wright'];
const TEAMS = ['Azure Compute', 'Azure Storage', 'Azure Networking', 'M365', 'Windows', 'DevDiv', 'AI Platform',
  'Surface', 'Xbox', 'LinkedIn', 'GitHub', 'Security', 'Office', 'Teams'];

const QUESTIONS = [
  "Find someone who has traveled to 3+ countries",
  "Find someone who speaks more than 2 languages",
  "Find someone who has run a marathon",
  "Find someone who plays a musical instrument",
  "Find someone who has met a celebrity",
  "Find someone who has worked at Microsoft for 10+ years",
  "Find someone born in a different country",
  "Find someone who has a pet reptile",
  "Find someone who can solve a Rubik's cube",
  "Find someone who has been skydiving",
  "Find someone who volunteers regularly",
  "Find someone who has written a book or blog",
  "Find someone who can cook a dish from another culture",
  "Find someone who has hiked a mountain over 10,000 ft",
  "Find someone who has been on TV or radio",
  "Find someone who has a twin sibling",
  "Find someone who has visited all 50 US states",
  "Find someone who knows sign language",
  "Find someone who has won a competition",
  "Find someone who collects something unusual",
  "Find someone who has lived in 3+ cities",
  "Find someone who can juggle",
  "Find someone who has built something with their hands",
  "Find someone who has a hidden talent",
  "Find someone who has done karaoke in public",
  "Find someone who has swum in the ocean",
  "Find someone who has a garden",
  "Find someone who has read 20+ books this year",
  "Find someone who has a pilot's license",
  "Find someone who has done a polar plunge",
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePlayers(count) {
  const players = [];
  for (let i = 0; i < count; i++) {
    const first = randomFrom(FIRST_NAMES);
    const last = randomFrom(LAST_NAMES);
    players.push({
      alias: `${first.toLowerCase()}${last.toLowerCase()}${i}`,
      displayName: `${first} ${last}`,
      teamName: randomFrom(TEAMS),
    });
  }
  return players;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ MAIN SIMULATION ============

async function run() {
  console.log('='.repeat(60));
  console.log('🎯 ICEBREAKER BINGO - TEST SIMULATOR');
  console.log('='.repeat(60));
  console.log(`API: ${API_BASE}`);
  console.log(`Players: ${PLAYER_COUNT}`);
  console.log(`Admin Key: ${ADMIN_KEY}`);
  console.log(`Playroom: ${PLAYROOM_KEY || '(none)'}`);
  console.log('');

  // Step 1: Reset game
  console.log('🔄 Step 1: Resetting game...');
  const resetResult = await adminApi('POST', '/game-admin/reset');
  console.log(`   ${resetResult.message || resetResult.error}`);

  // Step 2: Set raffle mode
  console.log('🎟️ Step 2: Setting raffle mode...');
  const modeResult = await adminApi('POST', '/game-admin/set-mode', { mode: 'raffle' });
  console.log(`   ${modeResult.message || modeResult.error}`);

  // Step 3: Load questions
  console.log('❓ Step 3: Loading questions...');
  const questions = QUESTIONS.map((text, i) => ({ id: `q${i + 1}`, text }));
  const qResult = await adminApi('POST', '/game-admin/questions', { questions });
  console.log(`   ${qResult.message || qResult.error}`);

  // Step 4: Generate and join players
  console.log(`👥 Step 4: Joining ${PLAYER_COUNT} players...`);
  const players = generatePlayers(PLAYER_COUNT);
  const joinResults = [];
  
  // Join in batches of 10 for speed
  for (let batch = 0; batch < players.length; batch += 10) {
    const batchPlayers = players.slice(batch, batch + 10);
    const promises = batchPlayers.map(p => 
      api('POST', '/join', { alias: p.alias, displayName: p.displayName, teamName: p.teamName })
    );
    const results = await Promise.all(promises);
    joinResults.push(...results);
    process.stdout.write(`   Joined ${Math.min(batch + 10, players.length)}/${players.length}\r`);
  }
  console.log(`\n   ✅ ${joinResults.filter(r => !r.error).length} players joined successfully`);

  // Step 5: Release the game
  console.log('🚀 Step 5: Releasing bingo cards...');
  const releaseResult = await adminApi('POST', '/game-admin/release');
  console.log(`   ${releaseResult.message || releaseResult.error}`);

  // Step 6: Simulate answer submissions
  console.log('✏️ Step 6: Simulating answer submissions...');
  let totalAnswers = 0;
  let errors = 0;

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    // Each player answers a random number of questions (3-20)
    const answerCount = Math.floor(Math.random() * 18) + 3;
    
    // Get their card first
    const cardData = await api('GET', `/my-card?alias=${encodeURIComponent(player.alias)}`);
    if (!cardData.card) continue;

    const unanswered = cardData.card.filter(c => !c.answer && !c.isFreeSpace);
    const toAnswer = unanswered.slice(0, answerCount);

    for (const cell of toAnswer) {
      // Pick a random player from a different team as the answer
      const otherPlayers = players.filter(p => p.alias !== player.alias && p.teamName !== player.teamName);
      if (otherPlayers.length === 0) continue;

      const answeredWith = randomFrom(otherPlayers);
      const result = await api('POST', '/submit-answer', {
        alias: player.alias,
        questionId: cell.questionId,
        answer: [{ alias: answeredWith.alias, displayName: answeredWith.displayName, teamName: answeredWith.teamName }],
      });

      if (result.error) errors++;
      else totalAnswers++;
    }
    
    process.stdout.write(`   Player ${i + 1}/${players.length} (${totalAnswers} answers, ${errors} errors)\r`);
    
    // Small delay to avoid overwhelming the server
    if (i % 5 === 0) await sleep(100);
  }
  console.log(`\n   ✅ ${totalAnswers} answers submitted (${errors} errors)`);

  // Step 7: Check dashboard
  console.log('📊 Step 7: Checking dashboard...');
  const dashboard = await adminApi('GET', '/game-admin/dashboard');
  if (dashboard.leaderboard) {
    console.log(`   Total players: ${dashboard.totalPlayers}`);
    console.log(`   First 5 done: ${dashboard.first5Done?.length || 0}`);
    console.log(`   Row completers: ${dashboard.rowCompleters?.length || 0}`);
    console.log(`   Top 5 leaderboard:`);
    dashboard.leaderboard.slice(0, 5).forEach((p, i) => {
      console.log(`     ${i + 1}. ${p.displayName} (${p.alias}) - ${p.completedCount}/25`);
    });
  }

  // Step 8: Add extra raffle entries
  console.log('🎁 Step 8: Adding extra raffle entries...');
  const topPlayers = (dashboard.leaderboard || []).slice(0, 5).map(p => p.alias);
  if (topPlayers.length > 0) {
    const extraResult = await adminApi('POST', '/game-admin/add-raffle-entries', { entries: 3, players: topPlayers });
    console.log(`   ${extraResult.message || extraResult.error}`);
    if (extraResult.updated) {
      extraResult.updated.forEach(p => {
        console.log(`     ${p.displayName}: ${p.extraRaffleEntries} extra entries`);
      });
    }
  }

  // Step 9: Verify leaderboard shows extra entries
  console.log('📊 Step 9: Verifying leaderboard with extra entries...');
  const dashboard2 = await adminApi('GET', '/game-admin/dashboard');
  if (dashboard2.leaderboard) {
    console.log('   Top 5 with raffle breakdown:');
    dashboard2.leaderboard.slice(0, 5).forEach((p, i) => {
      const bingoEntries = p.completedCount || 1;
      const extraEntries = p.extraRaffleEntries || 0;
      console.log(`     ${i + 1}. ${p.displayName}: Bingo=${bingoEntries} + Extra=${extraEntries} = Total ${bingoEntries + extraEntries}`);
    });
  }

  // Step 10: Close game and draw raffle
  console.log('🔒 Step 10: Closing game...');
  const closeResult = await adminApi('POST', '/game-admin/close-game');
  console.log(`   ${closeResult.message || closeResult.error}`);

  console.log('🎰 Step 11: Drawing raffle winners...');
  for (let draw = 0; draw < 5; draw++) {
    const drawResult = await adminApi('POST', '/game-admin/draw-raffle');
    if (drawResult.error) {
      console.log(`   ${drawResult.error}`);
      break;
    }
    console.log(`   🎉 Winner #${drawResult.drawNumber}: ${drawResult.displayName} (${drawResult.entries} entries out of ${drawResult.totalPoolEntries} pool)`);
  }

  // Step 12: Check game state
  console.log('📋 Step 12: Final game state...');
  const state = await api('GET', '/game-state');
  console.log(`   State: ${state.gameState}, Mode: ${state.gameMode}, Players: ${state.playerCount}`);
  console.log(`   Raffle winners drawn: ${state.raffleResults?.length || 0}`);

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ SIMULATION COMPLETE');
  console.log('='.repeat(60));
}

run().catch(err => {
  console.error('❌ Simulation failed:', err.message);
  process.exit(1);
});
