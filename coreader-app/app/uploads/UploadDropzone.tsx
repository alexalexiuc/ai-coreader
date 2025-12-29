import { useState, useTransition } from 'react';
import { IoCheckmarkCircleOutline, IoCloudUploadOutline, IoWarningOutline } from 'react-icons/io5';
import { uploadFileAction } from './actions';
import { FileUpload } from '@/ui/FileUpload';
import { Button } from '@/ui/Button';
import { Section } from '@/ui/Section';
import type { UploadedFile } from './types';
import { toUploadedFile } from './utils';

type UploadDropzoneProps = {
  onUploadSuccess?: (file: UploadedFile) => void;
};

export function UploadDropzone({ onUploadSuccess }: UploadDropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'success' | 'error' | null>(null);
  const [isPending, startTransition] = useTransition();

  const newFile = (f: File | null) => {
    setFile(f);
    setMessage(null);
    setStatus(null);
  };

  const reset = () => {
    setMessage(null);
    setStatus(null);
    setFile(null);
  };

  const handleUpload = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setMessage(null);
    setStatus(null);

    startTransition(async () => {
      try {
        const inserted = await uploadFileAction(formData);
        onUploadSuccess?.(toUploadedFile(inserted));
        setMessage('Uploaded! We will process the book and add it to your library shortly.');
        setStatus('success');
        setFile(null);
      } catch (err: any) {
        const text = err?.message || 'Upload failed. Please try again.';
        setMessage(text);
        setStatus('error');
      }
    });
  };

  return (
    <Section paddingClass="p-5" header={{ title: 'Upload', titleSize: 'lg' }}>
      <div className="mt-2">
        <FileUpload accept={['text/plain', '.txt']} value={file} onFileSelect={newFile} label="Drop your book file" />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          onClick={handleUpload}
          disabled={!file || isPending}
          loading={isPending}
          leftIcon={<IoCloudUploadOutline className="h-5 w-5" />}
        >
          Upload book
        </Button>
        <Button onClick={() => reset()} disabled={!file || isPending} className="text-gray-300">
          Clear selection
        </Button>
        {file && !isPending && <span className="text-xs text-gray-500">Ready to upload: {file.name}</span>}
      </div>

      {message && (
        <div
          className={`mt-6 flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${
            status === 'success' ? 'border border-green-800 bg-green-950 text-green-200' : 'border border-red-800 bg-red-950 text-red-200'
          }`}
        >
          {status === 'success' ? <IoCheckmarkCircleOutline className="h-5 w-5" /> : <IoWarningOutline className="h-5 w-5" />}
          <span>{message}</span>
        </div>
      )}
    </Section>
  );
}
