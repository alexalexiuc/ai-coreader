import { fetchBooks } from '@/lib/db/books';
import { BookItem } from './BookItem';

export const BooksList = async () => {
  const books = await fetchBooks();

  return (
    <div className="space-y-4">
      {books.map((book) => (
        <BookItem
          key={book.id}
          title={book.title}
          author={book.author}
          iconUrl={book.iconUrl}
          status={book.status}
          added={book.added}
        />
      ))}
    </div>
  );
};
