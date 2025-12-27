import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export function getStorageRoot(): string {
  if (!process.env.FILE_STORAGE_ROOT) {
    throw new Error('FILE_STORAGE_ROOT is not set in environment variables');
  }
  return process.env.FILE_STORAGE_ROOT;
}

export const FOLDERS = {
  FILES: 'files',
};

console.log('Must be visible');

const makeDirIfNotExists = async (dirPath: string) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err: any) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
};

const ensureStorageReady = (() => {
  console.info('Initializing storage directories...');
  let init: Promise<void> | null = null;
  return () => {
    if (!init) {
      init = (async () => {
        const root = getStorageRoot();
        await makeDirIfNotExists(root);
        for (const folder of Object.values(FOLDERS)) {
          await makeDirIfNotExists(path.join(root, folder));
        }
      })();
    }
    return init;
  };
})();

// ensureStorageReady().catch((err) => {
//   console.error('Failed to initialize storage directories:', err);
// });

/**
 * Save an uploaded File (from FormData) to disk.
 * Returns generated storageName (filename) and size.
 */
export async function saveUploadedFile(
  file: File,
  folder: string,
): Promise<{
  storageName: string;
  storagePath: string;
  size: number;
}> {
  await ensureStorageReady();

  const ext = path.extname(file.name);
  const storageName = `${randomUUID()}${ext || ''}`;
  const fullPath = path.join(getStorageRoot(), folder, storageName);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(fullPath, buffer);

  return { storageName, storagePath: folder, size: buffer.length };
}

export async function deleteStoredFile(storagePath: string, storageName: string): Promise<void> {
  const fullPath = path.join(getStorageRoot(), storagePath, storageName);
  try {
    await fs.unlink(fullPath);
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      // already gone; ignore
      return;
    }
    throw err;
  }
}
