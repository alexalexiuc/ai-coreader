const fs = require("fs");
const path = require("path");
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

    await seedFn(db);
    await db.collection("seeds").insertOne({ name: file, appliedAt: new Date() });
    console.log(`✓ done ${file}`);
  }

  console.log("All seeds applied.");
}

(async () => {
  try {
    await run();
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
