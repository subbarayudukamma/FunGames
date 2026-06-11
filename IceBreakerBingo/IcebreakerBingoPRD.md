# PRD: Icebreaker Bingo Web App

## 1. Overview

A lightweight, mobile-first web app for team icebreaker bingo at events. Players scan a QR code, enter their alias/name, and play bingo by finding colleagues who match specific questions. Admins control the game flow and track progress in real-time (via polling).

The app supports two game modes:
- **Classic Bingo**: Traditional row/column/diagonal wins with admin verification
- **Raffle Bingo**: Each completed box = 1 raffle entry; admin draws weighted random winners at the end

---

## 2. Goals & Constraints

| Aspect | Decision |
|--------|----------|
| Players | 100–300 concurrent |
| Auth | None (alias + name + team name entry only) |
| Real-time | No WebSockets; 5-second polling + manual refresh button |
| Bingo grid | 5×5 (25 questions), randomized per player |
| Answer format | Text input with autocomplete from participant roster |
| Admin access | Shared secret key (multiple admins) |
| Question setup | Admin pre-loads via admin page before event |
| Hosting | Azure (quick to build & deploy) |

---

## 3. Recommended Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React (Vite) or plain HTML/JS | Mobile-first SPA, fast to build |
| Backend API | Azure Functions (Node.js/TypeScript) | Serverless, zero infra management, auto-scales |
| Database | Azure Cosmos DB (Serverless tier) | Schemaless JSON docs, low cost for burst workloads, no connection pool limits |
| Hosting (Frontend) | Azure Static Web Apps | Free tier, auto-deploys from repo, integrates with Azure Functions |
| QR Code | Generated link to the app URL | Any QR generator tool |

**Why this stack?**
- **Fastest to build**: Static Web Apps + Functions = one `swa deploy` command
- **Cost**: Serverless Cosmos + Functions = pay only for event duration (~$0–5 total)
- **Scale**: Handles 300 concurrent users trivially with no tuning
- **No connection limits**: Cosmos HTTP API avoids SQL connection pool headaches with serverless

---

## 4. User Roles

### 4.1 Player
- Scans QR code → lands on app
- Enters Microsoft alias + display name + team name → joins lobby
- Waits until admin releases the game
- Sees personalized 5×5 bingo card (randomized layout)
- Taps a cell → modal with full question + search input that filters the participant roster (only registered players can be selected, no free-text; same-team members excluded). Players are searchable by name or alias. Multiple people can be selected as tags/chips with 'x' to remove.
- Can see own progress (completed cells highlighted in green)
- If a player quits and re-joins with the same alias but different name/team, their record is updated (card and progress preserved)
- Polls every 5s for game state changes (+ manual refresh button)
- Completing a line (row/col/diagonal/first5/blackout) automatically notifies the admin for verification
- When admin officially claims a specific line, all players see:
  - A banner listing all claimed wins and their winners
  - Red rectangle + dimmed style on cells belonging to that claimed line on their own card
  - This helps players focus on unclaimed lines

### 4.2 Admin
- Navigates to `/admin?key=<shared-secret>`
- **Before game**: Selects game mode — **Classic Bingo** (rows/cols/diagonals win) or **Raffle Bingo** (each box = 1 raffle entry). Mode cannot be changed after releasing cards.
- **Before game**: Manages bingo questions (add/edit/delete, need 25+ questions). Can generate 30 random placeholder questions with one click. Can import questions from a .txt file or by pasting them (one per line).
- **Before game**: Sees player count in lobby (who's registered and ready)
- **During game**: Clicks "Release Bingo" to start the game
- **During game (Classic mode)**: Dashboard shows:
  - Who completed first 5 questions
  - Who completed a full row (each of 5 rows tracked separately)
  - Who completed a full column (each of 5 columns tracked separately)
  - Who completed a diagonal (each of 2 diagonals tracked separately)
  - Who completed the full card (blackout)
  - Leaderboard sorted by completion count
- **During game (Classic mode)**: Receives real-time **notification queue** when players complete a line. Multiple players queue up per category. Admin verifies each one physically, then either:
  - **Claims** → officially awards that specific line (row-1, col-3, diag-2, etc.). All players see a red rectangle on that line on their card.
  - **Dismisses** → removes from queue without claiming (failed verification).
- **During game (Raffle mode)**: Sees leaderboard of completion counts. No win queue needed — players simply accumulate entries.
- **Closing game (Raffle mode)**: Admin clicks "Close Game" to stop submissions, then draws winners one at a time:
  - Each player's completed box count = their number of raffle entries (weighted random)
  - Free space = 1 entry minimum for everyone who joined
  - Winners are removed from the pool after being drawn (can only win once)
  - All draws are logged with timestamp and entry counts
- **Win categories (Classic)** (14 total): row-1 through row-5, col-1 through col-5, diag-1, diag-2, first5, blackout
- **After game**: Can reset game for another round. All players in lobby/play are automatically returned to the landing page.
- **After game**: Can **export** all player data as structured JSON containing each player's answers, and raffle results (if raffle mode was used). This allows players to stay in touch with the people they interacted with during the event.

---

## 5. Game Flow

### Classic Mode
```
[Admin selects "Classic Bingo" mode] → [Admin loads questions] → [Players join via QR]
       ↓
[Admin clicks "Release Bingo"] → [Players see their randomized cards]
       ↓
[Players mingle & submit answers] → [Completing a line auto-queues notification]
       ↓
[Admin sees queue] → [Verifies player in person] → [Claims or Dismisses]
       ↓
[Claimed win → All players see red rectangle on that line]
       ↓
[Admin resets for next round → Players auto-return to landing page]
```

### Raffle Mode
```
[Admin selects "Raffle Bingo" mode] → [Admin loads questions] → [Players join via QR]
       ↓
[Admin clicks "Release Bingo"] → [Players see their randomized cards]
       ↓
[Players mingle & fill as many boxes as possible] → [Each box = 1 raffle entry]
       ↓
[Admin clicks "Close Game"] → [Players see "Raffle Time!" screen]
       ↓
[Admin clicks "Draw Next Winner" repeatedly] → [Weighted random; winner removed from pool]
       ↓
[All draws logged] → [Included in JSON export]
       ↓
[Admin resets for next round]
```

---

## 6. Data Model (Cosmos DB)

### 6.1 `gameConfig` (single document)
```json
{
  "id": "config",
  "partitionKey": "game",
  "questions": [
    { "id": "q1", "text": "Find someone who has traveled to 3+ countries" },
    { "id": "q2", "text": "Find someone who speaks 3+ languages" }
    // ... 25+ questions
  ],
  "gameState": "lobby" | "active" | "closed" | "ended",
  "gameMode": "classic" | "raffle",
  "adminKey": "shared-secret-here",
  "claimedWins": {
    "row-0": { "claimed": true, "winner": "skamma", "claimedAt": "ISO timestamp" },
    "col-2": { "claimed": true, "winner": "jsmith", "claimedAt": "ISO timestamp" },
    "diag-0": null,
    "first5": null,
    "blackout": null
  },
  "winQueue": [
    { "category": "row-3", "player": "jdoe", "displayName": "Jane Doe", "completedAt": "ISO timestamp" },
    { "category": "col-1", "player": "bwilson", "displayName": "Bob Wilson", "completedAt": "ISO timestamp" }
  ],
  "raffleResults": [
    { "winner": "jdoe", "displayName": "Jane Doe", "entries": 12, "totalPoolEntries": 150, "drawnAt": "ISO timestamp", "drawNumber": 1 }
  ],
  "closedAt": "ISO timestamp",
  "createdAt": "ISO timestamp"
}
```

### 6.2 `players` (one doc per player)
```json
{
  "id": "player-{alias}",
  "partitionKey": "player",
  "alias": "skamma",
  "displayName": "Subbarayudu Kamma",
  "teamName": "Azure Compute",
  "card": [
    { "position": 0, "questionId": "q14", "answer": null, "completedAt": null },
    { "position": 1, "questionId": "q3", "answer": [{"alias": "jsmith", "displayName": "John Smith", "teamName": "Azure Compute"}], "completedAt": "ISO" }
    // ... 25 cells (answer is an array of player objects or null)
  ],
  "joinedAt": "ISO timestamp",
  "completedCount": 5,
  "hasRow": false,
  "hasColumn": false,
  "hasDiagonal": false,
  "hasBlackout": false
}
```

---

## 7. API Endpoints (Azure Functions)

> **Note**: All endpoints require `?playroom=KEY` parameter. Admin endpoints additionally require `?key=ADMIN_KEY`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/join` | Player joins (alias + name + team) → returns card if game active |
| GET | `/api/game-state` | Returns current game state + mode + claimed wins + queue count + raffle results |
| GET | `/api/my-card?alias={alias}` | Returns player's card with current answers + claimed wins |
| POST | `/api/submit-answer` | Submit answer for a cell; auto-notifies admin on line completion (classic mode only) |
| GET | `/api/roster` | Returns all players' names + teams for answer autocomplete |
| GET | `/api/game-admin/players?key={key}` | Admin: list all players + stats |
| GET | `/api/game-admin/dashboard?key={key}` | Admin: completion stats (rows, cols, blackout) |
| POST | `/api/game-admin/release?key={key}` | Admin: change game state to active |
| POST | `/api/game-admin/reset?key={key}` | Admin: reset game (clears mode, raffle results, all players) |
| GET | `/api/game-admin/questions?key={key}` | Admin: get all questions |
| POST | `/api/game-admin/questions?key={key}` | Admin: save questions list |
| POST | `/api/game-admin/set-mode?key={key}` | Admin: set game mode `{mode: "classic"\|"raffle"}` (lobby only) |
| POST | `/api/game-admin/close-game?key={key}` | Admin: close game for raffle drawing (active → closed) |
| POST | `/api/game-admin/draw-raffle?key={key}` | Admin: draw one weighted random winner (closed state only) |
| POST | `/api/game-admin/reset-raffle?key={key}` | Admin: clear all raffle draws to re-draw |
| GET | `/api/game-admin/win-queue?key={key}` | Admin: get pending verification queue (classic mode) |
| POST | `/api/game-admin/claim-win?key={key}` | Admin: verify & claim `{category, winner}` (classic mode) |
| POST | `/api/game-admin/unclaim-win?key={key}` | Admin: unclaim a win `{category}` |
| POST | `/api/game-admin/dismiss-queue-item?key={key}` | Admin: dismiss queue item `{category, player}` |
| GET | `/api/game-admin/export?key={key}` | Admin: export all player answers + raffle results |

---

## 8. Frontend Pages

### 8.1 `/` — Player Entry
- Input: alias, display name, team name
- Button: "Join Game"
- If game not released yet → show "Waiting for admin to start the game…" with player count

### 8.2 `/play` — Bingo Card
- 5×5 grid, mobile-responsive
- Each cell shows question text (truncated, tap to expand)
- Tap unanswered cell → modal with full question + roster search input (only registered players can be selected). Players appear as tags/chips; multiple selections allowed. Each tag has 'x' to remove.
- Tap completed cell → modal showing the selected people as tags (view-only)
- Completed cells turn green with checkmark
- Progress bar showing X/25 completed
- Refresh button + auto-poll every 5s for game state

### 8.3 `/admin` — Admin Dashboard (protected by `?key=`)
- **Lobby tab**: Player count, list of registered players (with team names)
- **Questions tab**: Add/edit/delete questions (need 25 minimum). Import questions from .txt file or paste (one per line, auto-saves). Generate 30 random questions button. "Clear All" button to remove all questions at once.
- **Game Control**: "Release Bingo" / "End Game" / "Reset" buttons
- **Verification Queue**: Shows players who completed a line. Admin can expand "View answers" to see the player's question/answer pairs for that winning line before claiming.
- **Leaderboard tab**:
  - Table: Player | Completed | Row? | Col? | Diagonal? | Blackout?
  - Filters: "Show first 5 done", "Show row completers", etc.
  - Refresh button + auto-poll every 5s

---

## 9. Bingo Win Detection Logic

Given a 5×5 grid (positions 0–24):
- **Row**: positions [0-4], [5-9], [10-14], [15-19], [20-24]
- **Column**: positions [0,5,10,15,20], [1,6,11,16,21], etc.
- **Diagonal**: [0,6,12,18,24], [4,8,12,16,20]
- **Blackout**: all 25 completed

Computed on each answer submission and stored in player doc for fast dashboard queries.

---

## 10. Deployment

### Architecture

- **Frontend**: Azure Static Web Apps (auto-deployed from GitHub on push to `main`)
- **API**: Standalone Azure Function App (Node.js 22, deployed via `func azure functionapp publish`)
- **Database**: Azure Cosmos DB (serverless)

> Azure SWA Free tier does NOT support Azure Functions v4 programming model, so the API is deployed separately.

### Steps

1. Create Azure resources (Cosmos DB, Function App, Static Web App)
2. Configure Function App settings: `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE`, `ADMIN_KEY`, `PLAYROOM_KEY`
3. Deploy API: `cd api && func azure functionapp publish sk-icebreaker-bingo-api`
4. Push to GitHub → frontend auto-deploys via GitHub Actions
5. Configure CORS on Function App to allow SWA origin
6. Generate QR code pointing to app URL with playroom key: `https://your-app.azurestaticapps.net/?playroom=KEY`
7. Share admin URL: `https://your-app.azurestaticapps.net/admin?key=ADMIN_KEY&playroom=PLAYROOM_KEY`

**Estimated build time**: 4–8 hours for a working MVP

---

## 11. Security: Playroom Key

All API endpoints require a `playroom` query parameter to prevent unauthorized access and DDoS attacks on the public-facing app.

- **How it works**: Every API call must include `?playroom=VALUE` matching the `PLAYROOM_KEY` env var on the Function App
- **Frontend behavior**: Extracts `playroom` from the initial URL, stores in localStorage, attaches to all API calls automatically
- **Rejection**: Requests without a valid playroom key receive `403 Forbidden`
- **Local dev**: If `PLAYROOM_KEY` is not set, validation is skipped (all requests allowed)
- **QR code**: The playroom value should be embedded in the QR code URL so players don't need to know it

This effectively creates isolated "playrooms" — only users with the correct key can interact with the game.

---

## 12. Open Questions

1. Should players be able to change their answer after submitting for a cell? Ans : No
2. Is there a free center square (like traditional bingo)? Ans : Sure
3. Should the admin be able to see what answers players submitted (for validation)? Ans : Yes
4. Do you want the app deployed under a custom domain or is the default Azure URL fine? Ans : Default domain is fine. We'll have a QR code and an alias to redirect
