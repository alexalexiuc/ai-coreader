/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const { spawnSync } = require('child_process');

function runNpm(label, args) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  const result = spawnSync(npmCmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  return result;
}

function runNode(label, scriptRelPath) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const scriptPath = path.join(repoRoot, scriptRelPath);

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`Failed to run ${label}. Exit code: ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.warn(`Env ${name} not set; using defaults if provided downstream.`);
  }
  return val;
}

(function main() {
  // Ensure we have envs available for infra scripts
  requireEnv('MONGODB_URI');
  requireEnv('MONGODB_DB_NAME');

  console.log('Resetting E2E DB (drop + migrate)...');
  {
    const res = runNpm('db:reset', ['run', 'db:reset']);
    if (res.status !== 0) {
      const code = res.status ?? 'null';
      const errMsg = res.error ? String(res.error.message || res.error) : 'unknown error';
      console.warn(`[db:reset] npm run failed (exit=${code}). Fallback to direct scripts.`, errMsg);
      runNode('db:drop', 'infra/db/scripts/drop-database.js');
      runNode('db:migrate', 'infra/db/scripts/migrate.js');
    }
  }

  console.log('Applying DB seeds for E2E...');
  {
    const res = runNpm('db:seed', ['run', 'db:seed']);
    if (res.status !== 0) {
      const code = res.status ?? 'null';
      const errMsg = res.error ? String(res.error.message || res.error) : 'unknown error';
      console.warn(`[db:seed] npm run failed (exit=${code}). Fallback to direct script.`, errMsg);
      runNode('seed', 'infra/db/scripts/seed.js');
    }
  }

  console.log('E2E DB setup complete.');
})();
