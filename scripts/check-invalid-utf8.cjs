/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const DEFAULT_URI = "mongodb://localhost:27017";
const DEFAULT_DB_NAME = "llm_reader";

function readEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return {};

  const raw = fs.readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);
  const values = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key) values[key] = value;
  }

  return values;
}

function getMongoConfig() {
  const envValues = readEnvFile();
  const uri = process.env.MONGODB_URI || envValues.MONGODB_URI || DEFAULT_URI;
  const dbName =
    process.env.MONGODB_DB_NAME || envValues.MONGODB_DB_NAME || DEFAULT_DB_NAME;
  return { uri, dbName };
}

function parseArgs(argv) {
  const args = {
    collection: undefined,
    limit: 0,
    maxErrors: 25,
    includeBookChunks: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--collection" || a === "-c") args.collection = argv[++i];
    else if (a === "--limit" || a === "-l")
      args.limit = Number(argv[++i] ?? "0");
    else if (a === "--max-errors") args.maxErrors = Number(argv[++i] ?? "25");
    else if (a === "--include-book-chunks") args.includeBookChunks = true;
    else if (a === "--help" || a === "-h") args.help = true;
  }

  return args;
}

function fieldsToProjection(fields) {
  const projection = { _id: 1 };
  for (const field of fields) projection[field] = 1;
  return projection;
}

const COLLECTION_PROBES = {
  entities: [
    "nameCanonical",
    "type",
    "aliases",
    "descriptionCurrent",
    "keyFacts",
    "uncertainties",
  ],
  "entity-mentions": [
    "surfaceForm",
    "snippet",
    "factsExtracted.factType",
    "factsExtracted.evidence",
    "factsExtracted.hash",
    "factsExtracted.value",
  ],
  "books-chunks": ["text", "chapters", "entities.name", "entities.type"],
};

async function findBadDocsInCollection(
  coll,
  collName,
  probeFields,
  limit,
  maxErrors
) {
  const idCursor = coll.find({}, { projection: { _id: 1 } }).batchSize(500);
  const probeProjection = fieldsToProjection(probeFields);

  let scanned = 0;
  let bad = 0;

  while (await idCursor.hasNext()) {
    const { _id } = await idCursor.next();
    scanned++;
    if (limit > 0 && scanned > limit) break;

    try {
      await coll.findOne({ _id }, { projection: probeProjection });
    } catch (err) {
      bad++;
      console.log(`\n[${collName}] _id=${_id.toString()}`);
      console.log(`  error: ${err && err.message ? err.message : String(err)}`);

      const badFields = [];
      for (const field of probeFields) {
        try {
          await coll.findOne(
            { _id },
            { projection: fieldsToProjection([field]) }
          );
        } catch (fieldErr) {
          badFields.push(field);
          console.log(
            `  field: ${field} -> ${fieldErr && fieldErr.message ? fieldErr.message : String(fieldErr)}`
          );
        }
      }

      if (badFields.length === 0) {
        console.log(
          "  note: error reproduced, but none of the probe fields isolated it (try adding more fields)."
        );
      }

      if (bad >= maxErrors) break;
    }
  }

  console.log(`\n[${collName}] scanned=${scanned} bad=${bad}`);
  return { scanned, bad };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  node scripts/check-invalid-utf8.cjs [--collection <name>] [--limit <n>] [--max-errors <n>] [--include-book-chunks]

Env (or .env):
  MONGODB_URI
  MONGODB_DB_NAME

Examples:
  node scripts/check-invalid-utf8.cjs --collection entities
  node scripts/check-invalid-utf8.cjs --collection entity-mentions --limit 5000 --max-errors 200
`);
    process.exit(0);
  }

  const { uri, dbName } = getMongoConfig();
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

  let collectionsToScan = [
    "entities",
    "entity-mentions",
    "entity-descriptions",
  ];
  if (args.includeBookChunks) collectionsToScan.push("books-chunks");
  if (args.collection) collectionsToScan = [args.collection];

  try {
    await client.connect();
    const db = client.db(dbName);

    for (const collName of collectionsToScan) {
      const probeFields = COLLECTION_PROBES[collName];
      if (!probeFields) {
        console.log(
          `[${collName}] no probe fields configured; add it to COLLECTION_PROBES in scripts/check-invalid-utf8.cjs`
        );
        continue;
      }

      const coll = db.collection(collName);
      await findBadDocsInCollection(
        coll,
        collName,
        probeFields,
        args.limit,
        args.maxErrors
      );
    }
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
