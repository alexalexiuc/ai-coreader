import fs from 'fs/promises';
import path from 'path';
import type { NextRequest } from 'next/server';
import { getFileById } from '@/lib/db/files';
import { getStorageRoot } from '@/lib/files/storage';
import { getCurrentUser } from '@/lib/auth/cookies';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const file = await getFileById(params.id);
  if (!file?._id) {
    return new Response('File not found', { status: 404 });
  }

  // Check ownership
  if (file.userId && file.userId.toHexString() !== user.id) {
    return new Response('Forbidden: You do not have access to this file', { status: 403 });
  }

  try {
    const storageRoot = getStorageRoot();
    const fullPath = path.join(storageRoot, file.storagePath, file.storageName);
    const buffer = await fs.readFile(fullPath);
    const encodedName = encodeURIComponent(file.originalName || 'download');

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Length': buffer.byteLength.toString(),
        'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      },
    });
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return new Response('File not found', { status: 404 });
    }

    console.error(`Failed to download file ${params.id}:`, err);
    return new Response('Unable to download file', { status: 500 });
  }
}
