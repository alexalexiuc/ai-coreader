import type { UploadedFile } from '../../lib/uploads';

export const MOCK_UPLOADS: UploadedFile[] = [
  {
    id: 'f1',
    originalName: 'foundation.txt',
    sizeBytes: 2_340_120,
    uploadedAt: '2025-12-18T19:05:00.000Z',
    status: 'completed',
    bookId: 'b1',
    bookTitle: 'Foundation',
  },
  {
    id: 'f2',
    originalName: 'i_robot.txt',
    sizeBytes: 1_124_221,
    uploadedAt: '2025-12-19T08:40:00.000Z',
    status: 'processing',
    progressPct: 63,
  },
  {
    id: 'f3',
    originalName: 'some_scan.pdf',
    sizeBytes: 18_204_332,
    uploadedAt: '2025-12-19T10:10:00.000Z',
    status: 'failed',
    errorMessage: 'Unsupported format (PDF) for now.',
  },
  {
    id: 'f4',
    originalName: 'bradbury_martian_chronicles.txt',
    sizeBytes: 4_800_004,
    uploadedAt: '2025-12-10T12:01:00.000Z',
    status: 'completed',
    bookId: 'b4',
    bookTitle: 'The Martian Chronicles',
  },
];
