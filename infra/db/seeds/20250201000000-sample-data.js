const { Double, Int32, ObjectId } = require("mongodb");

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

const chunkIds = {
  emberArchiveIntro: new ObjectId("66f000000000000000000201"),
  emberArchiveField: new ObjectId("66f000000000000000000202"),
  atlasNotesOverview: new ObjectId("66f000000000000000000203"),
};

const entityIds = {
  rin: new ObjectId("66f000000000000000000301"),
  theAtlas: new ObjectId("66f000000000000000000302"),
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
    totalChars: new Int32(4820),
    totalChunks: new Int32(2),
    finished: false,
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
    totalChars: new Int32(2110),
    totalChunks: new Int32(1),
    finished: true,
    source: "shop",
  },
  {
    _id: mockBookIds.foundation,
    createdAt: mockFoundationAddedAt,
    updatedAt: mockFoundationOpenedAt,
    fileId: mockFileIds.foundation,
    title: "Foundation",
    author: "Isaac Asimov",
    totalChars: new Int32(120000),
    totalChunks: new Int32(120),
    finished: false,
    source: "user_upload",
  },
  {
    _id: mockBookIds.iRobot,
    createdAt: mockRobotAddedAt,
    updatedAt: mockRobotOpenedAt,
    fileId: mockFileIds.iRobot,
    title: "I, Robot",
    author: "Isaac Asimov",
    totalChars: new Int32(90000),
    totalChunks: new Int32(90),
    finished: false,
    source: "user_upload",
  },
  {
    _id: mockBookIds.dune,
    createdAt: mockDuneAddedAt,
    updatedAt: mockDuneAddedAt,
    fileId: mockFileIds.dune,
    title: "Dune",
    author: "Frank Herbert",
    totalChars: new Int32(190000),
    totalChunks: new Int32(190),
    finished: false,
    source: "shop",
  },
  {
    _id: mockBookIds.martianChronicles,
    createdAt: mockMartianAddedAt,
    updatedAt: mockMartianOpenedAt,
    fileId: mockFileIds.martianChronicles,
    title: "The Martian Chronicles",
    author: "Ray Bradbury",
    totalChars: new Int32(150000),
    totalChunks: new Int32(150),
    finished: true,
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
    llmMetadata: {
      entities: [
        {
          tempName: "Rin",
          type: "character",
          startOffset: new Int32(71),
          endOffset: new Int32(74),
          isIntroducedInThisChunk: true,
        },
        {
          tempName: "Ember Archive",
          type: "place",
          startOffset: new Int32(36),
          endOffset: new Int32(49),
          isIntroducedInThisChunk: true,
        },
      ],
      hasChapterStart: true,
      chapterTitle: "Prologue",
      chapterNumber: "1",
    },
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
    llmProcessed: false,
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
    llmMetadata: {
      entities: [
        {
          tempName: "northern ranges",
          type: "place",
          startOffset: new Int32(70),
          endOffset: new Int32(85),
          isIntroducedInThisChunk: true,
        },
      ],
    },
  },
];

const entityDescriptions = [
  {
    _id: entityIds.rin,
    createdAt: primaryDate,
    updatedAt: primaryDate,
    bookId: bookIds.emberArchive,
    entityId: entityIds.rin,
    name: "Rin Calder",
    type: "character",
    summary:
      "An archivist who safeguards stories rescued from the ashes. Meticulous and steady, Rin prefers lantern-lit stacks to crowded markets.",
    role: "archivist",
    traits: ["curious", "methodical"],
    importantLocations: ["Ashen Library", "Ember Archive"],
    importantRelationships: ["Mentored by Archivist Mael"],
  },
  {
    _id: entityIds.theAtlas,
    createdAt: secondaryDate,
    updatedAt: secondaryDate,
    bookId: bookIds.atlasNotes,
    entityId: entityIds.theAtlas,
    name: "Atlas of Rivers",
    type: "artifact",
    summary:
      "A stitched collection of annotated river charts rumored to predict seasonal shifts. Traveling cartographers copy fragments to stay ahead of flooding routes.",
    traits: ["waterlogged cover", "handwritten marginalia"],
    importantLocations: ["Ashen Library"],
    importantRelationships: ["Referenced alongside the Surveyor's Almanac"],
  },
];

module.exports.seed = async (db) => {
  await db.collection("files").insertMany(files, { ordered: true });
  await db.collection("books").insertMany(books, { ordered: true });
  await db.collection("bookChunks").insertMany(bookChunks, { ordered: true });
  await db
    .collection("entityDescriptions")
    .insertMany(entityDescriptions, { ordered: true });
};
