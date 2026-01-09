module.exports.up = async (db) => {
  await db.collection("entity-mentions").createIndex(
    { bookId: 1, entityId: 1, chunkId: 1, offsetStart: 1 },
    { unique: true, name: "uniq_book_entity_chunk_offset" }
  );

  await db.collection("entity-mentions").createIndex(
    { bookId: 1, entityId: 1, chunkIndex: 1 },
    { name: "by_book_entity_chunkIndex" }
  );

  await db.collection("entity-descriptions").createIndex(
    { bookId: 1, name: 1, type: 1 },
    { name: "by_book_name_type" }
  );
};

