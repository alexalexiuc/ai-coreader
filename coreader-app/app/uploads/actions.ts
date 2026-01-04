'use server';

import { revalidatePath } from 'next/cache';
import { saveUploadedFile, deleteStoredFile, FOLDERS } from '@/lib/files/storage';
import {
  deleteFileById,
  insertFileMetadata,
  listFilesWithBooks,
  resetFileForReprocessing,
  getFileById,
  type FileDTO,
  type FileWithBookDTO,
} from '@/lib/db/files';
import { getCurrentUser } from '@/lib/auth/cookies';
import { ObjectId } from 'mongodb';

export async function uploadFileAction(formData: FormData): Promise<FileDTO> {
  const file = formData.get('file') as File | null;

  if (!file || file.size === 0) {
    throw new Error('No file uploaded');
  }

  // Get current user
  const user = await getCurrentUser();
  const userId = user ? new ObjectId(user.id) : undefined;

  const { storageName, storagePath, size } = await saveUploadedFile(file, FOLDERS.FILES);

  const inserted = await insertFileMetadata({
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size,
    storagePath,
    storageName,
    status: 'pending',
    userId,
  });

  // Revalidate listing page
  revalidatePath('/uploads');

  return inserted;
}

export async function deleteFileAction(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized: Please log in');
  }

  const doc = await deleteFileById(id);
  if (doc) {
    // Check ownership
    if (doc.userId && doc.userId.toHexString() !== user.id) {
      throw new Error('Unauthorized: You do not own this file');
    }
    await deleteStoredFile(doc.storagePath, doc.storageName);
  }

  revalidatePath('/uploads');
}

export async function listFilesAction(): Promise<FileWithBookDTO[]> {
  const user = await getCurrentUser();
  if (!user) {
    return []; // Return empty list for unauthenticated users
  }

  // Filter to only return files belonging to the user
  return listFilesWithBooks(new ObjectId(user.id));
}

export async function reprocessFileAction(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized: Please log in');
  }

  const file = await getFileById(id);
  if (!file) {
    throw new Error('File not found');
  }

  // Check ownership
  if (file.userId && file.userId.toHexString() !== user.id) {
    throw new Error('Unauthorized: You do not own this file');
  }

  await resetFileForReprocessing(id);
  revalidatePath('/uploads');
}
