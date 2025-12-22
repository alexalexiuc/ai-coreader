import { dotenvLoad } from "dotenv-mono";
dotenvLoad(); // Dotenv instance
import { MongoClient } from "mongodb";

export const getMongoDb = async () => {
  const { MONGODB_DB_NAME, MONGODB_URI } = process.env;

  if (!MONGODB_DB_NAME) {
    throw new Error("missing env var MONGODB_DB_NAME");
  }

  if (!MONGODB_URI) {
    throw new Error("missing env var MONGODB_URI");
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  console.log("Connected to MongoDB");

  return client.db(MONGODB_DB_NAME);
};

export function toPascalCase(name) {
  return name
    .replace(/(^|[_-])+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "id") return "ID";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}
