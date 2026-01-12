const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const appRoot = path.join(repoRoot, 'coreader-app');

function usage() {
  console.error('Usage: node scripts/lint-staged-coreader-app.cjs <eslint|prettier> <files...>');
  process.exit(1);
}

function resolveToolScript(relativePathFromRepoRoot) {
  const absPath = path.join(repoRoot, relativePathFromRepoRoot);
  if (!fs.existsSync(absPath)) {
    console.error(`[lint-staged] Missing tool at ${absPath}. Did you run npm install at repo root?`);
    process.exit(1);
  }
  return absPath;
}

function toAppPath(filePath) {
  if (!filePath) return null;

  if (!path.isAbsolute(filePath)) {
    return filePath.replace(/^coreader-app[\\/]/, '');
  }

  const normalizedFilePath = path.normalize(filePath);
  const normalizedAppRoot = path.normalize(appRoot + path.sep);

  if (normalizedFilePath.toLowerCase().startsWith(normalizedAppRoot.toLowerCase())) {
    return path.relative(appRoot, normalizedFilePath);
  }

  return filePath;
}

const mode = process.argv[2];
if (!mode) usage();

const files = process.argv.slice(3).map(toAppPath).filter(Boolean);
if (files.length === 0) process.exit(0);

let result;
if (mode === 'eslint') {
  const eslintScript = resolveToolScript(path.join('node_modules', 'eslint', 'bin', 'eslint.js'));
  result = spawnSync(process.execPath, [eslintScript, '--fix', ...files], { cwd: appRoot, stdio: 'inherit' });
} else if (mode === 'prettier') {
  const prettierScript = resolveToolScript(path.join('node_modules', 'prettier', 'bin', 'prettier.cjs'));
  result = spawnSync(
    process.execPath,
    [prettierScript, '--config', '.prettierrc', '--ignore-path', '.prettierignore', '--write', ...files],
    { cwd: appRoot, stdio: 'inherit' },
  );
} else {
  usage();
}

if (result.error) {
  console.error(`[lint-staged] Failed to run ${mode}:`, result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
