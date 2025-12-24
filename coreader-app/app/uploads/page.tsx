import type { UploadedFile } from '@/app/uploads/types';
import UploadsClientPage from '@/app/uploads/UploadsClientPage';
import { listFilesWithBooks, type FileStatus, type FileWithBookDTO } from '@/lib/db/files';
import { clampPct } from '@/lib/number';

export const dynamic = 'force-dynamic';

export default async function FilesPage() {
  const files = await listFilesWithBooks();
  const uploads = files.map(toUploadedFile);

  return <UploadsClientPage initialFiles={uploads} />;
}

function mapStatus(status: FileStatus): UploadedFile['status'] {
  if (status === 'failed') return 'failed';
  if (status === 'processed') return 'completed';
  return 'processing';
}

function toUploadedFile(file: FileWithBookDTO): UploadedFile {
  const status = mapStatus(file.status);
  const rawPct = typeof file.percentage === 'number' && !Number.isNaN(file.percentage) ? file.percentage : undefined;
  const progressPct = status === 'completed' || rawPct === undefined ? undefined : clampPct(Math.floor(rawPct));

  return {
    id: file.id,
    originalName: file.originalName,
    sizeBytes: file.size,
    uploadedAt: file.createdAt,
    status,
    progressPct,
    bookId: file.bookId,
    bookTitle: file.bookTitle,
  };
}
