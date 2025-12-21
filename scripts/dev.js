#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

function spawnWin() {
  const psPath = 'powershell.exe';
  const args = ['-ExecutionPolicy', 'Bypass', '-File', path.join(repoRoot, 'scripts', 'dev.ps1')];
  const ps = spawn(psPath, args, { stdio: 'inherit' });
  ps.on('close', (code) => process.exit(code));
}

function spawnUnix() {
  const sh = 'bash';
  const args = [path.join(repoRoot, 'scripts', 'dev.sh')];
  const p = spawn(sh, args, { stdio: 'inherit' });
  p.on('close', (code) => process.exit(code));
}

if (isWin) {
  console.log('Detected Windows — launching PowerShell dev script...');
  spawnWin();
} else {
  console.log('Detected Unix-like platform — launching bash dev script...');
  spawnUnix();
}
