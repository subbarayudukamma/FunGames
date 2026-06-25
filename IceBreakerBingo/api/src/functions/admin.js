const { app } = require("@azure/functions");
const { ensureInitialized, updateConfig } = require("./cosmosClient");
const { generateCard } = require("./bingoLogic");
const { validatePlayroom, playroomDenied } = require("./playroom");

// Admin middleware helper
function validateAdmin(request) {
  const key = request.query.get("key");
  const adminKey = process.env.ADMIN_KEY || "bingo-admin-2026";
  return key === adminKey;
}

// GET /api/admin/players
app.http("adminPlayers", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game-admin/players",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { playersContainer } = await ensureInitialized();
      const { resources: players } = await playersContainer.items
        .query("SELECT c.alias, c.displayName, c.teamName, c.joinedAt, c.completedCount, c.hasRow, c.hasColumn, c.hasDiagonal, c.hasBlackout FROM c WHERE c.partitionKey = 'player'")
        .fetchAll();

      return { status: 200, jsonBody: { players, count: players.length } };
    } catch (error) {
      context.log("Error in adminPlayers:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// GET /api/admin/dashboard
app.http("adminDashboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game-admin/dashboard",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { playersContainer } = await ensureInitialized();
      const { resources: players } = await playersContainer.items
        .query("SELECT c.alias, c.displayName, c.teamName, c.completedCount, c.score, c.hasRow, c.hasColumn, c.hasDiagonal, c.hasBlackout, c.card, c.completedRows, c.completedColumns, c.completedDiagonals, c.extraRaffleEntries FROM c WHERE c.partitionKey = 'player' ORDER BY c.completedCount DESC")
        .fetchAll();

      const stats = {
        totalPlayers: players.length,
        first5Done: players.filter((p) => p.completedCount >= 5).map((p) => ({ alias: p.alias, displayName: p.displayName, completedCount: p.completedCount })),
        rowCompleters: players.filter((p) => p.hasRow).map((p) => ({ alias: p.alias, displayName: p.displayName })),
        columnCompleters: players.filter((p) => p.hasColumn).map((p) => ({ alias: p.alias, displayName: p.displayName })),
        diagonalCompleters: players.filter((p) => p.hasDiagonal).map((p) => ({ alias: p.alias, displayName: p.displayName })),
        blackoutCompleters: players.filter((p) => p.hasBlackout).map((p) => ({ alias: p.alias, displayName: p.displayName })),
        leaderboard: players.map((p) => ({
          alias: p.alias,
          displayName: p.displayName,
          teamName: p.teamName || '',
          completedCount: p.completedCount,
          score: p.score ?? p.completedCount ?? 1,
          hasRow: p.hasRow,
          hasColumn: p.hasColumn,
          hasDiagonal: p.hasDiagonal,
          hasBlackout: p.hasBlackout,
          completedRows: p.completedRows || [],
          completedColumns: p.completedColumns || [],
          completedDiagonals: p.completedDiagonals || [],
          extraRaffleEntries: p.extraRaffleEntries || 0,
          card: p.card,
        })),
      };

      return { status: 200, jsonBody: stats };
    } catch (error) {
      context.log("Error in adminDashboard:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// POST /api/admin/release
app.http("adminRelease", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/release",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { playersContainer } = await ensureInitialized();

      const { config, result } = await updateConfig((cfg) => {
        if ((cfg.questions || []).length < 24) {
          return { abort: true, error: "Need at least 24 questions (25th is free space)" };
        }
        cfg.gameState = "active";
        return {};
      });
      if (result.error) {
        return { status: 400, jsonBody: { error: result.error } };
      }

      // Generate cards for all players who joined during lobby
      const { resources: players } = await playersContainer.items
        .query("SELECT * FROM c WHERE c.partitionKey = 'player'")
        .fetchAll();

      for (const player of players) {
        if (player.card.length === 0) {
          player.card = generateCard(config.questions);
          player.completedCount = 1; // free space
          player.score = 1; // base raffle entry (free space)
          await playersContainer.item(player.id, "player").replace(player);
        }
      }

      return { status: 200, jsonBody: { message: "Game released!", gameState: "active" } };
    } catch (error) {
      context.log("Error in adminRelease:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// POST /api/admin/reset
app.http("adminReset", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/reset",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { playersContainer } = await ensureInitialized();

      // Reset game state
      await updateConfig((cfg) => {
        cfg.gameState = "lobby";
        cfg.gameMode = "raffle";
        cfg.claimedWins = {};
        cfg.winQueue = [];
        cfg.raffleResults = [];
      });

      // Delete all players
      const { resources: players } = await playersContainer.items
        .query("SELECT c.id FROM c WHERE c.partitionKey = 'player'")
        .fetchAll();

      for (const player of players) {
        await playersContainer.item(player.id, "player").delete();
      }

      return { status: 200, jsonBody: { message: "Game reset!", gameState: "lobby" } };
    } catch (error) {
      context.log("Error in adminReset:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// GET /api/admin/questions
app.http("adminGetQuestions", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game-admin/questions",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { gameContainer } = await ensureInitialized();
      const { resource: config } = await gameContainer.item("config", "game").read();

      return { status: 200, jsonBody: { questions: config.questions } };
    } catch (error) {
      context.log("Error in adminGetQuestions:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// POST /api/admin/questions
app.http("adminSaveQuestions", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/questions",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { questions } = await request.json();

      if (!Array.isArray(questions)) {
        return { status: 400, jsonBody: { error: "questions must be an array" } };
      }

      const { config } = await updateConfig((cfg) => {
        cfg.questions = questions.map((q, i) => ({
          id: q.id || `q${i + 1}`,
          text: q.text,
        }));
      });

      return { status: 200, jsonBody: { message: "Questions saved", count: config.questions.length } };
    } catch (error) {
      context.log("Error in adminSaveQuestions:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// POST /api/game-admin/claim-win
// Admin claims a specific win (e.g., row-0, col-2, diag-1, first5, blackout)
app.http("adminClaimWin", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/claim-win",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { category, winner } = await request.json();

      if (!category || !winner) {
        return { status: 400, jsonBody: { error: "category and winner are required" } };
      }

      const { config } = await updateConfig((cfg) => {
        if (!cfg.claimedWins) {
          cfg.claimedWins = {};
        }

        cfg.claimedWins[category] = {
          claimed: true,
          winner: winner,
          claimedAt: new Date().toISOString(),
        };

        // Remove from queue
        if (cfg.winQueue) {
          cfg.winQueue = cfg.winQueue.filter(
            (n) => !(n.category === category && n.player === winner)
          );
        }
      });

      return { status: 200, jsonBody: { message: `${category} claimed by ${winner}`, claimedWins: config.claimedWins } };
    } catch (error) {
      context.log("Error in adminClaimWin:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// POST /api/game-admin/unclaim-win
// Admin unclaims a specific win
app.http("adminUnclaimWin", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/unclaim-win",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { category } = await request.json();

      const { config } = await updateConfig((cfg) => {
        if (cfg.claimedWins && cfg.claimedWins[category]) {
          delete cfg.claimedWins[category];
        }
      });

      return { status: 200, jsonBody: { message: `${category} unclaimed`, claimedWins: config.claimedWins || {} } };
    } catch (error) {
      context.log("Error in adminUnclaimWin:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// GET /api/game-admin/win-queue
// Admin gets the pending win notification queue with player answers for each winning line
app.http("adminWinQueue", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game-admin/win-queue",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { gameContainer, playersContainer } = await ensureInitialized();
      const { resource: config } = await gameContainer.item("config", "game").read();
      const questions = config.questions || [];

      const winQueue = config.winQueue || [];

      // For each queue item, fetch player card and extract answers for the winning line
      const enrichedQueue = [];
      const playerCache = {};

      for (const item of winQueue) {
        const playerId = `player-${item.player}`;
        if (!playerCache[item.player]) {
          const { resource: player } = await playersContainer.item(playerId, "player").read();
          playerCache[item.player] = player;
        }
        const player = playerCache[item.player];
        const card = player?.card || [];

        // Determine which positions make up this winning line
        const positions = getPositionsForCategory(item.category);
        const answers = positions.map(pos => {
          const cell = card.find(c => c.position === pos);
          const question = questions.find(q => q.id === cell?.questionId);
          return {
            position: pos,
            question: question?.text || cell?.questionText || '(unknown)',
            answer: cell?.answer || null,
          };
        });

        enrichedQueue.push({ ...item, answers });
      }

      return {
        status: 200,
        jsonBody: {
          winQueue: enrichedQueue,
          claimedWins: config.claimedWins || {},
        },
      };
    } catch (error) {
      context.log("Error in adminWinQueue:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// Helper: get cell positions for a win category
function getPositionsForCategory(category) {
  const ROWS = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24]];
  const COLS = [[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24]];
  const DIAGS = [[0,6,12,18,24],[4,8,12,16,20]];

  if (category === 'first5') return Array.from({length: 25}, (_, i) => i); // all cells (admin sees all)
  if (category === 'blackout') return Array.from({length: 25}, (_, i) => i);
  if (category.startsWith('row-')) return ROWS[parseInt(category.split('-')[1])] || [];
  if (category.startsWith('col-')) return COLS[parseInt(category.split('-')[1])] || [];
  if (category.startsWith('diag-')) return DIAGS[parseInt(category.split('-')[1])] || [];
  return [];
}

// POST /api/game-admin/dismiss-queue-item
// Admin dismisses a queue item (reject without claiming)
app.http("adminDismissQueueItem", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/dismiss-queue-item",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { category, player } = await request.json();

      const { config } = await updateConfig((cfg) => {
        if (cfg.winQueue) {
          cfg.winQueue = cfg.winQueue.filter(
            (n) => !(n.category === category && n.player === player)
          );
        }
      });

      return { status: 200, jsonBody: { message: "Queue item dismissed", winQueue: config.winQueue } };
    } catch (error) {
      context.log("Error in adminDismissQueueItem:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// GET /api/game-admin/export — Export all player data (answers + contacts)
app.http("adminExport", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game-admin/export",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { gameContainer, playersContainer } = await ensureInitialized();

      // Get questions for mapping IDs to text
      const { resource: config } = await gameContainer.item("config", "game").read();
      const questionMap = {};
      (config.questions || []).forEach(q => { questionMap[q.id] = q.text; });

      // Get all players with full card data
      const { resources: players } = await playersContainer.items
        .query("SELECT c.alias, c.displayName, c.teamName, c.card, c.completedCount, c.score, c.extraRaffleEntries, c.joinedAt FROM c WHERE c.partitionKey = 'player'")
        .fetchAll();

      // Build export: each player gets their answers with question text + structured connections
      const exportData = players.map(p => ({
        alias: p.alias,
        displayName: p.displayName,
        teamName: p.teamName || '',
        completedCount: p.completedCount || 0,
        score: p.score ?? p.completedCount ?? 0,
        extraRaffleEntries: p.extraRaffleEntries || 0,
        totalRaffleEntries: (p.score ?? p.completedCount ?? 0) + (p.extraRaffleEntries || 0),
        joinedAt: p.joinedAt,
        answers: (p.card || [])
          .filter(cell => cell.answer)
          .map(cell => ({
            question: questionMap[cell.questionId] || cell.questionId,
            answer: cell.answer,
            completedAt: cell.completedAt,
          })),
      }));

      // Build connections map: for each pair of connected players, record the question that connects them
      const connections = [];
      for (const player of exportData) {
        for (const ans of player.answers) {
          if (Array.isArray(ans.answer)) {
            for (const person of ans.answer) {
              connections.push({
                player1: { alias: player.alias, displayName: player.displayName, teamName: player.teamName },
                player2: { alias: person.alias, displayName: person.displayName, teamName: person.teamName || '' },
                question: ans.question,
                completedAt: ans.completedAt,
              });
            }
          }
        }
      }

      // Build raffle winners in draw order
      const raffleWinners = (config.raffleResults || [])
        .sort((a, b) => (a.drawNumber || 0) - (b.drawNumber || 0))
        .map(r => ({
          drawNumber: r.drawNumber,
          alias: r.winner,
          displayName: r.displayName,
          teamName: r.teamName || '',
          entries: r.entries,
          totalPoolEntries: r.totalPoolEntries,
          drawnAt: r.drawnAt,
        }));

      return { status: 200, jsonBody: { players: exportData, connections, gameMode: config.gameMode || 'raffle', raffleResults: config.raffleResults || [], raffleWinners, exportedAt: new Date().toISOString() } };
    } catch (error) {
      context.log("Error in adminExport:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// GET /api/game-admin/player-answers?alias=... — A single player's questions + answers
// Used by admin to spot-check a raffle winner's connections in person.
app.http("adminPlayerAnswers", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game-admin/player-answers",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const alias = request.query.get("alias");
      if (!alias) {
        return { status: 400, jsonBody: { error: "alias is required" } };
      }

      const { gameContainer, playersContainer } = await ensureInitialized();

      const { resource: config } = await gameContainer.item("config", "game").read();
      const questionMap = {};
      (config.questions || []).forEach(q => { questionMap[q.id] = q.text; });

      const { resources: matches } = await playersContainer.items
        .query({
          query: "SELECT c.alias, c.displayName, c.teamName, c.card FROM c WHERE c.partitionKey = 'player' AND c.alias = @alias",
          parameters: [{ name: "@alias", value: alias }],
        })
        .fetchAll();

      if (matches.length === 0) {
        return { status: 404, jsonBody: { error: "Player not found" } };
      }

      const p = matches[0];
      const answers = (p.card || [])
        .filter(cell => cell.answer && cell.questionId !== "free")
        .map(cell => ({
          question: questionMap[cell.questionId] || cell.questionText || cell.questionId,
          answer: cell.answer,
          completedAt: cell.completedAt,
        }));

      return {
        status: 200,
        jsonBody: {
          alias: p.alias,
          displayName: p.displayName,
          teamName: p.teamName || '',
          answers,
        },
      };
    } catch (error) {
      context.log("Error in adminPlayerAnswers:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// POST /api/game-admin/set-mode
app.http("adminSetMode", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/set-mode",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { mode } = await request.json();

      if (!["classic", "raffle"].includes(mode)) {
        return { status: 400, jsonBody: { error: "mode must be 'classic' or 'raffle'" } };
      }

      const { result } = await updateConfig((cfg) => {
        if (cfg.gameState !== "lobby") {
          return { abort: true, error: "Game mode can only be changed in lobby state" };
        }
        cfg.gameMode = mode;
        return {};
      });
      if (result.error) {
        return { status: 400, jsonBody: { error: result.error } };
      }

      return { status: 200, jsonBody: { message: `Game mode set to ${mode}`, gameMode: mode } };
    } catch (error) {
      context.log("Error in adminSetMode:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// POST /api/game-admin/close-game
app.http("adminCloseGame", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/close-game",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { result } = await updateConfig((cfg) => {
        if (cfg.gameState !== "active") {
          return { abort: true, error: "Game can only be closed from active state" };
        }
        cfg.gameState = "closed";
        cfg.closedAt = new Date().toISOString();
        // Start the raffle for this round fresh — clear any winners drawn in a
        // previous round so stale winners (whose player records may no longer
        // exist) don't carry over into the new draw.
        cfg.raffleResults = [];
        return {};
      });
      if (result.error) {
        return { status: 400, jsonBody: { error: result.error } };
      }

      return { status: 200, jsonBody: { message: "Game closed! Ready for raffle draw.", gameState: "closed" } };
    } catch (error) {
      context.log("Error in adminCloseGame:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// POST /api/game-admin/draw-raffle
app.http("adminDrawRaffle", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/draw-raffle",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { playersContainer } = await ensureInitialized();

      // Get all players (read once; the draw itself happens inside the
      // optimistic-concurrency update so it re-runs safely on conflict).
      const { resources: players } = await playersContainer.items
        .query("SELECT c.alias, c.displayName, c.teamName, c.completedCount, c.score, c.extraRaffleEntries FROM c WHERE c.partitionKey = 'player'")
        .fetchAll();

      const { result } = await updateConfig((cfg) => {
        if (cfg.gameState !== "closed") {
          return { abort: true, error: "Game must be closed before drawing raffle winners" };
        }

        if (!cfg.raffleResults) cfg.raffleResults = [];

        // Exclude previous winners
        const previousWinners = new Set(cfg.raffleResults.map(r => r.winner));
        const eligiblePlayers = players.filter(p => !previousWinners.has(p.alias));

        if (eligiblePlayers.length === 0) {
          return { abort: true, error: "No eligible players remaining in the pool" };
        }

        // Build weighted pool (bingo score + extra entries)
        const pool = [];
        for (const player of eligiblePlayers) {
          const bingoEntries = player.score ?? player.completedCount ?? 1;
          const extraEntries = player.extraRaffleEntries || 0;
          const totalEntries = bingoEntries + extraEntries;
          for (let i = 0; i < totalEntries; i++) {
            pool.push(player);
          }
        }

        // Draw random winner
        const winnerIndex = Math.floor(Math.random() * pool.length);
        const winner = pool[winnerIndex];

        const drawResult = {
          winner: winner.alias,
          displayName: winner.displayName,
          teamName: winner.teamName || '',
          entries: (winner.score ?? winner.completedCount ?? 1) + (winner.extraRaffleEntries || 0),
          totalPoolEntries: pool.length,
          drawnAt: new Date().toISOString(),
          drawNumber: cfg.raffleResults.length + 1,
        };

        cfg.raffleResults.push(drawResult);
        return { drawResult, remainingPlayers: eligiblePlayers.length - 1 };
      });

      if (result.error) {
        return { status: 400, jsonBody: { error: result.error } };
      }

      return {
        status: 200,
        jsonBody: {
          ...result.drawResult,
          remainingPlayers: result.remainingPlayers,
          totalPlayers: players.length,
        },
      };
    } catch (error) {
      context.log("Error in adminDrawRaffle:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// POST /api/game-admin/reset-raffle
app.http("adminResetRaffle", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/reset-raffle",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      await updateConfig((cfg) => {
        cfg.raffleResults = [];
      });

      return { status: 200, jsonBody: { message: "Raffle results cleared", raffleResults: [] } };
    } catch (error) {
      context.log("Error in adminResetRaffle:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// POST /api/game-admin/add-raffle-entries
// Admin adds extra raffle entries for specific players
app.http("adminAddRaffleEntries", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/add-raffle-entries",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { entries, players } = await request.json();

      if (!entries || typeof entries !== 'number' || entries < 1) {
        return { status: 400, jsonBody: { error: "entries must be a positive number" } };
      }
      if (!Array.isArray(players) || players.length === 0) {
        return { status: 400, jsonBody: { error: "players must be a non-empty array of aliases" } };
      }

      const { playersContainer } = await ensureInitialized();

      const updated = [];
      for (const alias of players) {
        try {
          const playerId = `player-${alias}`;
          const { resource: player } = await playersContainer.item(playerId, "player").read();
          if (!player) continue;

          player.extraRaffleEntries = (player.extraRaffleEntries || 0) + entries;
          await playersContainer.item(playerId, "player").replace(player);
          updated.push({ alias, displayName: player.displayName, extraRaffleEntries: player.extraRaffleEntries });
        } catch (e) {
          if (e.code === 404) continue;
          throw e;
        }
      }

      return { status: 200, jsonBody: { message: `Added ${entries} extra raffle entries to ${updated.length} players`, updated } };
    } catch (error) {
      context.log("Error in adminAddRaffleEntries:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// POST /api/game-admin/claim-session
// Admin claims the active session (only one admin can be active at a time)
app.http("adminClaimSession", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/claim-session",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { name, sessionId } = await request.json();

      if (!name || !sessionId) {
        return { status: 400, jsonBody: { error: "name and sessionId are required" } };
      }

      const { config } = await updateConfig((cfg) => {
        // Track all admin logins
        if (!cfg.adminSessions) cfg.adminSessions = [];
        // Remove existing entry for this sessionId
        cfg.adminSessions = cfg.adminSessions.filter(s => s.sessionId !== sessionId);
        cfg.adminSessions.push({ name, sessionId, lastSeen: new Date().toISOString() });
        // Clean stale sessions (older than 2 minutes)
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        cfg.adminSessions = cfg.adminSessions.filter(s => s.lastSeen > twoMinAgo);

        // Set active admin
        cfg.activeAdmin = { name, sessionId, claimedAt: new Date().toISOString() };
      });

      return {
        status: 200,
        jsonBody: {
          message: `Admin session claimed by ${name}`,
          activeAdmin: config.activeAdmin,
          adminCount: config.adminSessions.length,
          adminNames: config.adminSessions.map(s => s.name),
        },
      };
    } catch (error) {
      context.log("Error in adminClaimSession:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// GET /api/game-admin/session
// Check current admin session status
app.http("adminGetSession", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game-admin/session",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const sessionId = request.query.get("sessionId");

      const { config } = await updateConfig((cfg) => {
        // Update lastSeen for this session
        if (sessionId && cfg.adminSessions) {
          const session = cfg.adminSessions.find(s => s.sessionId === sessionId);
          if (session) {
            session.lastSeen = new Date().toISOString();
            // Clean stale sessions
            const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
            cfg.adminSessions = cfg.adminSessions.filter(s => s.lastSeen > twoMinAgo);
            return {};
          }
        }
        // Nothing to update — skip the write to avoid needless contention.
        return { abort: true };
      });

      return {
        status: 200,
        jsonBody: {
          activeAdmin: config.activeAdmin || null,
          adminCount: (config.adminSessions || []).length,
          adminNames: (config.adminSessions || []).map(s => s.name),
          isActive: config.activeAdmin?.sessionId === sessionId,
        },
      };
    } catch (error) {
      context.log("Error in adminGetSession:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});
