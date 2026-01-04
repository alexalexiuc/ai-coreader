module.exports.up = async (db) => {
  // Add compound unique index on (userId, bookId) in user-books collection
  // This ensures a user can only have one link to each book
  await db.collection("user-books").createIndex(
    { userId: 1, bookId: 1 },
    { 
      unique: true,
      name: "userId_bookId_unique_idx"
    }
  );
  console.log("Added unique compound index on user-books (userId, bookId)");

  // Add index on userId for fast "My Library" queries
  await db.collection("user-books").createIndex(
    { userId: 1 },
    { 
      name: "userId_idx"
    }
  );
  console.log("Added index on user-books.userId");

  // Add index on bookId for reverse lookups if needed
  await db.collection("user-books").createIndex(
    { bookId: 1 },
    { 
      name: "bookId_idx"
    }
  );
  console.log("Added index on user-books.bookId");

  // Add index on userId in files collection to support ownership lookups
  await db.collection("files").createIndex(
    { userId: 1 },
    { 
      name: "userId_idx"
    }
  );
  console.log("Added index on files.userId");
};
