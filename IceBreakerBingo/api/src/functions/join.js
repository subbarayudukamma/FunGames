const { app } = require("@azure/functions");
const { ensureInitialized } = require("./cosmosClient");
const { generateCard } = require("./bingoLogic");
const { validatePlayroom, playroomDenied } = require("./playroom");

app.http("join", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "join",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    try {
      const { alias, displayName, teamName } = await request.json();

      if (!alias || !displayName || !teamName || !String(teamName).trim()) {
        return { status: 400, jsonBody: { error: "alias, displayName, and teamName are required" } };
      }

      const { gameContainer, playersContainer } = await ensureInitialized();

      // Get game config
      const { resource: config } = await gameContainer.item("config", "game").read();
      if (!config) {
        return { status: 500, jsonBody: { error: "Game not initialized. Visit admin page first." } };
      }

      // Reject joins when game is closed
      if (config.gameState === "closed") {
        return { status: 400, jsonBody: { error: "Game is closed. Please wait for the next round to start.", gameState: "closed" } };
      }

      // Check if player already exists
      const playerId = `player-${alias.toLowerCase()}`;
      const { resource: existing } = await playersContainer.item(playerId, "player").read();
      if (existing) {
        // Update displayName/teamName if changed (user re-joined with different info)
        let updated = false;
        if (existing.displayName !== displayName) {
          existing.displayName = displayName;
          updated = true;
        }
        if ((teamName || "") !== existing.teamName) {
          existing.teamName = teamName || "";
          updated = true;
        }
        if (updated) {
          await playersContainer.item(playerId, "player").replace(existing);
        }

        return {
          status: 200,
          jsonBody: {
            message: "Already joined",
            gameState: config.gameState,
            player: {
              alias: existing.alias,
              displayName: existing.displayName,
              teamName: existing.teamName,
              card: config.gameState === "active" ? existing.card : null,
            },
          },
        };
      }

      // Create new player
      const card = config.gameState === "active" && config.questions.length >= 24
        ? generateCard(config.questions)
        : [];

      const player = {
        id: playerId,
        partitionKey: "player",
        alias: alias.toLowerCase(),
        displayName,
        teamName: teamName || "",
        card,
        joinedAt: new Date().toISOString(),
        completedCount: card.length > 0 ? 1 : 0,
        score: card.length > 0 ? 1 : 0,
        hasRow: false,
        hasColumn: false,
        hasDiagonal: false,
        hasBlackout: false,
        completedRows: [],
        completedColumns: [],
        completedDiagonals: [],
      };

      try {
        await playersContainer.items.create(player);
      } catch (createErr) {
        // A concurrent/duplicate join for the same alias created the player
        // first — treat as a successful join rather than a 500 error.
        if (createErr.code === 409) {
          const { resource: justCreated } = await playersContainer.item(playerId, "player").read();
          const p = justCreated || player;
          return {
            status: 200,
            jsonBody: {
              message: "Already joined",
              gameState: config.gameState,
              player: {
                alias: p.alias,
                displayName: p.displayName,
                teamName: p.teamName,
                card: config.gameState === "active" ? p.card : null,
              },
            },
          };
        }
        throw createErr;
      }

      return {
        status: 200,
        jsonBody: {
          message: "Joined successfully",
          gameState: config.gameState,
          player: {
            alias: player.alias,
            displayName: player.displayName,
            teamName: player.teamName,
            card: config.gameState === "active" ? player.card : null,
          },
        },
      };
    } catch (error) {
      context.log("Error in join:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});
