const fs = require("fs");
const path = require("path");

module.exports.up = async (db) => {
  const validatorPath = path.join(process.cwd(), "infra/db/validators/files.schema.json");
  const validator = JSON.parse(fs.readFileSync(validatorPath, "utf8"));

  await db.command({
    collMod: "files",
    validator: { $jsonSchema: validator },
    validationLevel: "strict",
    validationAction: "error",
  });

  console.log("Updated files collection validator with textProcessed and entityPercentage fields");
};
