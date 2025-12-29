'use server';

import { revalidatePath } from 'next/cache';
import { saveUploadedFile, deleteStoredFile, FOLDERS } from '@/lib/files/storage';
import { deleteFileById, insertFileMetadata, listFiles, type FileDTO } from '@/lib/db/files';

export async function uploadFileAction(formData: FormData): Promise<FileDTO> {
  const file = formData.get('file') as File | null;

  if (!file || file.size === 0) {
    throw new Error('No file uploaded');
  }

  const { storageName, storagePath, size } = await saveUploadedFile(file, FOLDERS.FILES);

  const inserted = await insertFileMetadata({
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size,
    storagePath,
    storageName,
    status: 'pending',
  });

  // Revalidate listing page
  revalidatePath('/uploads');

  return inserted;
}

export async function deleteFileAction(id: string) {
  const doc = await deleteFileById(id);
  if (doc) {
    await deleteStoredFile(doc.storagePath, doc.storageName);
  }

  revalidatePath('/uploads');
}

export async function listFilesAction(): Promise<FileDTO[]> {
  return listFiles();
}
