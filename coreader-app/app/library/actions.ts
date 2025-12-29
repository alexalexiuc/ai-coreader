'use server';

import { listBooks, type BookDTO } from '@/lib/db/books';

export async function listBooksAction(): Promise<BookDTO[]> {
  return listBooks();
}
