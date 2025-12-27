/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const net = require('net');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_URI = 'mongodb://localhost:27017';
const CONTAINER_NAME = 'coreader-mongo';
const DEFAULT_PORT = 27017;

function readEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const values = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const idx = trimmed.indexOf('=');
    if (idx === -1) {
      continue;
    }

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key) {
      values[key] = value;
    }
  }

  return values;
}

function getMongoUri() {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  const envValues = readEnvFile();
  return envValues.MONGODB_URI || DEFAULT_URI;
}

function parseMongoHost(uri) {
  try {
    const parsed = new URL(uri);
    const port = parsed.port ? Number(parsed.port) : DEFAULT_PORT;
    return { host: parsed.hostname, port };
  } catch (error) {
    return { host: 'localhost', port: DEFAULT_PORT };
  }
}

function isReachable(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function hasDocker() {
  try {
    execFileSync('docker', ['--version'], { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function containerExists() {
  const output = execFileSync('docker', ['ps', '-a', '--filter', `name=${CONTAINER_NAME}`, '--format', '{{.Names}}'], {
    encoding: 'utf8',
  }).trim();

  return output.split(/\r?\n/).includes(CONTAINER_NAME);
}

function startDockerContainer() {
  if (containerExists()) {
    execFileSync('docker', ['start', CONTAINER_NAME], { stdio: 'inherit' });
    return;
  }

  execFileSync('docker', ['run', '-d', '--name', CONTAINER_NAME, '-p', `${DEFAULT_PORT}:${DEFAULT_PORT}`, 'mongo:7'], { stdio: 'inherit' });
}

async function main() {
  const uri = getMongoUri();
  const { host, port } = parseMongoHost(uri);

  if (await isReachable(host, port)) {
    console.log(`MongoDB reachable at ${host}:${port}.`);
    return;
  }

  if (!['localhost', '127.0.0.1'].includes(host) || port !== DEFAULT_PORT) {
    console.error(`MongoDB not reachable at ${host}:${port}. Start it manually or set MONGODB_URI to a reachable host.`);
    process.exit(1);
  }

  if (!hasDocker()) {
    console.error('MongoDB is not running and Docker is unavailable. Start MongoDB locally or install Docker.');
    process.exit(1);
  }

  console.log('Starting MongoDB via Docker...');
  startDockerContainer();
}

main().catch((error) => {
  console.error('Failed to ensure MongoDB:', error);
  process.exit(1);
});
