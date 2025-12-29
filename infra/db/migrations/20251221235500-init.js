const fs = require("fs");
const path = require("path");

const VALIDATORS_DIR = path.join(process.cwd(), "infra/db/validators");

function loadValidatorJson(relPath) {
  const p = path.join(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function ensureCollectionWithValidator(db, name, validator) {
  const schema =
    validator && validator.$jsonSchema ? validator : { $jsonSchema: validator };
  const exists = (await db.listCollections({ name }).toArray()).length > 0;

  if (!exists) {
    await db.createCollection(name, {
      validator: schema,
      validationLevel: "strict",
      validationAction: "error",
    });
    return;
  }

  await db.command({
    collMod: name,
    validator: schema,
    validationLevel: "strict",
    validationAction: "error",
  });
}

function toCollectionName(title) {
  if (!title || typeof title !== "string") {
    throw new Error("Schema title is required to derive collection name.");
  }

  const base = title.endsWith("Doc") ? title.slice(0, -3) : title;
  if (!base) {
    throw new Error(`Schema title "${title}" is invalid.`);
  }

  const lower = base[0].toLowerCase() + base.slice(1);
  return lower.endsWith("s") ? lower : `${lower}s`;
}

module.exports.up = async (db) => {
  const files = fs
    .readdirSync(VALIDATORS_DIR)
    .filter((file) => file.endsWith(".schema.json"))
    .sort((a, b) => a.localeCompare(b, "en"));

  for (const file of files) {
    const collectionName = file.replace(".schema.json", "");
    const validator = loadValidatorJson(`infra/db/validators/${file}`);
    const collection = toCollectionName(collectionName);
    await ensureCollectionWithValidator(db, collection, validator);
  }
};
