const { app } = require("@azure/functions");
const { ensureInitialized } = require("./cosmosClient");
const { validatePlayroom, playroomDenied } = require("./playroom");

app.http("myCard", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "my-card",
  handler: async (request, context) => {
    if (!validatePlayroom(request)) return playroomDenied();
    try {
      const alias = request.query.get("alias");
      if (!alias) {
        return { status: 400, jsonBody: { error: "alias is required" } };
      }

      const { playersContainer, gameContainer } = await ensureInitialized();
      const { resource: config } = await gameContainer.item("config", "game").read();

      const playerId = `player-${alias.toLowerCase()}`;
      const { resource: player } = await playersContainer.item(playerId, "player").read();
      if (!player) {
        return { status: 404, jsonBody: { error: "Player not found" } };
      }
      return {
        status: 200,
        jsonBody: {
          gameState: config.gameState,
          alias: player.alias,
          displayName: player.displayName,
          card: player.card,
          completedCount: player.completedCount,
          extraRaffleEntries: player.extraRaffleEntries || 0,
          hasRow: player.hasRow,
          hasColumn: player.hasColumn,
          hasDiagonal: player.hasDiagonal,
          hasBlackout: player.hasBlackout,
          completedRows: player.completedRows || [],
          completedColumns: player.completedColumns || [],
          completedDiagonals: player.completedDiagonals || [],
          claimedWins: config.claimedWins || {},
          raffleResults: config.raffleResults || [],
        },
      };
    } catch (error) {
      context.log("Error in myCard:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});
