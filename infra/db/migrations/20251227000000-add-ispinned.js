/**
 * Migration: Add isPinned field to books collection
 */

module.exports.up = async (db) => {
  // Add isPinned field to all existing books with default value false
  await db.collection('books').updateMany(
    { isPinned: { $exists: false } },
    { $set: { isPinned: false } }
  );
};

module.exports.down = async (db) => {
  // Remove isPinned field from all books
  await db.collection('books').updateMany(
    {},
    { $unset: { isPinned: '' } }
  );
};
