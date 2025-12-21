import { useCallback, useMemo, useState } from 'react';
import type { UploadedFile, FilterKey, SortKey } from '@/lib/uploads';
import { statusOrder } from '@/lib/uploads';

export default function useFiles(initialFiles: UploadedFile[] = []) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [files, setFiles] = useState<UploadedFile[]>(initialFiles);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: files.length,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const f of files) {
      if (f.status === 'processing') c.processing += 1;
      if (f.status === 'completed') c.completed += 1;
      if (f.status === 'failed') c.failed += 1;
    }

    return c;
  }, [files]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const byText = (f: UploadedFile) => {
      if (!q) return true;
      return f.originalName.toLowerCase().includes(q);
    };

    const byFilter = (f: UploadedFile) => {
      if (filter === 'all') return true;
      return f.status === filter;
    };

    const list = files.filter((f) => byText(f) && byFilter(f));

    const sorted = [...list].sort((a, b) => {
      if (sort === 'name') return a.originalName.localeCompare(b.originalName);

      if (sort === 'status') {
        const ao = statusOrder(a.status);
        const bo = statusOrder(b.status);
        if (ao !== bo) return ao - bo;
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      }

      const at = new Date(a.uploadedAt).getTime();
      const bt = new Date(b.uploadedAt).getTime();
      return sort === 'oldest' ? at - bt : bt - at;
    });

    return sorted;
  }, [files, filter, query, sort]);

  const isEmptyAll = files.length === 0;
  const isEmptyFiltered = !isEmptyAll && filtered.length === 0;

  const retryFile = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              status: 'processing',
              progressPct: 0,
              errorMessage: undefined,
            }
          : f,
      ),
    );
  }, []);

  const deleteFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return {
    files,
    setFiles,
    query,
    setQuery,
    filter,
    setFilter,
    sort,
    setSort,
    counts,
    filtered,
    isEmptyAll,
    isEmptyFiltered,
    retryFile,
    deleteFile,
  } as const;
}
