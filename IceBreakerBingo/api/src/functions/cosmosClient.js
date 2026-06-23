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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Read-modify-write the singleton game config document with optimistic
// concurrency (ETag IfMatch) and automatic retry on conflict. This prevents
// lost updates when multiple requests write the shared config concurrently —
// e.g. an admin action (release/close/set-mode) colliding with the every-5s
// admin session heartbeat, which previously caused state changes to silently
// get overwritten (requiring the admin to click buttons multiple times).
//
// `mutate(config)` must mutate `config` in place and may be async. It can
// return an object that is passed back to the caller as `result`. Returning a
// result with `abort: true` skips the write entirely (use for validation
// failures so no needless write/conflict occurs).
async function updateConfig(mutate, maxRetries = 10) {
  const { gameContainer } = await ensureInitialized();
  const ref = gameContainer.item("config", "game");
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { resource: config } = await ref.read();
    if (!config) throw new Error("Game config not found");
    const result = (await mutate(config)) || {};
    if (result.abort) return { config, result };
    try {
      await ref.replace(config, {
        accessCondition: { type: "IfMatch", condition: config._etag },
      });
      return { config, result };
    } catch (e) {
      if (e.code === 412) {
        // Another writer updated the config first — re-read and retry.
        lastError = e;
        await sleep(20 + Math.floor(Math.random() * 60));
        continue;
      }
      throw e;
    }
  }
  throw lastError || new Error("updateConfig: exhausted retries due to write conflicts");
}

module.exports = { getCosmosClient, ensureInitialized, updateConfig };
