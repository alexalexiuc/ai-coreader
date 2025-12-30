'use client';

import { useFiles } from '@/hooks';
import type { FilterKey, SortKey, UploadedFile } from '@/app/uploads/types';
import { deleteFileAction, listFilesAction } from '@/app/uploads/actions';
import { FileRow } from '@/app/uploads/FileRow';
import { EmptyFiltered, EmptyUploads } from '@/app/uploads/UploadEmptyStates';
import { UploadDropzone } from '@/app/uploads/UploadDropzone';
import { toUploadedFile } from '@/app/uploads/utils';
import { PageContainer } from '@/ui/PageContainer';
import { Section } from '@/ui/Section';
import { SectionHeader } from '@/ui/SectionHeader';
import { Select } from '@/ui/Select';
import { ViewToggle } from '@/ui/ViewToggle';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { useEffect, useTransition } from 'react';
import { IoLibraryOutline, IoSearchOutline, IoStorefrontOutline } from 'react-icons/io5';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'name', label: 'File name A-Z' },
  { key: 'status', label: 'Status' },
];

type UploadsClientPageProps = {
  initialFiles: UploadedFile[];
};

export default function UploadsClientPage({ initialFiles }: UploadsClientPageProps) {
  const [, startTransition] = useTransition();
  const {
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
    addFile,
  } = useFiles(initialFiles);
  const shouldPoll = files.some((file) => file.status === 'processing');

  useEffect(() => {
    if (!shouldPoll) return;
    const interval = setInterval(() => {
      // TODO(coreader-app): replace polling with websockets for upload status updates.
      listFilesAction()
        .then((nextFiles) => {
          setFiles(nextFiles.map(toUploadedFile));
        })
        .catch((err) => {
          console.error('Failed to refresh uploads', err);
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [setFiles, shouldPoll]);

  const onDownload = (id: string) => {
    const url = `/api/files/${id}/download`;
    window.open(url, '_blank', 'noopener');
  };

  const onDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteFileAction(id);
        deleteFile(id);
      } catch (err) {
        console.error('Failed to delete file', err);
      }
    });
  };

  return (
    <PageContainer>
      <SectionHeader
        label="Uploads"
        title="Files"
        description="Uploaded files appear here while they are processed into readable books."
        actions={<AvailableActions />}
      />

      <UploadDropzone onUploadSuccess={addFile} />

      <Section paddingClass="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <IoSearchOutline className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2 pr-3 pl-10 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-slate-700"
            />
          </div>

          <div className="flex items-center gap-2 sm:justify-end">
            <Select value={sort} onChange={setSort} options={SORTS} ariaLabel="Sort" className="w-36" />
          </div>
        </div>
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ViewToggle
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({
            key: f.key,
            label: (
              <span>
                {f.label}
                <span className="ml-2 rounded-full border border-slate-800 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-400">
                  {counts[f.key]}
                </span>
              </span>
            ),
          }))}
        />
      </div>

      <Section
        paddingClass="p-5"
        header={{
          title: 'Uploaded files',
          titleSize: 'lg',
          actions: <span className="text-xs text-slate-500">{filtered.length} shown</span>,
        }}
      >
        {isEmptyAll ? (
          <EmptyUploads />
        ) : isEmptyFiltered ? (
          <EmptyFiltered query={query} filter={filter} onClear={() => setQuery('')} />
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <div className="hidden grid-cols-12 gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400 sm:grid">
              <div className="col-span-5">File</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-2">Uploaded</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            <div className="divide-y divide-slate-800">
              {filtered.map((f) => (
                <FileRow key={f.id} file={f} onRetry={retryFile} onDelete={onDelete} onDownload={onDownload} />
              ))}
            </div>
          </div>
        )}
      </Section>
    </PageContainer>
  );
}

function AvailableActions() {
  return (
    <div className="flex items-center gap-2">
      <Button href="/library" leftIcon={<IoLibraryOutline />}>
        Library
      </Button>
      <Button href="/shop" leftIcon={<IoStorefrontOutline />} disabled>
        Shop <Badge>Soon</Badge>
      </Button>
    </div>
  );
}
