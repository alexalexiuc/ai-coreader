const path = require("path");
const { runMongoScripts } = require("./run-mongo-scripts");

const SEEDS_DIR = path.join(process.cwd(), "infra/db/seeds");

async function run() {
  await runMongoScripts({
    typeLabel: "seeds",
    directory: SEEDS_DIR,
    trackingCollection: "seeds",
    missingDirectoryMessage: "No seeds directory found, nothing to apply.",
    emptyDirectoryMessage: "No seed files found, nothing to apply.",
    resolveApplyFn: (seed, file) => {
      const seedFn = seed.seed ?? seed.up;
      if (typeof seedFn !== "function") {
        throw new Error(`Seed ${file} must export { seed(db) } or { up(db) }`);
      }
      return seedFn;
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
