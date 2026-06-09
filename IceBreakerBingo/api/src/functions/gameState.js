const { app } = require("@azure/functions");
const { ensureInitialized } = require("./cosmosClient");

app.http("gameState", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game-state",
  handler: async (request, context) => {
    try {
      const { gameContainer, playersContainer } = await ensureInitialized();
      const { resource: config } = await gameContainer.item("config", "game").read();

      // Get player count
      const { resources: players } = await playersContainer.items
        .query("SELECT VALUE COUNT(1) FROM c WHERE c.partitionKey = 'player'")
        .fetchAll();

      return {
        status: 200,
        jsonBody: {
          gameState: config.gameState,
          playerCount: players[0] || 0,
          questionCount: config.questions.length,
          claimedWins: config.claimedWins || {},
          winQueueCount: (config.winQueue || []).length,
        },
      };
    } catch (error) {
      context.log("Error in gameState:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});
