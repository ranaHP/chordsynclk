import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./db.js";
import Artist from "./models/Artist.js";
import Song from "./models/Song.js";
import User from "./models/User.js";

function line(order, chordLine, lyricLine, section, sectionOrder, type = "chord_lyric") {
  return {
    order,
    type,
    chordLine,
    lyricLine,
    section,
    sectionOrder,
    segments: [],
  };
}

function buildSongContent(title, progression) {
  const sections = [
    {
      name: "Intro",
      category: "Intro",
      rows: [
        {
          chordLine: `${progression[0]}    ${progression[1]}    ${progression[2]}    ${progression[3]}`,
          lyricLine: "",
        },
        { chordLine: `${progression[0]}    ${progression[1]}`, lyricLine: "" },
      ],
    },
    {
      name: "Verse 1",
      category: "Verse",
      rows: [
        {
          chordLine: `${progression[0]}                ${progression[1]}`,
          lyricLine: `Tonight we carry ${title.toLowerCase()} through the room`,
        },
        {
          chordLine: `${progression[2]}                ${progression[3]}`,
          lyricLine: "Every string keeps time with every voice we know",
        },
        {
          chordLine: `${progression[0]}                ${progression[1]}`,
          lyricLine: "Hands in the air and eyes fixed on the glow",
        },
        {
          chordLine: `${progression[2]}                ${progression[3]}`,
          lyricLine: "Hold the rhythm steady, never let it go",
        },
      ],
    },
    {
      name: "Chorus",
      category: "Chorus",
      rows: [
        {
          chordLine: `${progression[0]}      ${progression[1]}      ${progression[0]}`,
          lyricLine: `${title} echoes back to me`,
        },
        {
          chordLine: `${progression[2]}      ${progression[3]}      ${progression[0]}`,
          lyricLine: "Sing it loud for everyone to hear",
        },
        {
          chordLine: `${progression[0]}      ${progression[1]}      ${progression[0]}`,
          lyricLine: "Keep the whole band moving as one",
        },
        {
          chordLine: `${progression[2]}      ${progression[3]}      ${progression[0]}`,
          lyricLine: "Let the final line ring bright and clear",
        },
      ],
    },
    {
      name: "Verse 2",
      category: "Verse",
      rows: [
        {
          chordLine: `${progression[0]}                ${progression[1]}`,
          lyricLine: "Every measure opens like a door into the light",
        },
        {
          chordLine: `${progression[2]}                ${progression[3]}`,
          lyricLine: "Footsteps on the stage all fall into place",
        },
        {
          chordLine: `${progression[0]}                ${progression[1]}`,
          lyricLine: "The melody returns and fills the quiet night",
        },
        {
          chordLine: `${progression[2]}                ${progression[3]}`,
          lyricLine: "One more breath before the last embrace",
        },
      ],
    },
    {
      name: "Outro",
      category: "Outro",
      rows: [
        { chordLine: `${progression[0]}      ${progression[3]}`, lyricLine: "Fade..." },
        { chordLine: `${progression[0]}`, lyricLine: "..." },
      ],
    },
  ];

  let order = 0;
  const builtSections = sections.map((section, sectionOrder) => {
    const lines = section.rows.map((row) =>
      line(
        order++,
        row.chordLine,
        row.lyricLine,
        section.name,
        sectionOrder,
        row.lyricLine ? "chord_lyric" : "lyric_only",
      ),
    );
    return {
      order: sectionOrder,
      name: section.name,
      category: section.category,
      lines,
      lineCount: lines.length,
      chordsUsed: progression,
      autoDetected: false,
    };
  });

  return {
    lines: builtSections.flatMap((section) => section.lines),
    sections: builtSections,
    rawText: builtSections
      .map((section) =>
        [
          `[${section.name}]`,
          ...section.lines.flatMap((songLine) => [songLine.chordLine, songLine.lyricLine]),
        ]
          .filter((value) => value !== "")
          .join("\n"),
      )
      .join("\n\n"),
    sectionFlow: builtSections.map((section) => section.name),
    lineCount: builtSections.reduce((total, section) => total + section.lineCount, 0),
    sectionCount: builtSections.length,
  };
}

async function run() {
  await connectDB();
  console.log("Seeding...");

  await Promise.all([Artist.deleteMany({}), Song.deleteMany({})]);

  const artists = await Artist.insertMany([
    {
      artistId: "a-keerthi",
      name: "Keerthi Pasquel",
      slug: "keerthi-pasquel",
      source: "chordslk",
      sourceUrl: "https://chordslk.com/artist/keerthi-pasquel",
      songCount: 2,
    },
    {
      artistId: "a-bathiya",
      name: "Bathiya & Santhush",
      slug: "bathiya-santhush",
      source: "chordslk",
      sourceUrl: "https://chordslk.com/artist/bathiya-santhush",
      songCount: 1,
    },
    {
      artistId: "a-clarence",
      name: "Clarence Wijewardena",
      slug: "clarence-wijewardena",
      source: "chordslk",
      sourceUrl: "https://chordslk.com/artist/clarence-wijewardena",
      songCount: 1,
    },
  ]);

  await Song.insertMany([
    {
      songId: "s-kandula-ithin",
      title: "Kandula Ithin",
      slug: "kandula-ithin",
      artistId: "a-keerthi",
      artistSlug: "keerthi-pasquel",
      artistName: "Keerthi Pasquel",
      artistUrl: "https://chordslk.com/artist/keerthi-pasquel",
      key: "C",
      timeSignature: "4/4",
      views: "12345",
      source: "chordslk",
      sourceUrl: "https://chordslk.com/song/keerthi-pasquel/kandula-ithin",
      chordsUsed: ["C", "G", "Am", "F"],
      ...buildSongContent("Kandula Ithin", ["C", "G", "Am", "F"]),
    },
    {
      songId: "s-pem-rateka",
      title: "Pem Rateka",
      slug: "pem-rateka",
      artistId: "a-keerthi",
      artistSlug: "keerthi-pasquel",
      artistName: "Keerthi Pasquel",
      key: "G",
      timeSignature: "4/4",
      source: "chordslk",
      sourceUrl: "https://chordslk.com/song/keerthi-pasquel/pem-rateka",
      chordsUsed: ["G", "D", "Em", "C"],
      ...buildSongContent("Pem Rateka", ["G", "D", "Em", "C"]),
    },
    {
      songId: "s-hadawatha-wenuwen",
      title: "Hadawatha Wenuwen",
      slug: "hadawatha-wenuwen",
      artistId: "a-bathiya",
      artistSlug: "bathiya-santhush",
      artistName: "Bathiya & Santhush",
      key: "D",
      timeSignature: "4/4",
      source: "chordslk",
      sourceUrl: "https://chordslk.com/song/bathiya-santhush/hadawatha-wenuwen",
      chordsUsed: ["D", "A", "Bm", "G"],
      ...buildSongContent("Hadawatha Wenuwen", ["D", "A", "Bm", "G"]),
    },
    {
      songId: "s-mango-nanda",
      title: "Mango Nanda",
      slug: "mango-nanda",
      artistId: "a-clarence",
      artistSlug: "clarence-wijewardena",
      artistName: "Clarence Wijewardena",
      key: "E",
      timeSignature: "4/4",
      source: "chordslk",
      sourceUrl: "https://chordslk.com/song/clarence-wijewardena/mango-nanda",
      chordsUsed: ["E", "B", "A", "C#m"],
      ...buildSongContent("Mango Nanda", ["E", "B", "A", "C#m"]),
    },
  ]);

  await User.findOneAndUpdate(
    { email: "admin@chordsync.live" },
    {
      $set: {
        email: "admin@chordsync.live",
        name: "Admin",
        handle: "@admin",
        isAdmin: true,
        avatar: "https://i.pravatar.cc/200?u=admin",
      },
    },
    { upsert: true },
  );

  console.log(`Seeded ${artists.length} artists, songs, and 1 admin user.`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
