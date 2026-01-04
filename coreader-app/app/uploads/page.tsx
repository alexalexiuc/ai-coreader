import UploadsClientPage from '@/app/uploads/UploadsClientPage';
import { toUploadedFile } from '@/app/uploads/utils';
import { listFilesWithBooks } from '@/lib/db/files';
import { getCurrentUser } from '@/lib/auth/cookies';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export default async function FilesPage() {
  const user = await getCurrentUser();
  const userId = user ? new ObjectId(user.id) : undefined;
  
  const files = await listFilesWithBooks(userId);
  const uploads = files.map(toUploadedFile);

  return <UploadsClientPage initialFiles={uploads} />;
}
