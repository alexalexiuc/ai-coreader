import { listFiles, type FileStatus } from './files';

type BookMetadata = {
  id: string;
  title: string;
  author: string;
  status: FileStatus;
  added: string;
  iconUrl?: string;
};

export const fetchBooks = async (): Promise<BookMetadata[]> => {
  // get raw uploaded books from database
  const rawBooks = await listFiles();
  return rawBooks.map((b) => ({
    id: b.id,
    title: b.originalName,
    author: 'Unknown Author',
    status: b.status,
    added: b.createdAt,
  }));
};
