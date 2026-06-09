# Icebreaker Bingo 🎯

A mobile-first web app for team icebreaker bingo at events. Players scan a QR code, enter their alias/name/team, and play bingo by finding colleagues who match specific questions.

## Tech Stack

- **Frontend**: React (Vite) - Mobile-first SPA
- **Backend**: Azure Functions (Node.js v4 programming model)
- **Database**: Azure Cosmos DB (Serverless tier)
- **Hosting**: Azure Static Web Apps

## Project Structure

```
Cruise2026/
├── frontend/          # React Vite app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── PlayerEntry.jsx   # Join game page
│   │   │   ├── Play.jsx          # Bingo card page
│   │   │   └── Admin.jsx         # Admin dashboard
│   │   ├── api.js                # API client
│   │   ├── App.jsx               # Router
│   │   └── App.css               # Styles
│   └── public/
│       └── staticwebapp.config.json
├── api/               # Azure Functions
│   ├── src/functions/
│   │   ├── join.js              # POST /api/join
│   │   ├── gameState.js         # GET /api/game-state
│   │   ├── myCard.js            # GET /api/my-card
│   │   ├── submitAnswer.js      # POST /api/submit-answer
│   │   ├── roster.js            # GET /api/roster (autocomplete)
│   │   ├── admin.js             # All admin endpoints (/api/game-admin/*)
│   │   ├── bingoLogic.js        # Win detection
│   │   └── cosmosClient.js      # DB connection
│   ├── host.json
│   └── local.settings.json
└── swa-cli.config.json
```

## Local Development

### Prerequisites

- Node.js 18+
- [Azure Functions Core Tools v4](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) — install with `npm install -g azure-functions-core-tools@4`
- [Azure Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/) (optional)
- Azure Cosmos DB account (or use the emulator)

### Setup

1. **Configure Cosmos DB** — Update `api/local.settings.json` with your Cosmos DB endpoint and key:
   ```json
   {
     "Values": {
       "COSMOS_ENDPOINT": "https://your-account.documents.azure.com:443/",
       "COSMOS_KEY": "your-key-here",
       "COSMOS_DATABASE": "icebreaker-bingo",
       "ADMIN_KEY": "your-secret-admin-key"
     }
   }
   ```

2. **Install dependencies**:
   ```bash
   cd frontend && npm install
   cd ../api && npm install
   ```

3. **Run locally** (two terminals):
   ```bash
   # Terminal 1: Frontend
   cd frontend && npm run dev

   # Terminal 2: API
   cd api && func start
   ```

   Or use SWA CLI:
   ```bash
   npx swa start
   ```

4. **Access the app**:
   - Player: http://localhost:5173
   - Admin: http://localhost:5173/admin?key=bingo-admin-2026

## Deployment to Azure

1. Create a resource group:
   ```bash
   az group create -n rg-icebreaker-bingo -l westus2
   ```

2. Create Cosmos DB (serverless):
   ```bash
   az cosmosdb create -n cosmos-icebreaker -g rg-icebreaker-bingo --capabilities EnableServerless
   az cosmosdb sql database create -a cosmos-icebreaker -g rg-icebreaker-bingo -n icebreaker-bingo
   az cosmosdb sql container create -a cosmos-icebreaker -g rg-icebreaker-bingo -d icebreaker-bingo -n game -p /partitionKey
   az cosmosdb sql container create -a cosmos-icebreaker -g rg-icebreaker-bingo -d icebreaker-bingo -n players -p /partitionKey
   ```

3. Deploy Static Web App:
   ```bash
   az staticwebapp create -n sk-icebreaker-bingo -g maps-skamma
   npx swa login --resource-group maps-skamma --app-name sk-icebreaker-bingo
   npx swa deploy --app-location frontend --output-location dist --api-location api

npx swa deploy  --app-location frontend --output-location dist --api-location api --resource-group maps-skamma --app-name sk-icebreaker-bingo
   ```

4. Set app settings in Azure portal with Cosmos connection string and ADMIN_KEY.

5. Generate QR code pointing to your app URL and share!

## Game Flow

1. Admin loads questions at `/admin?key=SECRET` (type, generate, or import from file/paste)
2. Players join via QR code → enter alias + name + team
3. Admin clicks "Release Bingo" → players see randomized 5×5 cards
4. Players mingle and submit answers (autocomplete suggests participant names)
5. Completing a line (row/col/diagonal/first5/blackout) auto-notifies admin
6. Admin sees verification queue → verifies player in person
7. Admin clicks "Claim" → all players see red rectangle on that specific line
8. Players focus on unclaimed lines; repeat until game ends

## Features

- ✅ 5×5 bingo grid with free center square
- ✅ Randomized card per player
- ✅ Real-time progress via 5-second polling
- ✅ Per-line win detection — 5 rows, 5 columns, 2 diagonals, first 5, blackout (14 categories)
- ✅ **Notification queue** — players auto-queue when completing a line
- ✅ **Admin verification flow** — verify in person, then claim or dismiss
- ✅ Claimed lines shown with red rectangle + dimmed on all players' cards
- ✅ Admin dashboard with leaderboard
- ✅ **Team name** — players enter their team on join, visible in admin lobby
- ✅ **Answer autocomplete** — suggests participant names from roster as you type (with team info), also allows free-text entry
- ✅ **Question import** — import from .txt file or paste (one question per line)
- ✅ **Post-game export** — admin can export all player answers as structured JSON so participants can stay in touch with people they met
- ✅ Generate 30 random placeholder questions with one click
- ✅ Game reset automatically returns all players to the landing page
- ✅ Mobile-responsive design
- ✅ No answer changes after submission
