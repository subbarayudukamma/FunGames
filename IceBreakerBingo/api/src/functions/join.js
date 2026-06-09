const { app } = require("@azure/functions");
const { ensureInitialized } = require("./cosmosClient");
const { generateCard } = require("./bingoLogic");

app.http("join", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "join",
  handler: async (request, context) => {
    try {
      const { alias, displayName, teamName } = await request.json();

      if (!alias || !displayName) {
        return { status: 400, jsonBody: { error: "alias and displayName are required" } };
      }

      const { gameContainer, playersContainer } = await ensureInitialized();

      // Get game config
      const { resource: config } = await gameContainer.item("config", "game").read();
      if (!config) {
        return { status: 500, jsonBody: { error: "Game not initialized. Visit admin page first." } };
      }

      // Check if player already exists
      const playerId = `player-${alias.toLowerCase()}`;
      const { resource: existing } = await playersContainer.item(playerId, "player").read();
      if (existing) {
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
        hasRow: false,
        hasColumn: false,
        hasDiagonal: false,
        hasBlackout: false,
        completedRows: [],
        completedColumns: [],
        completedDiagonals: [],
      };

      await playersContainer.items.create(player);

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
