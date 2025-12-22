import fs, { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compileBSONToTs, compileBSONToGo } from "./bson-compiler.js";
import { toPascalCase } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tsOutFolder = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "coreader-app",
  "lib",
  "db",
  "generated"
);

const goOutFolder = path.join(__dirname, "..", "..", "..", "coreader-worker");

async function listValidators() {
  const validatorsDir = path.join(__dirname, "..", "validators");
  let schemaFiles = [];

  // Read the directory contents using fs.readdir and filter for .json files
  try {
    const dirents = await fs.promises.readdir(validatorsDir, {
      withFileTypes: true,
    });

    for (const entry of dirents) {
      if (entry.isDirectory()) continue; // Skip directories

      let filePath = `${validatorsDir}/${entry.name}`;

      const collectionName = entry.name.split(".")[0];

      schemaFiles.push({
        collection: collectionName,
        schema: JSON.parse(readFileSync(filePath, "utf8")),
      });
    }
  } catch (error) {
    console.error("Error listing validators:", error.message);
  }

  return schemaFiles;
}

const getStructFunction = (structName) => {
  return `
func (f *${structName}) GetBaseDoc() *BaseDoc {
  return &BaseDoc{
    ID:        f.ID,
    CreatedAt: f.CreatedAt,
    UpdatedAt: f.UpdatedAt,
  }
}
  `;
};

const goTypesFileBanner = `/*
This file was automatically generated.

Do not modify it by hand
*/

package main

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)
`;

async function run() {
  const schemas = await listValidators();

  // go structs will be part of the same file
  let goStructs = [goTypesFileBanner];

  // Do something with the loaded JSON from files
  for (const { collection, schema } of schemas) {
    console.log(`Generating types for collection: ${collection}`);
    console.log(schema);
    const compiledTs = await compileBSONToTs(schema, {
      enableConstEnums: true,
      ignoreMinAndMaxItems: false,
      strictIndexSignatures: false,
      unknownAny: true,
    });

    writeFileSync(path.join(tsOutFolder, `${collection}.ts`), compiledTs);

    const structName = toPascalCase(`${collection}Doc`);
    const compiledGo = compileBSONToGo(schema, {
      structOnly: true,
      structName: structName,
      banner: [],
    });
    goStructs.push([compiledGo, getStructFunction(structName)].join("\n"));
  }
  writeFileSync(path.join(goOutFolder, `dbtypes.go`), goStructs.join("\n"));
}

// Call to execute async functions in Node.js environment.
(async () => {
  try {
    await run();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  process.exit(0);
})();
