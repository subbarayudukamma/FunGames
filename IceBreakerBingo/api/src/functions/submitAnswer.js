const { app } = require("@azure/functions");
const { ensureInitialized } = require("./cosmosClient");
const { checkWins } = require("./bingoLogic");
const { validatePlayroom, playroomDenied } = require("./playroom");

app.http("submitAnswer", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "submit-answer",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    try {
      const { alias, questionId, answer } = await request.json();

      if (!alias || !questionId || !answer) {
        return { status: 400, jsonBody: { error: "alias, questionId, and answer are required" } };
      }

      // Answer must be an array of player objects
      if (!Array.isArray(answer) || answer.length === 0) {
        return { status: 400, jsonBody: { error: "answer must be a non-empty array of selected players" } };
      }

      const { playersContainer, gameContainer } = await ensureInitialized();

      // Verify game is active
      const { resource: config } = await gameContainer.item("config", "game").read();
      if (!config || config.gameState !== "active") {
        return { status: 400, jsonBody: { error: "Game is not active" } };
      }

      // Validate that all selected people are in the roster
      const { resources: allPlayers } = await playersContainer.items
        .query("SELECT c.alias, c.displayName, c.teamName FROM c WHERE c.partitionKey = 'player'")
        .fetchAll();
      const validAliases = new Set(allPlayers.map(p => p.alias));
      const playerLookup = Object.fromEntries(allPlayers.map(p => [p.alias, p]));

      // Get submitting player's team
      const submitter = playerLookup[alias.toLowerCase()];
      const submitterTeam = submitter?.teamName || '';

      for (const person of answer) {
        if (!person.alias || !validAliases.has(person.alias)) {
          return { status: 400, jsonBody: { error: `Invalid player: ${person.alias || person.displayName || 'unknown'}. Please select from the roster.` } };
        }
        // Cannot pick someone from the same team
        const target = playerLookup[person.alias];
        if (submitterTeam && target?.teamName && target.teamName === submitterTeam) {
          return { status: 400, jsonBody: { error: `Cannot select ${person.displayName} — they are on your same team (${submitterTeam}).` } };
        }
      }

      const playerId = `player-${alias.toLowerCase()}`;
      const { resource: player } = await playersContainer.item(playerId, "player").read();
      if (!player) {
        return { status: 404, jsonBody: { error: "Player not found" } };
      }

      // Find the cell and update
      const cellIndex = player.card.findIndex((c) => c.questionId === questionId);
      if (cellIndex === -1) {
        return { status: 400, jsonBody: { error: "Question not found on your card" } };
      }

      // Cannot change answer once submitted
      if (player.card[cellIndex].answer !== null) {
        return { status: 400, jsonBody: { error: "Answer already submitted for this cell" } };
      }

      player.card[cellIndex].answer = answer;
      player.card[cellIndex].completedAt = new Date().toISOString();

      // Get previous wins before this answer
      const previousWins = checkWins(
        player.card.map((c, i) => i === cellIndex ? { ...c, answer: null } : c)
      );

      // Check wins after this answer
      const wins = checkWins(player.card);
      player.completedCount = wins.completedCount;
      player.hasRow = wins.hasRow;
      player.hasColumn = wins.hasColumn;
      player.hasDiagonal = wins.hasDiagonal;
      player.hasBlackout = wins.hasBlackout;
      player.completedRows = wins.completedRows;
      player.completedColumns = wins.completedColumns;
      player.completedDiagonals = wins.completedDiagonals;

      // Detect NEW wins and add to notification queue (classic mode only)
      const newNotifications = [];
      const now = new Date().toISOString();

      if ((config.gameMode || "classic") === "classic") {
        // Check first5
        if (wins.completedCount >= 5 && previousWins.completedCount < 5) {
          newNotifications.push({ category: "first5", player: player.alias, displayName: player.displayName, completedAt: now });
        }

        // Check new rows
        for (const rowIdx of wins.completedRows) {
          if (!previousWins.completedRows.includes(rowIdx)) {
            newNotifications.push({ category: `row-${rowIdx}`, player: player.alias, displayName: player.displayName, completedAt: now });
          }
        }

        // Check new columns
        for (const colIdx of wins.completedColumns) {
          if (!previousWins.completedColumns.includes(colIdx)) {
            newNotifications.push({ category: `col-${colIdx}`, player: player.alias, displayName: player.displayName, completedAt: now });
          }
        }

        // Check new diagonals
        for (const diagIdx of wins.completedDiagonals) {
          if (!previousWins.completedDiagonals.includes(diagIdx)) {
            newNotifications.push({ category: `diag-${diagIdx}`, player: player.alias, displayName: player.displayName, completedAt: now });
          }
        }

        // Check blackout
        if (wins.hasBlackout && !previousWins.hasBlackout) {
          newNotifications.push({ category: "blackout", player: player.alias, displayName: player.displayName, completedAt: now });
        }
      }

      // Add notifications to game config queue
      if (newNotifications.length > 0) {
        if (!config.winQueue) config.winQueue = [];
        config.winQueue.push(...newNotifications);
        await gameContainer.item("config", "game").replace(config);
      }

      await playersContainer.item(playerId, "player").replace(player);

      return {
        status: 200,
        jsonBody: {
          message: "Answer submitted",
          completedCount: wins.completedCount,
          hasRow: wins.hasRow,
          hasColumn: wins.hasColumn,
          hasDiagonal: wins.hasDiagonal,
          hasBlackout: wins.hasBlackout,
          completedRows: wins.completedRows,
          completedColumns: wins.completedColumns,
          completedDiagonals: wins.completedDiagonals,
        },
      };
    } catch (error) {
      context.log("Error in submitAnswer:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});
