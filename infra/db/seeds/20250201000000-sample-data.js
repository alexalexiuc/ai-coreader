const { Double, Int32, ObjectId } = require("mongodb");

// Test user IDs
const userIds = {
  testUser: new ObjectId("66f000000000000000000601"),
};

const fileIds = {
  emberArchive: new ObjectId("66f000000000000000000001"),
  atlasNotes: new ObjectId("66f000000000000000000002"),
};

const bookIds = {
  emberArchive: new ObjectId("66f000000000000000000101"),
  atlasNotes: new ObjectId("66f000000000000000000102"),
};

const mockFileIds = {
  foundation: new ObjectId("66f000000000000000000401"),
  iRobot: new ObjectId("66f000000000000000000402"),
  dune: new ObjectId("66f000000000000000000403"),
  martianChronicles: new ObjectId("66f000000000000000000404"),
  uploadFailed: new ObjectId("66f000000000000000000406"),
};

const mockBookIds = {
  foundation: new ObjectId("66f000000000000000000501"),
  iRobot: new ObjectId("66f000000000000000000502"),
  dune: new ObjectId("66f000000000000000000503"),
  martianChronicles: new ObjectId("66f000000000000000000504"),
};

const userBookIds = {
  foundation: new ObjectId("66f000000000000000000701"),
  martianChronicles: new ObjectId("66f000000000000000000702"),
};

const chunkIds = {
  emberArchiveIntro: new ObjectId("66f000000000000000000201"),
  emberArchiveField: new ObjectId("66f000000000000000000202"),
  atlasNotesOverview: new ObjectId("66f000000000000000000203"),
};

const entityIds = {
  rin: new ObjectId("66f000000000000000000301"),
  theAtlas: new ObjectId("66f000000000000000000302"),
  emberArchive: new ObjectId("66f000000000000000000303"),
  northernRanges: new ObjectId("66f000000000000000000304"),
};

const primaryDate = new Date("2024-11-15T12:00:00.000Z");
const secondaryDate = new Date("2024-11-16T08:30:00.000Z");
const mockFoundationUploadedAt = new Date("2025-12-18T19:05:00.000Z");
const mockRobotUploadedAt = new Date("2025-12-19T08:40:00.000Z");
const mockFailedUploadedAt = new Date("2025-12-19T10:10:00.000Z");
const mockFoundationAddedAt = new Date("2025-12-02T10:20:00.000Z");
const mockFoundationOpenedAt = new Date("2025-12-18T20:10:00.000Z");
const mockRobotAddedAt = new Date("2025-12-10T13:00:00.000Z");
const mockRobotOpenedAt = new Date("2025-12-11T18:40:00.000Z");
const mockDuneAddedAt = new Date("2025-12-15T09:10:00.000Z");
const mockMartianAddedAt = new Date("2025-11-28T09:10:00.000Z");
const mockMartianOpenedAt = new Date("2025-12-01T07:10:00.000Z");
const testUserCreatedAt = new Date("2025-12-01T10:00:00.000Z");
const foundationUserBookUpdatedAt = new Date("2025-12-18T20:30:00.000Z");
const martianUserBookUpdatedAt = new Date("2025-12-01T08:00:00.000Z");

// Test users for E2E auth tests
// Password for testuser@example.com: TestPassword123!
const users = [
  {
    _id: userIds.testUser,
    createdAt: testUserCreatedAt,
    updatedAt: testUserCreatedAt,
    email: "testuser@example.com",
    passwordHash:
      "$2b$10$9H9U5BPM4ty2VyF8hHJaie9Q5Rk7FV6nBQ.I2b1hd61RL9eLJco3S",
    firstName: "Test",
    lastName: "User",
  },
];

const files = [
  {
    _id: fileIds.emberArchive,
    createdAt: primaryDate,
    updatedAt: primaryDate,
    originalName: "ember-archive.pdf",
    mimeType: "application/pdf",
    size: new Int32(24576),
    storagePath: "uploads/testing",
    storageName: "ember-archive.pdf",
    percentage: new Double(100),
    status: "processed",
  },
  {
    _id: fileIds.atlasNotes,
    createdAt: secondaryDate,
    updatedAt: secondaryDate,
    originalName: "atlas-field-notes.txt",
    mimeType: "text/plain",
    size: new Int32(8192),
    storagePath: "uploads/testing",
    storageName: "atlas-field-notes.txt",
    percentage: new Double(60),
    status: "processing",
  },
  {
    _id: mockFileIds.foundation,
    createdAt: mockFoundationUploadedAt,
    updatedAt: mockFoundationUploadedAt,
    originalName: "foundation.txt",
    mimeType: "text/plain",
    size: new Int32(2340120),
    storagePath: "uploads/mock",
    storageName: "foundation.txt",
    percentage: new Double(100),
    status: "processed",
    userId: userIds.testUser,
  },
  {
    _id: mockFileIds.iRobot,
    createdAt: mockRobotAddedAt,
    updatedAt: mockRobotAddedAt,
    originalName: "i_robot.txt",
    mimeType: "text/plain",
    size: new Int32(1124221),
    storagePath: "uploads/mock",
    storageName: "i_robot.txt",
    percentage: new Double(45),
    status: "processing",
    userId: userIds.testUser,
  },
  {
    _id: mockFileIds.dune,
    createdAt: mockDuneAddedAt,
    updatedAt: mockDuneAddedAt,
    originalName: "dune.txt",
    mimeType: "text/plain",
    size: new Int32(3800000),
    storagePath: "uploads/mock",
    storageName: "dune.txt",
    percentage: new Double(100),
    status: "processed",
  },
  {
    _id: mockFileIds.martianChronicles,
    createdAt: mockMartianAddedAt,
    updatedAt: mockMartianOpenedAt,
    originalName: "bradbury_martian_chronicles.txt",
    mimeType: "text/plain",
    size: new Int32(4800004),
    storagePath: "uploads/mock",
    storageName: "bradbury_martian_chronicles.txt",
    percentage: new Double(100),
    status: "processed",
  },
  {
    _id: mockFileIds.uploadFailed,
    createdAt: mockFailedUploadedAt,
    updatedAt: mockFailedUploadedAt,
    originalName: "some_scan.pdf",
    mimeType: "application/pdf",
    size: new Int32(18204332),
    storagePath: "uploads/mock",
    storageName: "some_scan.pdf",
    percentage: new Double(10),
    status: "failed",
  },
];

const books = [
  {
    _id: bookIds.emberArchive,
    createdAt: primaryDate,
    updatedAt: primaryDate,
    fileId: fileIds.emberArchive,
    title: "The Ember Archive",
    author: "A. Storyteller",
    genre: "Fantasy",
    description: "An archivist catalogs magic-tinged ruins.",
    totalChars: new Int32(4820),
    totalChunks: new Int32(2),
    processed: true,
    source: "user_upload",
  },
  {
    _id: bookIds.atlasNotes,
    createdAt: secondaryDate,
    updatedAt: secondaryDate,
    fileId: fileIds.atlasNotes,
    title: "Atlas Field Notes",
    author: "Q. Cartographer",
    year: "2024",
    description: "Survey excerpts from the northern ranges.",
    totalChars: new Int32(2110),
    totalChunks: new Int32(1),
    processed: false,
    source: "shop",
  },
  {
    _id: mockBookIds.foundation,
    createdAt: mockFoundationAddedAt,
    updatedAt: mockFoundationOpenedAt,
    fileId: mockFileIds.foundation,
    title: "Foundation",
    author: "Isaac Asimov",
    description: "A saga of empire and psychohistory.",
    totalChars: new Int32(120000),
    totalChunks: new Int32(120),
    processed: true,
    source: "user_upload",
  },
  {
    _id: mockBookIds.iRobot,
    createdAt: mockRobotAddedAt,
    updatedAt: mockRobotOpenedAt,
    fileId: mockFileIds.iRobot,
    title: "I, Robot",
    author: "Isaac Asimov",
    description: "Stories of robots and their laws.",
    totalChars: new Int32(90000),
    totalChunks: new Int32(90),
    processed: false,
    source: "user_upload",
  },
  {
    _id: mockBookIds.dune,
    createdAt: mockDuneAddedAt,
    updatedAt: mockDuneAddedAt,
    fileId: mockFileIds.dune,
    title: "Dune",
    author: "Frank Herbert",
    description: "A desert planet, spice, and politics.",
    totalChars: new Int32(190000),
    totalChunks: new Int32(190),
    processed: true,
    source: "shop",
  },
  {
    _id: mockBookIds.martianChronicles,
    createdAt: mockMartianAddedAt,
    updatedAt: mockMartianOpenedAt,
    fileId: mockFileIds.martianChronicles,
    title: "The Martian Chronicles",
    author: "Ray Bradbury",
    description: "Human tales from a haunted Mars.",
    totalChars: new Int32(150000),
    totalChunks: new Int32(150),
    processed: true,
    source: "shop",
  },
];

const bookChunks = [
  {
    _id: chunkIds.emberArchiveIntro,
    createdAt: primaryDate,
    updatedAt: primaryDate,
    bookId: bookIds.emberArchive,
    index: new Int32(0),
    startChar: new Int32(0),
    endChar: new Int32(2400),
    text: "Ash and memory are carefully stored in the Ember Archive. The archivist Rin catalogues accounts of cities lost to time, noting flickers of magic that still cling to their ruins.",
    llmProcessed: true,
    entities: [
      {
        entityId: entityIds.rin,
        name: "Rin",
        type: "character",
        startOffsets: [new Int32(71)],
      },
      {
        entityId: entityIds.emberArchive,
        name: "Ember Archive",
        type: "place",
        startOffsets: [new Int32(36)],
      },
    ],
    chapters: ["Prologue"],
  },
  {
    _id: chunkIds.emberArchiveField,
    createdAt: primaryDate,
    updatedAt: primaryDate,
    bookId: bookIds.emberArchive,
    index: new Int32(1),
    startChar: new Int32(2400),
    endChar: new Int32(4820),
    text: "Rin ventures to the Ashen Library where the Atlas of Rivers is rumored to be kept. Lantern-light traces faded ink while distant bells keep her aware of the time.",
    llmProcessed: true,
    entities: [
      {
        entityId: entityIds.theAtlas,
        name: "Atlas of Rivers",
        type: "artifact",
        startOffsets: [new Int32(47)],
      },
    ],
    chapters: [],
  },
  {
    _id: chunkIds.atlasNotesOverview,
    createdAt: secondaryDate,
    updatedAt: secondaryDate,
    bookId: bookIds.atlasNotes,
    index: new Int32(0),
    startChar: new Int32(0),
    endChar: new Int32(2110),
    text: "Collected survey excerpts describe safe passages across the northern ranges. Marginalia warns of seasonal storms and the glow of miner camps on the horizon.",
    llmProcessed: true,
    entities: [
      {
        entityId: entityIds.northernRanges,
        name: "northern ranges",
        type: "place",
        startOffsets: [new Int32(70)],
      },
    ],
    chapters: [],
  },
];

const entities = [
  {
    _id: entityIds.rin,
    createdAt: primaryDate,
    updatedAt: primaryDate,
    bookId: bookIds.emberArchive,
    nameCanonical: "Rin Calder",
    type: "character",
    aliases: ["Rin"],
    mentionCount: new Int32(2),
    firstSeenChunkIndex: new Int32(0),
    lastSeenChunkIndex: new Int32(1),
    descriptionCurrent:
      "An archivist who safeguards stories rescued from the ashes. Meticulous and steady, Rin prefers lantern-lit stacks to crowded markets.",
    descriptionVersion: new Int32(1),
    keyFacts: [
      "Role: archivist",
      "Traits: curious, methodical",
      "Locations: Ashen Library, Ember Archive",
      "Mentored by Archivist Mael",
    ],
  },
  {
    _id: entityIds.theAtlas,
    createdAt: secondaryDate,
    updatedAt: secondaryDate,
    bookId: bookIds.atlasNotes,
    nameCanonical: "Atlas of Rivers",
    type: "artifact",
    mentionCount: new Int32(1),
    firstSeenChunkIndex: new Int32(1),
    lastSeenChunkIndex: new Int32(1),
    descriptionCurrent:
      "A stitched collection of annotated river charts rumored to predict seasonal shifts. Traveling cartographers copy fragments to stay ahead of flooding routes.",
    descriptionVersion: new Int32(1),
    keyFacts: [
      "Physical traits: waterlogged cover, handwritten marginalia",
      "Location: Ashen Library",
      "Referenced alongside the Surveyor's Almanac",
    ],
  },
  {
    _id: entityIds.emberArchive,
    createdAt: primaryDate,
    updatedAt: primaryDate,
    bookId: bookIds.emberArchive,
    nameCanonical: "Ember Archive",
    type: "place",
    mentionCount: new Int32(1),
    firstSeenChunkIndex: new Int32(0),
    lastSeenChunkIndex: new Int32(0),
    descriptionCurrent:
      "A storied repository of ash-scarred manuscripts and maps.",
    descriptionVersion: new Int32(1),
    keyFacts: ["Features: dusty vaults, sealed stacks"],
  },
  {
    _id: entityIds.northernRanges,
    createdAt: secondaryDate,
    updatedAt: secondaryDate,
    bookId: bookIds.atlasNotes,
    nameCanonical: "northern ranges",
    type: "place",
    mentionCount: new Int32(1),
    firstSeenChunkIndex: new Int32(0),
    lastSeenChunkIndex: new Int32(0),
    descriptionCurrent:
      "A mountainous stretch marked by seasonal storms and miner camps.",
    descriptionVersion: new Int32(1),
    keyFacts: ["Characteristics: storm-prone, remote"],
  },
];

// User-books entries linking test user to books with reading progress
const userBooks = [
  {
    _id: userBookIds.foundation,
    userId: userIds.testUser,
    bookId: mockBookIds.foundation,
    createdAt: mockFoundationAddedAt,
    updatedAt: foundationUserBookUpdatedAt,
    lastOpenedAt: mockFoundationOpenedAt,
    lastPageIndex: new Int32(12),
    lastChunkIndex: new Int32(25),
    lastCharOffset: new Int32(30000),
    progressPercent: new Int32(25),
    startedAt: mockFoundationAddedAt,
  },
  {
    _id: userBookIds.martianChronicles,
    userId: userIds.testUser,
    bookId: mockBookIds.martianChronicles,
    createdAt: mockMartianAddedAt,
    updatedAt: martianUserBookUpdatedAt,
    lastOpenedAt: mockMartianOpenedAt,
    lastPageIndex: new Int32(5),
    lastChunkIndex: new Int32(10),
    lastCharOffset: new Int32(12000),
    progressPercent: new Int32(8),
    startedAt: mockMartianAddedAt,
  },
];

module.exports.seed = async (db) => {
  await db.collection("users").insertMany(users, { ordered: true });
  await db.collection("files").insertMany(files, { ordered: true });
  await db.collection("books").insertMany(books, { ordered: true });
  await db.collection("books-chunks").insertMany(bookChunks, { ordered: true });
  await db.collection("entities").insertMany(entities, { ordered: true });
  await db.collection("user-books").insertMany(userBooks, { ordered: true });
};
