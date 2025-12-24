const path = require("path");
const { runMongoScripts } = require("./run-mongo-scripts");

const MIGRATIONS_DIR = path.join(process.cwd(), "infra/db/migrations");
const SEEDS_DIR = path.join(process.cwd(), "infra/db/seeds");

const SCRIPT_TYPES = {
  "--migrate": {
    typeLabel: "migrations",
    directory: MIGRATIONS_DIR,
    trackingCollection: "migrations",
    resolveApplyFn: (migration, file) => {
      if (typeof migration.up !== "function") {
        throw new Error(`Migration ${file} must export { up(db) }`);
      }
      return migration.up;
    },
  },
  "--seed": {
    typeLabel: "seeds",
    directory: SEEDS_DIR,
    trackingCollection: "seeds",
    missingDirectoryMessage: "No seeds directory found, nothing to apply.",
    emptyDirectoryMessage: "No seed files found, nothing to apply.",
    resolveApplyFn: (seed, file) => {
      const seedFn = seed.seed ?? seed.up;
      if (typeof seedFn !== "function") {
        throw new Error(
          `Seed ${file} must export { seed(db) } or { up(db) }`
        );
      }
      return seedFn;
    },
  },
};

function getScriptConfig() {
  const flags = process
    .argv
    .slice(2)
    .filter((arg) => Object.hasOwn(SCRIPT_TYPES, arg));

  if (flags.length === 0) {
    throw new Error(
      "Provide either --migrate or --seed.\n" +
        "Usage: node ./infra/db/scripts/apply-mongo-scripts.js --migrate|--seed"
    );
  }

  if (flags.length > 1) {
    throw new Error("Specify only one of --migrate or --seed.");
  }

  return SCRIPT_TYPES[flags[0]];
}

async function run() {
  const config = getScriptConfig();
  await runMongoScripts(config);
}

(async () => {
  try {
    await run();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
})();
