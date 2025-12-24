const path = require("path");
const { runMongoScripts } = require("./run-mongo-scripts");

const MIGRATIONS_DIR = path.join(process.cwd(), "infra/db/migrations");

async function run() {
  await runMongoScripts({
    typeLabel: "migrations",
    directory: MIGRATIONS_DIR,
    trackingCollection: "migrations",
    resolveApplyFn: (migration, file) => {
      if (typeof migration.up !== "function") {
        throw new Error(`Migration ${file} must export { up(db) }`);
      }
      return migration.up;
    },
  });
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
