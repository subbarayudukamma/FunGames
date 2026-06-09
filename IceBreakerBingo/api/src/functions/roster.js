const { app } = require("@azure/functions");
const { ensureInitialized } = require("./cosmosClient");

// GET /api/roster — returns all player names + teams for autocomplete
app.http("roster", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "roster",
  handler: async (request, context) => {
    try {
      const { playersContainer } = await ensureInitialized();
      const { resources: players } = await playersContainer.items
        .query("SELECT c.alias, c.displayName, c.teamName FROM c WHERE c.partitionKey = 'player'")
        .fetchAll();

      return {
        status: 200,
        jsonBody: {
          roster: players.map((p) => ({
            alias: p.alias,
            displayName: p.displayName,
            teamName: p.teamName || "",
          })),
        },
      };
    } catch (error) {
      context.log("Error in roster:", error);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  },
});
