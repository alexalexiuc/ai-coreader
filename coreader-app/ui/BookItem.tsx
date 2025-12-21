import type { ElementType } from 'react';
import Image from 'next/image';
import {
  IoCheckmarkCircleOutline,
  IoTimeOutline,
  IoWarningOutline,
} from 'react-icons/io5';
import type { FileStatus } from '@/lib/db/files';

type BookItemProps = {
  title: string;
  author?: string;
  iconUrl?: string;
  added: string;
  status: FileStatus;
};

const statusConfig: Record<FileStatus, { label: string; icon: ElementType; classes: string }> = {
  pending: {
    label: 'Pending',
    icon: IoTimeOutline,
    classes: 'text-amber-300 border-amber-700 bg-amber-900/30',
  },
  processing: {
    label: 'Processing',
    icon: IoTimeOutline,
    classes: 'text-amber-300 border-amber-700 bg-amber-900/30',
  },
  processed: {
    label: 'Ready',
    icon: IoCheckmarkCircleOutline,
    classes: 'text-emerald-300 border-emerald-700 bg-emerald-900/30',
  },
  failed: {
    label: 'Failed',
    icon: IoWarningOutline,
    classes: 'text-red-300 border-red-700 bg-red-900/30',
  },
};

export const BookItem = ({ title, author, iconUrl, added, status }: BookItemProps) => {
  const displayDate = new Date(added).toLocaleString();
  const { label, icon: Icon, classes } = statusConfig[status] ?? statusConfig.pending;

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 transition hover:border-blue-600 hover:bg-gray-900">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-12 overflow-hidden rounded-lg bg-gray-800">
          <Image
            src={iconUrl || '/no-image.svg'}
            alt="Book Cover Image"
            fill
            className="object-cover"
            sizes="64px"
            placeholder="blur"
            blurDataURL="/no-image.svg"
          />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {author && <p className="text-sm text-gray-400">{author}</p>}
          <p className="text-xs text-gray-500">Uploaded {displayDate}</p>
        </div>
      </div>

      <div
        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${classes}`}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
    </div>
  );
};
