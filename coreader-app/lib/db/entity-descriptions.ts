import { ObjectId } from 'mongodb';
import { collections, getDb } from './mongo';
import type { EntityDescriptionsDoc } from './generated/db-types';

export type EntityDescriptionDTO = {
  id: string;
  bookId: string;
  bookChunkId: string;
  name: string;
  type: string;
  summary?: string;
  role?: string;
  traits?: string[];
  importantLocations?: string[];
  importantRelationships?: string[];
};

function toDTO(doc: EntityDescriptionsDoc): EntityDescriptionDTO {
  if (!doc._id) {
    throw new Error('Entity description document is missing _id');
  }

  return {
    id: doc._id.toHexString(),
    bookId: doc.bookId.toHexString(),
    bookChunkId: doc.bookChunkId.toHexString(),
    name: doc.name,
    type: doc.type,
    summary: doc.summary,
    role: doc.role,
    traits: doc.traits,
    importantLocations: doc.importantLocations,
    importantRelationships: doc.importantRelationships,
  };
}

export async function findEntityDescriptionsByIds(ids: string[]): Promise<EntityDescriptionDTO[]> {
  if (ids.length === 0) return [];

  const objectIds = ids
    .map((id) => {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter((id): id is ObjectId => id !== null);

  if (objectIds.length === 0) return [];

  const db = await getDb();
  const docs = await db
    .collection<EntityDescriptionsDoc>(collections.ENTITY_DESCRIPTIONS)
    .find({ _id: { $in: objectIds } })
    .toArray();

  return docs.map(toDTO);
}
