/**
 * This file was automatically generated.
 *
 * Do not modify it by hand
 */
import { ObjectId } from 'mongodb';

/**
 * Books Collection
 */
export interface Books {
  /**
   * The unique identifier for a book.
   */
  _id: ObjectId;
  /**
   * The date and time when the book record was created.
   */
  createdAt: Date;
  /**
   * The date and time when the book record was last updated.
   */
  updatedAt: Date;
  /**
   * The identifier for the file associated with the book.
   */
  fileId: ObjectId;
  /**
   * The title of the book.
   */
  title?: string;
  /**
   * The author of the book.
   */
  author?: string;
  /**
   * The publisher of the book.
   */
  publisher?: string;
  /**
   * The year the book was published.
   */
  year?: string;
  /**
   * The genre or category of the book.
   */
  genre?: string;
  /**
   * The total number of characters in the book.
   */
  totalChars: number;
  /**
   * The total number of chunks the book is divided into.
   */
  totalChunks: number;
  /**
   * Indicates whether the book processing is finished.
   */
  finished: boolean;
  /**
   * The source of the book, such as user upload or shop.
   */
  source: 'user_upload' | 'shop';
}
