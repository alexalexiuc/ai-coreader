import { IoPin, IoPinOutline } from 'react-icons/io5';
import { LibraryBook } from './types';
import { SquareButton } from '@/ui/SquareButton';

type PinButtonProps = {
  book: LibraryBook;
  onTogglePin: (id: string) => void | Promise<void>;
};

export const PinButton: React.FC<PinButtonProps> = ({ book, onTogglePin }) => (
  <SquareButton
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onTogglePin(book.id);
    }}
    aria-label={book.isPinned ? 'Unpin book' : 'Pin book'}
    title={book.isPinned ? 'Unpin' : 'Pin'}
  >
    {book.isPinned ? <IoPin /> : <IoPinOutline />}
  </SquareButton>
);
