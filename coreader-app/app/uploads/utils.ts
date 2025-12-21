import { FileStatus } from './types';

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
