const { app } = require("@azure/functions");
const { ensureInitialized } = require("./cosmosClient");
const { validatePlayroom, playroomDenied } = require("./playroom");

app.http("gameState", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "game-state",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
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
          gameMode: config.gameMode || "raffle",
          playerCount: players[0] || 0,
          questionCount: config.questions.length,
          claimedWins: config.claimedWins || {},
          winQueueCount: (config.winQueue || []).length,
          raffleResults: config.raffleResults || [],
        },
      };
    } catch (error) {
      context.log("Error in gameState:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});
