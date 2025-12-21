export type FileStatus = 'processing' | 'completed' | 'failed';

export type UploadedFile = {
  id: string;
  originalName: string;
  sizeBytes: number;
  uploadedAt: string; // ISO
  status: FileStatus;
  progressPct?: number; // 0..100 (optional)
  errorMessage?: string;
  bookId?: string;
  bookTitle?: string;
};

export type FilterKey = 'all' | 'processing' | 'completed' | 'failed';
export type SortKey = 'recent' | 'oldest' | 'name' | 'status';

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
