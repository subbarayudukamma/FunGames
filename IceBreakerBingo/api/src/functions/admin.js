const { app } = require("@azure/functions");
const { ensureInitialized } = require("./cosmosClient");
const { generateCard } = require("./bingoLogic");

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
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { playersContainer } = await ensureInitialized();
      const { resources: players } = await playersContainer.items
        .query("SELECT c.alias, c.displayName, c.completedCount, c.hasRow, c.hasColumn, c.hasDiagonal, c.hasBlackout, c.card, c.completedRows, c.completedColumns, c.completedDiagonals FROM c WHERE c.partitionKey = 'player' ORDER BY c.completedCount DESC")
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
          completedCount: p.completedCount,
          hasRow: p.hasRow,
          hasColumn: p.hasColumn,
          hasDiagonal: p.hasDiagonal,
          hasBlackout: p.hasBlackout,
          completedRows: p.completedRows || [],
          completedColumns: p.completedColumns || [],
          completedDiagonals: p.completedDiagonals || [],
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
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { gameContainer, playersContainer } = await ensureInitialized();
      const { resource: config } = await gameContainer.item("config", "game").read();

      if (config.questions.length < 24) {
        return { status: 400, jsonBody: { error: "Need at least 24 questions (25th is free space)" } };
      }

      config.gameState = "active";
      await gameContainer.item("config", "game").replace(config);

      // Generate cards for all players who joined during lobby
      const { resources: players } = await playersContainer.items
        .query("SELECT * FROM c WHERE c.partitionKey = 'player'")
        .fetchAll();

      for (const player of players) {
        if (player.card.length === 0) {
          player.card = generateCard(config.questions);
          player.completedCount = 1; // free space
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
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { gameContainer, playersContainer } = await ensureInitialized();

      // Reset game state
      const { resource: config } = await gameContainer.item("config", "game").read();
      config.gameState = "lobby";
      config.claimedWins = {};
      config.winQueue = [];
      await gameContainer.item("config", "game").replace(config);

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
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { questions } = await request.json();

      if (!Array.isArray(questions)) {
        return { status: 400, jsonBody: { error: "questions must be an array" } };
      }

      const { gameContainer } = await ensureInitialized();
      const { resource: config } = await gameContainer.item("config", "game").read();

      config.questions = questions.map((q, i) => ({
        id: q.id || `q${i + 1}`,
        text: q.text,
      }));

      await gameContainer.item("config", "game").replace(config);

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
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { category, winner } = await request.json();

      if (!category || !winner) {
        return { status: 400, jsonBody: { error: "category and winner are required" } };
      }

      const { gameContainer } = await ensureInitialized();
      const { resource: config } = await gameContainer.item("config", "game").read();

      if (!config.claimedWins) {
        config.claimedWins = {};
      }

      config.claimedWins[category] = {
        claimed: true,
        winner: winner,
        claimedAt: new Date().toISOString(),
      };

      // Remove from queue
      if (config.winQueue) {
        config.winQueue = config.winQueue.filter(
          (n) => !(n.category === category && n.player === winner)
        );
      }

      await gameContainer.item("config", "game").replace(config);

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
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { category } = await request.json();

      const { gameContainer } = await ensureInitialized();
      const { resource: config } = await gameContainer.item("config", "game").read();

      if (config.claimedWins && config.claimedWins[category]) {
        delete config.claimedWins[category];
      }

      await gameContainer.item("config", "game").replace(config);

      return { status: 200, jsonBody: { message: `${category} unclaimed`, claimedWins: config.claimedWins || {} } };
    } catch (error) {
      context.log("Error in adminUnclaimWin:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// GET /api/game-admin/win-queue
// Admin gets the pending win notification queue
app.http("adminWinQueue", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game-admin/win-queue",
  handler: async (request, context) => {
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { gameContainer } = await ensureInitialized();
      const { resource: config } = await gameContainer.item("config", "game").read();

      return {
        status: 200,
        jsonBody: {
          winQueue: config.winQueue || [],
          claimedWins: config.claimedWins || {},
        },
      };
    } catch (error) {
      context.log("Error in adminWinQueue:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});

// POST /api/game-admin/dismiss-queue-item
// Admin dismisses a queue item (reject without claiming)
app.http("adminDismissQueueItem", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "game-admin/dismiss-queue-item",
  handler: async (request, context) => {
    if (!validateAdmin(request)) {
      return { status: 401, jsonBody: { error: "Invalid admin key" } };
    }

    try {
      const { category, player } = await request.json();

      const { gameContainer } = await ensureInitialized();
      const { resource: config } = await gameContainer.item("config", "game").read();

      if (config.winQueue) {
        config.winQueue = config.winQueue.filter(
          (n) => !(n.category === category && n.player === player)
        );
      }

      await gameContainer.item("config", "game").replace(config);

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
        .query("SELECT c.alias, c.displayName, c.teamName, c.card, c.completedCount, c.joinedAt FROM c WHERE c.partitionKey = 'player'")
        .fetchAll();

      // Build export: each player gets their answers with question text + who they wrote
      const exportData = players.map(p => ({
        alias: p.alias,
        displayName: p.displayName,
        teamName: p.teamName || '',
        completedCount: p.completedCount || 0,
        joinedAt: p.joinedAt,
        answers: (p.card || [])
          .filter(cell => cell.answer)
          .map(cell => ({
            question: questionMap[cell.questionId] || cell.questionId,
            answer: cell.answer,
            completedAt: cell.completedAt,
          })),
      }));

      return { status: 200, jsonBody: { players: exportData, exportedAt: new Date().toISOString() } };
    } catch (error) {
      context.log("Error in adminExport:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});
