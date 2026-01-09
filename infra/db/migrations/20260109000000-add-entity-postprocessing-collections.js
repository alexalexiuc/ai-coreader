module.exports.up = async (db) => {
  // Create indexes for entities collection
  await db.collection("entities").createIndex(
    { bookId: 1, nameCanonical: 1, type: 1 },
    { 
      unique: true,
      name: "bookId_nameCanonical_type_unique_idx"
    }
  );
  console.log("Added unique compound index on entities (bookId, nameCanonical, type)");

  await db.collection("entities").createIndex(
    { bookId: 1 },
    { 
      name: "bookId_idx"
    }
  );
  console.log("Added index on entities.bookId");

  // Create indexes for entity-mentions collection
  await db.collection("entity-mentions").createIndex(
    { bookId: 1, entityId: 1, chunkId: 1 },
    { 
      unique: true,
      name: "bookId_entityId_chunkId_unique_idx"
    }
  );
  console.log("Added unique compound index on entity-mentions (bookId, entityId, chunkId)");

  await db.collection("entity-mentions").createIndex(
    { entityId: 1, chunkIndex: 1 },
    { 
      name: "entityId_chunkIndex_idx"
    }
  );
  console.log("Added index on entity-mentions (entityId, chunkIndex)");

  await db.collection("entity-mentions").createIndex(
    { bookId: 1 },
    { 
      name: "bookId_idx"
    }
  );
  console.log("Added index on entity-mentions.bookId");
};
