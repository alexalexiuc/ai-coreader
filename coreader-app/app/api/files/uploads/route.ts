import { revalidatePath } from 'next/cache';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCurrentUser } from '@/lib/auth/cookies';
import { insertFileMetadata, type FileDTO } from '@/lib/db/files';
import { FOLDERS, saveUploadedFile } from '@/lib/files/storage';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest): Promise<Response> {
  const contentLength = req.headers.get('content-length');
  if (contentLength) {
    const bytes = Number(contentLength);
    if (Number.isFinite(bytes) && bytes > MAX_UPLOAD_BYTES) {
      return new Response('Body exceeded 10 MB limit.', { status: 413 });
    }
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response('Invalid multipart form data', { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return new Response('No file uploaded', { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return new Response('File exceeded 10 MB limit.', { status: 413 });
  }

  const user = await getCurrentUser();
  const userId = user ? new ObjectId(user.id) : undefined;

  try {
    const { storageName, storagePath, size } = await saveUploadedFile(file, FOLDERS.FILES);

    const inserted: FileDTO = await insertFileMetadata({
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size,
      storagePath,
      storageName,
      status: 'pending',
      userId,
    });

    revalidatePath('/uploads');

    return Response.json(inserted, { status: 201 });
  } catch (err) {
    console.error('Upload failed:', err);
    return new Response('Upload failed', { status: 500 });
  }
}
