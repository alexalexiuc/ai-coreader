import UploadsClientPage from '@/app/uploads/UploadsClientPage';
import { toUploadedFile } from '@/app/uploads/utils';
import { listFilesWithBooks } from '@/lib/db/files';
import { getCurrentUser } from '@/lib/auth/cookies';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export default async function FilesPage() {
  const user = await getCurrentUser();
  
  // Only show files if user is authenticated
  const files = user ? await listFilesWithBooks(new ObjectId(user.id)) : [];
  const uploads = files.map(toUploadedFile);

  return <UploadsClientPage initialFiles={uploads} />;
}
