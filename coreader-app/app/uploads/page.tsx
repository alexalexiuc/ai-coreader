import UploadsClientPage from '@/app/uploads/UploadsClientPage';
import { toUploadedFile } from '@/app/uploads/utils';
import { listFilesWithBooks } from '@/lib/db/files';

export const dynamic = 'force-dynamic';

export default async function FilesPage() {
  const files = await listFilesWithBooks();
  const uploads = files.map(toUploadedFile);

  return <UploadsClientPage initialFiles={uploads} />;
}
