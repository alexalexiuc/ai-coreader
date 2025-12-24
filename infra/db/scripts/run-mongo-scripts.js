const fs = require("fs");
const path = require("path");
const { getMongoDb } = require("./utils");

async function ensureTrackingCollection(db, collectionName) {
  await db.createCollection(collectionName).catch(() => {});
  await db
    .collection(collectionName)
    .createIndex({ name: 1 }, { unique: true })
    .catch(() => {});
}

async function getApplied(db, collectionName) {
  const rows = await db
    .collection(collectionName)
    .find({}, { projection: { name: 1 } })
    .toArray();
  return new Set(rows.map((r) => r.name));
}

function listScriptFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((f) => f.match(/^\d+.*\.(js|cjs)$/))
    .sort((a, b) => a.localeCompare(b, "en"));
}

async function runMongoScripts({
  typeLabel,
  directory,
  trackingCollection,
  resolveApplyFn,
  missingDirectoryMessage,
  emptyDirectoryMessage,
}) {
  const db = await getMongoDb();
  await ensureTrackingCollection(db, trackingCollection);

  if (!fs.existsSync(directory)) {
    if (missingDirectoryMessage) {
      console.log(missingDirectoryMessage);
      return;
    }
    throw new Error(`Directory not found: ${directory}`);
  }

  const applied = await getApplied(db, trackingCollection);
  const files = listScriptFiles(directory);

  if (files.length === 0) {
    if (emptyDirectoryMessage) {
      console.log(emptyDirectoryMessage);
      return;
    }
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`✓ skip ${file}`);
      continue;
    }

    console.log(`→ run  ${file}`);
    const full = path.join(directory, file);
    const script = require(full);
    const applyFn = resolveApplyFn(script, file);

    if (typeof applyFn !== "function") {
      throw new Error(
        `No executable handler found for ${typeLabel.slice(0, -1)} ${file}`
      );
    }

    await applyFn(db);
    await db
      .collection(trackingCollection)
      .insertOne({ name: file, appliedAt: new Date() });

    console.log(`✓ done ${file}`);
  }

  console.log(`All ${typeLabel} applied.`);
}

module.exports = {
  runMongoScripts,
};
