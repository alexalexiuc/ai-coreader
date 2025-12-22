import { compile as compileJsonSchema } from "json-schema-to-typescript";
import prettier from "prettier";

const defaultBanner = [
  "/* eslint-disable */",
  "",
  "/**",
  "* This file was automatically generated.",
  "*",
  "* Do not modify it by hand",
  "*/",
];

const bsonToTs = new Map([
  ["number", { ts: "number" }],
  ["double", { ts: "number" }],
  ["string", { ts: "string" }],
  ["bool", { ts: "boolean" }],
  ["date", { ts: "Date" }],
  ["null", { ts: "null" }],
  ["int", { ts: "number" }],
  ["decimal", { ts: "Decimal128", import: "Decimal128" }],
  ["objectId", { ts: "ObjectId", import: "ObjectId" }],
  ["binData", { ts: "Binary", import: "Binary" }],
  ["long", { ts: "Long", import: "Long" }],
  ["timestamp", { ts: "Timestamp", import: "Timestamp" }],
  ["regex", { ts: "RegExp" }],
  ["javascript", { ts: "Code", import: "Code" }],
  ["javascriptWithScope", { ts: "Code", import: "Code" }],
  ["dbPointer", { ts: "DBRef", import: "DBRef" }],
  ["symbol", { ts: "BSONSymbol", import: "BSONSymbol" }],
  ["minKey", { ts: "MinKey", import: "MinKey" }],
  ["maxKey", { ts: "MaxKey", import: "MaxKey" }],
]);

function formatTs(text, options) {
  return prettier.format(text, { ...(options || {}), parser: "typescript" });
}

function buildTsType(bsonType, imports) {
  if (Array.isArray(bsonType)) {
    return bsonType
      .map((b) => buildTsType(b, imports))
      .filter(Boolean)
      .join("|");
  }

  if (typeof bsonType !== "string") return null;

  const mapping = bsonToTs.get(bsonType);
  if (!mapping) return null;

  if (mapping.import) {
    imports.add(mapping.import);
  }

  return mapping.ts;
}

function setTsType(schema, imports) {
  if (Array.isArray(schema)) {
    return schema.map((s) => setTsType(s, imports));
  }

  if (typeof schema === "object" && schema !== null) {
    const bsonType = "bsonType" in schema ? schema.bsonType : undefined;
    const isEnum = Reflect.has(schema, "enum");
    const tsType = buildTsType(bsonType, imports);
    const annotated = !isEnum && tsType ? { ...schema, tsType } : schema;

    return Object.entries(annotated).reduce((acc, [key, value]) => {
      return { ...acc, [key]: setTsType(value, imports) };
    }, {});
  }

  return schema;
}

export async function compileBSON(schema, options) {
  const imports = new Set();
  const newSchema = setTsType(schema, imports);

  const baseBanner = options?.bannerComment || defaultBanner;
  const mongoImports = [...imports];

  const bannerComment =
    mongoImports.length > 0
      ? [
          ...baseBanner,
          `import { ${mongoImports.sort().join(", ")} } from "mongodb";`,
        ]
      : baseBanner;

  const compileOptions = {
    bannerComment: bannerComment.join("\n"),
    enableConstEnums: options?.enableConstEnums,
    ignoreMinAndMaxItems: options?.ignoreMinAndMaxItems,
    strictIndexSignatures: options?.strictIndexSignatures,
    unknownAny: options?.unknownAny,
  };

  const output = await compileJsonSchema(newSchema, "", compileOptions);
  return formatTs(output, options?.prettier);
}
