#!/usr/bin/env node
/**
 * Icebreaker Bingo - Cold-Start Race Test
 *
 * Reproduces the failure mode that the throughput simulator (test-simulator.js)
 * cannot catch: a *cold / just-initialized* instance being hit by the browser's
 * concurrent-on-mount request trio (game-state + roster + join) before the
 * config doc / containers are seeded. That race previously caused 409 -> 500
 * "can't join the game" red errors until the instance warmed up.
 *
 * Unlike the throughput simulator, this test:
 *   - Does NOT warm or pre-seed the host first (no reset/set-mode beforehand).
 *   - Fires game-state + roster + join SIMULTANEOUSLY as the very first requests.
 *   - Asserts none of them return 5xx / non-JSON / error payloads.
 *
 * Best signal: run it against a freshly (re)started host or a just-deployed /
 * scaled-to-zero Azure Functions app, so the first burst hits a genuinely cold
 * instance. Locally: start `func` and run this immediately (do not call
 * game-state yourself first). Multiple rounds + concurrent joiners widen the
 * window to surface any residual init race.
 *
 * Usage:
 *   node test-cold-start.js [API_URL] [PLAYROOM_KEY] [ADMIN_KEY] [ROUNDS] [CONCURRENCY]
 *
 * Examples:
 *   node test-cold-start.js http://localhost:7071/api "" EmiSubba 20 8
 *   node test-cold-start.js https://sk-icebreaker-bingo-api.azurewebsites.net/api PLAYROOM_KEY ADMIN_KEY 30 10
 */

const API_BASE = process.argv[2] || 'http://localhost:7071/api';
const PLAYROOM_KEY = process.argv[3] || '';
const ADMIN_KEY = process.argv[4] || 'bingo-admin-2026';
const ROUNDS = parseInt(process.argv[5]) || 20;
const CONCURRENCY = parseInt(process.argv[6]) || 8;

function withPlayroom(url) {
  if (!PLAYROOM_KEY) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}playroom=${encodeURIComponent(PLAYROOM_KEY)}`;
}

// Raw request that NEVER throws on non-OK/non-JSON — it classifies the response
// so we can detect 5xx / unparseable bodies (the symptom of the init race).
async function rawApi(method, path, body) {
  const url = withPlayroom(`${API_BASE}${path}`);
  const opts = { method, headers: {} };
  if (method === 'POST') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body || {});
  }
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let json = null;
    let parseError = false;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      parseError = true;
    }
    return {
      ok: res.ok,
      status: res.status,
      parseError,
      json,
      text: text.slice(0, 300),
    };
  } catch (e) {
    // Network-level failure (connection reset, etc.)
    return { ok: false, status: 0, parseError: false, json: null, text: String(e.message || e) };
  }
}

let uid = 0;
function makePlayer() {
  uid += 1;
  const stamp = `${Date.now().toString(36)}${uid}`;
  return {
    alias: `cold_${stamp}`,
    displayName: `Cold Tester ${uid}`,
    teamName: `ColdTeam ${(uid % 5) + 1}`,
  };
}

// A failure = the kind of response the user actually saw during the init race:
// a 5xx, a network-level error, or an unparseable (non-JSON) body. A clean 4xx
// with a JSON body is NOT a failure — it proves the host initialized correctly
// and returned a proper business response (e.g. "Game is closed"), which is
// exactly the behaviour we want under concurrency.
function isServerFailure(r) {
  if (r.status >= 500 || r.status === 0) return true;
  if (r.parseError) return true;
  return false;
}

// A join is "gracefully handled" if it's either a real success OR a clean
// business rejection (4xx carrying a JSON {error}). Anything else (5xx,
// non-JSON, empty 4xx) is the init-race symptom.
function isJoinHandled(r) {
  if (isServerFailure(r)) return false;
  if (r.ok && r.json && !r.json.error) return true; // success
  if (r.status >= 400 && r.status < 500 && r.json && r.json.error) return true; // clean business 4xx
  return false;
}

async function runRound(round) {
  const player = makePlayer();
  // Fire the exact trio the entry screen issues on mount — all at once.
  const [gameState, roster, join] = await Promise.all([
    rawApi('GET', '/game-state'),
    rawApi('GET', '/roster'),
    rawApi('POST', '/join', {
      alias: player.alias,
      displayName: player.displayName,
      teamName: player.teamName,
    }),
  ]);

  const calls = [
    { name: 'game-state', r: gameState },
    { name: 'roster', r: roster },
    { name: 'join', r: join },
  ];

  const failures = [];
  for (const c of calls) {
    if (isServerFailure(c.r)) {
      failures.push(`${c.name} → HTTP ${c.r.status}${c.r.parseError ? ' (non-JSON)' : ''}: ${c.r.text}`);
    }
  }

  // join must additionally be gracefully handled — either a usable success or a
  // clean business 4xx. A 5xx / non-JSON / empty body is the init-race symptom
  // that turned the red error on in the browser.
  if (!isServerFailure(join) && !isJoinHandled(join)) {
    failures.push(`join → HTTP ${join.status} not gracefully handled: ${join.text}`);
  }

  return { round, alias: player.alias, failures };
}

async function main() {
  console.log('🧊 Icebreaker Bingo — Cold-Start Race Test');
  console.log(`   API:         ${API_BASE}`);
  console.log(`   Rounds:      ${ROUNDS}`);
  console.log(`   Concurrency: ${CONCURRENCY} parallel trios per round`);
  console.log('   ⚠️  For best signal run this as the FIRST traffic to a cold/just-restarted host.\n');

  let totalCalls = 0;
  let totalFailures = 0;
  const failureSamples = [];

  for (let round = 1; round <= ROUNDS; round++) {
    // Within a round, fire CONCURRENCY trios at the same instant to maximise the
    // chance several requests collide inside ensureInitialized() on a cold instance.
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => runRound(round))
    );
    for (const res of results) {
      totalCalls += 3; // game-state + roster + join
      if (res.failures.length) {
        totalFailures += res.failures.length;
        for (const f of res.failures) {
          if (failureSamples.length < 20) failureSamples.push(`round ${round} [${res.alias}] ${f}`);
        }
      }
    }
    process.stdout.write(`   Round ${round}/${ROUNDS} — ${totalFailures} failure(s) so far\r`);
  }

  console.log('\n');
  console.log('────────────────────────────────────────────');
  console.log(`   Trios fired:   ${ROUNDS * CONCURRENCY}`);
  console.log(`   Requests:      ${totalCalls}`);
  console.log(`   Failures:      ${totalFailures}`);
  console.log('────────────────────────────────────────────');

  if (failureSamples.length) {
    console.log('\n❌ FAILURES (cold-start race likely reproduced):');
    failureSamples.forEach(f => console.log(`   - ${f}`));
    if (totalFailures > failureSamples.length) {
      console.log(`   ... and ${totalFailures - failureSamples.length} more`);
    }
    process.exitCode = 1;
  } else {
    console.log('\n✅ PASS — no 5xx / non-JSON / failed-join responses. Cold-start path is safe.');
  }
}

main().catch(e => {
  console.error('\n💥 Test harness error:', e);
  process.exitCode = 1;
});
