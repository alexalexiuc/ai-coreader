const fs = require("fs");
const path = require("path");
const { getMongoDb } = require("./utils");

const MIGRATIONS_DIR = path.join(process.cwd(), "infra/db/migrations");

async function ensureMigrationsCollection(db) {
  await db.createCollection("migrations").catch(() => {});
  await db
    .collection("migrations")
    .createIndex({ name: 1 }, { unique: true })
    .catch(() => {});
}

async function getApplied(db) {
  const rows = await db
    .collection("migrations")
    .find({}, { projection: { name: 1 } })
    .toArray();
  return new Set(rows.map((r) => r.name));
}

async function run() {
  const db = await getMongoDb();
  await ensureMigrationsCollection(db);

  const applied = await getApplied(db);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.match(/^\d+.*\.(js|cjs)$/))
    .sort((a, b) => a.localeCompare(b, "en"));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`✓ skip ${file}`);
      continue;
    }

    console.log(`→ run  ${file}`);
    const full = path.join(MIGRATIONS_DIR, file);
    const migration = require(full);

    if (typeof migration.up !== "function") {
      throw new Error(`Migration ${file} must export { up(db) }`);
    }

    await migration.up(db);
    await db
      .collection("migrations")
      .insertOne({ name: file, appliedAt: new Date() });

    console.log(`✓ done ${file}`);
  }

  console.log("All migrations applied.");
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
