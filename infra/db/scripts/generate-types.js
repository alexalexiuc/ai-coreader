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
const jsonSchemasOutFolder = path.join(__dirname, "..", "schemas");

const objectIdPattern = "^[a-fA-F0-9]{24}$";

const bsonTypeMap = new Map([
  ["object", { type: "object" }],
  ["array", { type: "array" }],
  ["string", { type: "string" }],
  ["bool", { type: "boolean" }],
  ["null", { type: "null" }],
  ["int", { type: "integer" }],
  ["long", { type: "integer" }],
  ["decimal", { type: "number" }],
  ["double", { type: "number" }],
  ["number", { type: "number" }],
  ["date", { type: "string", format: "date-time" }],
  ["objectId", { type: "string", pattern: objectIdPattern }],
]);

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

function normalizeBsonType(bsonType) {
  if (!bsonType) return {};

  if (Array.isArray(bsonType)) {
    const reduced = bsonType.reduce(
      (acc, type) => {
        const mapping = normalizeBsonType(type);
        if (mapping.type) {
          const types = Array.isArray(mapping.type) ? mapping.type : [mapping.type];
          acc.type.push(...types);
        }

        if (!acc.format && mapping.format) acc.format = mapping.format;
        if (!acc.pattern && mapping.pattern) acc.pattern = mapping.pattern;

        return acc;
      },
      { type: [], format: undefined, pattern: undefined }
    );

    const merged = { ...reduced, type: [...new Set(reduced.type)] };
    if (!merged.format) delete merged.format;
    if (!merged.pattern) delete merged.pattern;
    if (merged.type.length === 0) delete merged.type;
    return merged;
  }

  const mapping = bsonTypeMap.get(bsonType);
  return mapping ? { ...mapping } : {};
}

function convertToJsonSchema(schema) {
  if (Array.isArray(schema)) return schema.map(convertToJsonSchema);
  if (!schema || typeof schema !== "object") return schema;

  const { bsonType, properties, items, ...rest } = schema;
  const normalized = { ...rest, ...normalizeBsonType(bsonType) };

  if (properties) {
    normalized.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, convertToJsonSchema(value)])
    );
  }

  if (items) {
    normalized.items = convertToJsonSchema(items);
  }

  return normalized;
}

function convertValidatorToJsonSchema(schema) {
  const validatorSchema = schema?.$jsonSchema || schema;
  const converted = convertToJsonSchema(validatorSchema);
  const { $schema, ...rest } = converted;

  return {
    $schema: $schema || "https://json-schema.org/draft/2020-12/schema",
    ...rest,
  };
}

async function writeJsonSchemas(schemas) {
  await fs.promises.mkdir(jsonSchemasOutFolder, { recursive: true });

  for (const { collection, jsonSchema } of schemas) {
    const schemaPath = path.join(jsonSchemasOutFolder, `${collection}.schema.json`);
    const content = `${JSON.stringify(jsonSchema, null, 2)}\n`;
    await fs.promises.writeFile(schemaPath, content, "utf8");
  }
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
  const jsonSchemas = schemas.map(({ collection, schema }) => ({
    collection,
    jsonSchema: convertValidatorToJsonSchema(schema),
  }));

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
  await writeJsonSchemas(jsonSchemas);
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
