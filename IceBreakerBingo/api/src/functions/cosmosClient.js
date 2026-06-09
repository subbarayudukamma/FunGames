const { CosmosClient } = require("@azure/cosmos");

let client = null;
let database = null;
let gameContainer = null;
let playersContainer = null;
let initialized = false;

function getCosmosClient() {
  if (!client) {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    const databaseId = process.env.COSMOS_DATABASE || "icebreaker-bingo";

    if (!endpoint || !key) {
      throw new Error("COSMOS_ENDPOINT and COSMOS_KEY must be set");
    }

    client = new CosmosClient({ endpoint, key });
    database = client.database(databaseId);
    gameContainer = database.container("game");
    playersContainer = database.container("players");
  }

  return { client, database, gameContainer, playersContainer };
}

async function ensureInitialized() {
  if (initialized) return { client, database, gameContainer, playersContainer };

  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const databaseId = process.env.COSMOS_DATABASE || "icebreaker-bingo";

  if (!endpoint || !key) {
    throw new Error("COSMOS_ENDPOINT and COSMOS_KEY must be set");
  }

  if (!client) {
    client = new CosmosClient({ endpoint, key });
  }

  const dbResponse = await client.databases.createIfNotExists({ id: databaseId });
  database = dbResponse.database;

  const gameResponse = await database.containers.createIfNotExists({
    id: "game",
    partitionKey: { paths: ["/partitionKey"] },
  });
  gameContainer = gameResponse.container;

  const playersResponse = await database.containers.createIfNotExists({
    id: "players",
    partitionKey: { paths: ["/partitionKey"] },
  });
  playersContainer = playersResponse.container;

  // Seed default game config if not exists
  try {
    const { resource } = await gameContainer.item("config", "game").read();
    if (!resource) {
      await gameContainer.items.create({
        id: "config",
        partitionKey: "game",
        questions: [],
        gameState: "lobby",
        adminKey: process.env.ADMIN_KEY || "bingo-admin-2026",
        createdAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    if (e.code === 404) {
      await gameContainer.items.create({
        id: "config",
        partitionKey: "game",
        questions: [],
        gameState: "lobby",
        adminKey: process.env.ADMIN_KEY || "bingo-admin-2026",
        createdAt: new Date().toISOString(),
      });
    } else {
      throw e;
    }
  }

  initialized = true;
  return { client, database, gameContainer, playersContainer };
}

module.exports = { getCosmosClient, ensureInitialized };
