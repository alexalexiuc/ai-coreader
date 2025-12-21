'use client';

import type { DragEvent } from 'react';
import clsx from 'clsx';
import { useCallback, useRef, useState } from 'react';
import { IoCloudUploadOutline, IoClose, IoDocumentTextOutline } from 'react-icons/io5';

type FileUploadProps = {
  onFileSelect: (file: File | null) => void;
  value?: File | null;
  accept?: string[] | string;
  label?: string;
  description?: string;
  className?: string;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(size >= 10 || size === 0 ? 0 : 1)} ${units[i]}`;
};

export function FileUpload({
  accept,
  onFileSelect,
  value,
  label = 'Drag & drop your file',
  description,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptAttr = Array.isArray(accept) ? accept.join(',') : accept;

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const nextFile = files[0];
      onFileSelect(nextFile);

      // Reset input so the same file can be picked again if needed.
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [onFileSelect],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const clearFile = useCallback(() => {
    onFileSelect(null);
  }, [onFileSelect]);

  return (
    <div className={clsx('space-y-3 text-left', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        onChange={(event) => handleFiles(event.target.files)}
        className="hidden"
        multiple={false}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openFilePicker()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={clsx(
          'flex cursor-pointer flex-row items-center justify-center gap-8 rounded-2xl border-2 border-dashed p-6 text-center transition',
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-800 bg-gray-950 hover:border-blue-500 hover:bg-gray-900',
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
          <IoCloudUploadOutline className="h-7 w-7" />
        </div>
        <div className="flex flex-col items-center justify-center">
          <p className="text-base font-semibold text-white">{label}</p>
          <p className="mt-1 text-sm text-gray-400">
            <span className="font-medium text-blue-300">Click to browse</span> or drop it here
          </p>
          {description && <p className="mt-2 text-xs text-gray-500">{description}</p>}
          {acceptAttr && <p className="mt-2 text-xs text-gray-500">Accepts: {acceptAttr}</p>}
        </div>
      </div>

      {value && (
        <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-gray-100">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
              <IoDocumentTextOutline className="h-5 w-5" />
            </span>
            <div className="text-left">
              <p className="font-medium text-white">{value.name}</p>
              <p className="text-xs text-gray-400">{formatBytes(value.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-800 hover:text-red-400"
            aria-label="Remove selected file"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
