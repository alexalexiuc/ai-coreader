import type { FileDTO, FileStatus as DbFileStatus, FileWithBookDTO } from '@/lib/db/files';
import { clampPct } from '@/lib/number';
import { FileStatus, type UploadedFile } from './types';

export function statusLabel(status: FileStatus) {
  switch (status) {
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

export function statusOrder(status: FileStatus) {
  if (status === 'processing') return 0;
  if (status === 'failed') return 1;
  return 2;
}

export function mapFileStatus(status: DbFileStatus): UploadedFile['status'] {
  if (status === 'failed') return 'failed';
  if (status === 'processed') return 'completed';
  return 'processing';
}

export function toUploadedFile(file: FileDTO | FileWithBookDTO): UploadedFile {
  const status = mapFileStatus(file.status);
  const rawPct = typeof file.percentage === 'number' && !Number.isNaN(file.percentage) ? file.percentage : undefined;
  const progressPct = status === 'completed' || rawPct === undefined ? undefined : clampPct(Math.floor(rawPct));
  const rawEntityPct = typeof file.entityPercentage === 'number' && !Number.isNaN(file.entityPercentage) ? file.entityPercentage : undefined;
  const entityProgressPct = status === 'completed' || rawEntityPct === undefined ? undefined : clampPct(Math.floor(rawEntityPct));

  return {
    id: file.id,
    originalName: file.originalName,
    sizeBytes: file.size,
    uploadedAt: file.createdAt,
    status,
    progressPct,
    entityProgressPct,
    textProcessed: file.textProcessed ?? false,
    bookId: 'bookId' in file ? file.bookId : undefined,
    bookTitle: 'bookTitle' in file ? file.bookTitle : undefined,
  };
}
