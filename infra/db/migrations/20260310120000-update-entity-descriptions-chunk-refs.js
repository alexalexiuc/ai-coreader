const fs = require("fs");
const path = require("path");

const VALIDATOR_PATH = path.join(
  process.cwd(),
  "infra/db/validators/entity-descriptions.schema.json",
);

function loadValidatorJson() {
  return JSON.parse(fs.readFileSync(VALIDATOR_PATH, "utf8"));
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

module.exports.up = async (db) => {
  const validator = loadValidatorJson();
  await ensureCollectionWithValidator(db, "entity-descriptions", validator);
};
