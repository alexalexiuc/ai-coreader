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
