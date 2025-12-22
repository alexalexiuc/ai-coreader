/**
 * This file was automatically generated.
 *
 * Do not modify it by hand
 */
import { ObjectId } from 'mongodb';

/**
 * Files Collection
 */
export interface Files {
  /**
   * The unique identifier for a file.
   */
  _id: ObjectId;
  /**
   * The date and time when the file record was created.
   */
  createdAt: Date;
  /**
   * The MIME type of the file, indicating its format.
   */
  mimeType: string;
  /**
   * The original name of the file as uploaded by the user.
   */
  originalName: string;
  /**
   * The size of the file in bytes.
   */
  size: number;
  /**
   * The current status of the file, such as 'uploaded' or 'processed'.
   */
  status: 'pending' | 'processing' | 'processed' | 'failed';
  /**
   * The name used to store the file in the storage system.
   */
  storageName: string;
  /**
   * The path where the file is stored in the storage system.
   */
  storagePath: string;
  /**
   * The date and time when the file record was last updated.
   */
  updatedAt: Date;
}
