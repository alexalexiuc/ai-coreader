import { ObjectId } from 'mongodb';
import { collections, getDb } from './mongo';
import type { EntitiesDoc } from './generated/db-types';

export type EntityDTO = {
  id: string;
  bookId: string;
  nameCanonical: string;
  type: string;
  aliases?: string[];
  mentionCount?: number;
  descriptionCurrent?: string;
  keyFacts?: string[];
  uncertainties?: string[];
};

function toDTO(doc: EntitiesDoc): EntityDTO {
  if (!doc._id) {
    throw new Error('Entity document is missing _id');
  }

  return {
    id: doc._id.toHexString(),
    bookId: doc.bookId.toHexString(),
    nameCanonical: doc.nameCanonical,
    type: doc.type,
    aliases: doc.aliases,
    mentionCount: doc.mentionCount,
    descriptionCurrent: doc.descriptionCurrent,
    keyFacts: doc.keyFacts,
    uncertainties: doc.uncertainties,
  };
}

export async function findEntitiesByIds(ids: string[]): Promise<EntityDTO[]> {
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
    .collection<EntitiesDoc>(collections.ENTITIES)
    .find({ _id: { $in: objectIds } })
    .toArray();

  return docs.map(toDTO);
}
