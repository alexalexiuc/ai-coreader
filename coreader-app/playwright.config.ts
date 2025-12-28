import path from 'path';
import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3000';
const storageRoot = process.env.FILE_STORAGE_ROOT ?? path.join(__dirname, '..', 'storage');
const mongodbUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const mongodbDbName = process.env.MONGODB_DB_NAME ?? 'llm_reader_e2e';

process.env.FILE_STORAGE_ROOT = storageRoot;
process.env.MONGODB_URI = mongodbUri;
process.env.MONGODB_DB_NAME = mongodbDbName;

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev:e2e',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      FILE_STORAGE_ROOT: storageRoot,
      MONGODB_URI: mongodbUri,
      MONGODB_DB_NAME: mongodbDbName,
    },
  },
});
