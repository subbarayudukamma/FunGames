# Icebreaker Bingo 🎯

A mobile-first web app for team icebreaker bingo at events. Players scan a QR code, enter their alias/name/team, and play bingo by finding colleagues who match specific questions.

## Tech Stack

- **Frontend**: React (Vite) - Mobile-first SPA
- **Backend**: Azure Functions (Node.js v4 programming model, standalone Function App)
- **Database**: Azure Cosmos DB (Serverless tier)
- **Hosting**: Azure Static Web Apps (frontend) + Azure Function App (API)

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

This app uses a **split deployment architecture**:
- **Frontend** → Azure Static Web Apps (auto-deployed via GitHub Actions on push to `main`)
- **API** → Standalone Azure Function App (deployed manually via Azure Functions Core Tools)

> **Why split?** Azure SWA Free tier's managed functions do NOT support Azure Functions v4 Node.js programming model. The API must be deployed as a standalone Function App.

### Prerequisites

- Azure CLI (`az`) logged in
- Azure Functions Core Tools v4 (`func`)
- GitHub repo connected to SWA for CI/CD

### Initial Setup

1. **Create resources** (if not already done):
   ```bash
   az group create -n maps-skamma -l westus2
   az cosmosdb create -n sk-icebreaker-bingo -g maps-skamma --capabilities EnableServerless
   az cosmosdb sql database create -a sk-icebreaker-bingo -g maps-skamma -n icebreaker-bingo
   az functionapp create -n sk-icebreaker-bingo-api -g maps-skamma --consumption-plan-location westus2 \
     --runtime node --runtime-version 22 --functions-version 4 --os-type Linux \
     --storage-account skicebreakersa
   az staticwebapp create -n sk-icebreaker-bingo-v2 -g maps-skamma
   ```

2. **Configure Function App settings**:
   ```bash
   az functionapp config appsettings set --name sk-icebreaker-bingo-api --resource-group maps-skamma --settings \
     "COSMOS_ENDPOINT=https://sk-icebreaker-bingo.documents.azure.com:443/" \
     "COSMOS_KEY=<your-cosmos-key>" \
     "COSMOS_DATABASE=icebreaker-bingo" \
     "ADMIN_KEY=<your-admin-key>" \
     "PLAYROOM_KEY=<your-playroom-key>"
   ```

3. **Configure CORS on Function App** (Azure Portal or CLI):
   - Allow origins: your SWA URL (e.g. `https://gray-plant-07dcf4b1e.7.azurestaticapps.net`), `http://localhost:5173`

### Deploying the API

```bash
cd IceBreakerBingo/api
func azure functionapp publish sk-icebreaker-bingo-api
```

### Deploying the Frontend

Frontend deploys automatically via GitHub Actions when you push to `main`. The workflow file is at `.github/workflows/azure-static-web-apps-gray-plant-07dcf4b1e.yml`.

To trigger a manual deployment:
1. Push a commit to `main`, OR
2. Go to GitHub → Actions → select the workflow → "Run workflow"

### GitHub Actions Workflow

The workflow uses `Azure/static-web-apps-deploy@v1` with:
- `app_location: "./IceBreakerBingo/frontend"`
- `api_location: ""` (API deployed separately)
- `output_location: "dist"`

## Playroom Security

To prevent unauthorized access and potential abuse of the public endpoints, the app uses a **playroom key** system:

- All API endpoints require a `?playroom=VALUE` query parameter
- The value must match the `PLAYROOM_KEY` environment variable set on the Function App
- Requests without a valid playroom key receive a `403 Forbidden` response
- The playroom key is NOT stored in source code — it's configured only in Azure

### How it works

1. The admin shares a URL like: `https://your-app.azurestaticapps.net/?playroom=YOUR_KEY`
2. The frontend extracts the `playroom` param and stores it in localStorage
3. All subsequent API calls automatically include the playroom parameter
4. Admin URL format: `/admin?key=ADMIN_KEY&playroom=PLAYROOM_KEY`

### Configuration

Set the key in Azure Function App settings:
```bash
az functionapp config appsettings set --name sk-icebreaker-bingo-api \
  --resource-group maps-skamma --settings "PLAYROOM_KEY=YourSecretValue"
```

For local development: if `PLAYROOM_KEY` is not set in `local.settings.json`, all requests pass through without validation.

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
- ✅ **Question import** — import from .txt file or paste (one question per line, auto-saves immediately). "Clear All" button to remove all questions.
- ✅ **Answer verification** — admin can expand win queue items to view the player's answers for the winning line before claiming
- ✅ **View submitted answers** — players can tap completed cells to see what they entered
- ✅ **Post-game export** — admin can export all player answers as structured JSON so participants can stay in touch with people they met
- ✅ Generate 30 random placeholder questions with one click
- ✅ Game reset automatically returns all players to the landing page
- ✅ Mobile-responsive design
- ✅ No answer changes after submission
- ✅ **Playroom key** — mandatory query parameter prevents unauthorized access / DDoS; key configured in Azure, not in source
