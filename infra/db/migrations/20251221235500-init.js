const fs = require("fs");
const path = require("path");

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

const collections = ["files", "books"];

module.exports.up = async (db) => {
  for (const collection of collections) {
    await ensureCollectionWithValidator(
      db,
      collection,
      loadValidatorJson(`infra/db/validators/${collection}.schema.json`)
    );
  }
};
