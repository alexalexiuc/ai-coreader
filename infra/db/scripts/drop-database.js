const { getMongoDb } = require("./utils.js");

async function run() {
  const db = await getMongoDb();
  await db.dropDatabase();

  console.log("Database dropped.");
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
