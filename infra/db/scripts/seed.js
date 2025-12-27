const fs = require("fs");
const path = require("path");
const util = require("util");
const { getMongoDb } = require("./utils");

const SEEDS_DIR = path.join(process.cwd(), "infra/db/seeds");

async function ensureSeedsCollection(db) {
  await db.createCollection("seeds").catch(() => {});
  await db
    .collection("seeds")
    .createIndex({ name: 1 }, { unique: true })
    .catch(() => {});
}

async function getApplied(db) {
  const rows = await db
    .collection("seeds")
    .find({}, { projection: { name: 1 } })
    .toArray();
  return new Set(rows.map((r) => r.name));
}

function logSeedError(err) {
  if (!err) {
    console.error("Seed failed with an unknown error.");
    return;
  }

  if (err.seedFile) {
    console.error(`Seed file: ${err.seedFile}`);
  }

  if (err.name !== "MongoBulkWriteError" && err.code !== 121) {
    console.error(err);
    return;
  }

  console.error(`MongoBulkWriteError: ${err.message}`);

  if (Array.isArray(err.writeErrors) && err.writeErrors.length > 0) {
    for (const writeError of err.writeErrors) {
      const details = writeError.err ?? writeError;
      const code = details.code ?? writeError.code ?? "unknown";
      const message = details.errmsg ?? writeError.errmsg ?? writeError.message;
      const index = details.index ?? writeError.index ?? "unknown";

      console.error(`- writeError index=${index} code=${code} message=${message}`);

      if (details.errInfo?.details) {
        console.error(
          util.inspect(details.errInfo.details, {
            depth: null,
            colors: false,
            maxArrayLength: null,
            breakLength: 120,
          })
        );
      }

      if (details.op) {
        console.error(
          "  op:",
          util.inspect(details.op, {
            depth: null,
            colors: false,
            maxArrayLength: 20,
            breakLength: 120,
          })
        );
      }
    }
    return;
  }

  if (err.errorResponse) {
    console.error(
      util.inspect(err.errorResponse, {
        depth: null,
        colors: false,
        maxArrayLength: null,
        breakLength: 120,
      })
    );
    return;
  }

  console.error(err);
}

async function run() {
  const db = await getMongoDb();
  await ensureSeedsCollection(db);

  if (!fs.existsSync(SEEDS_DIR)) {
    console.log("No seeds directory found, nothing to apply.");
    return;
  }

  const applied = await getApplied(db);

  const files = fs
    .readdirSync(SEEDS_DIR)
    .filter((f) => f.match(/^\d+.*\.(js|cjs)$/))
    .sort((a, b) => a.localeCompare(b, "en"));

  if (files.length === 0) {
    console.log("No seed files found, nothing to apply.");
    return;
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`✓ skip ${file}`);
      continue;
    }

    console.log(`→ run  ${file}`);
    const full = path.join(SEEDS_DIR, file);
    const seed = require(full);
    const seedFn = seed.seed ?? seed.up;

    if (typeof seedFn !== "function") {
      throw new Error(`Seed ${file} must export { seed(db) } or { up(db) }`);
    }

    try {
      await seedFn(db);
    } catch (err) {
      err.seedFile = file;
      throw err;
    }
    await db.collection("seeds").insertOne({ name: file, appliedAt: new Date() });
    console.log(`✓ done ${file}`);
  }

  console.log("All seeds applied.");
}

(async () => {
  try {
    await run();
  } catch (err) {
    logSeedError(err);
  } finally {
    process.exit(0);
  }
})();
