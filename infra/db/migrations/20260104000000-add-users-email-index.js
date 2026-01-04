module.exports.up = async (db) => {
  // Add unique index on email field in users collection
  await db.collection("users").createIndex(
    { email: 1 },
    { 
      unique: true,
      name: "email_unique_idx"
    }
  );
  console.log("Added unique index on users.email");
};
