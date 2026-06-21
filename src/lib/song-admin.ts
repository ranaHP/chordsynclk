type SongMetaInput = {
  title: string;
  artist: string;
  description: string;
  tempo: string;
  vibe: string;
  genre: string;
  year: string;
  language: string;
  difficulty: string;
  capo: string;
  key: string;
  tags: string;
  cover?: string;
};

type SongPartInput = {
  name: string;
  chords: string;
  lyrics: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildSongPayload(
  meta: SongMetaInput,
  parts: SongPartInput[],
  existingSongId?: string,
) {
  const cleanParts = parts.filter(
    (part) => part.name.trim() && (part.chords.trim() || part.lyrics.trim()),
  );
  const sections = cleanParts.map((part, sectionOrder) => {
    const sectionLines = [
      {
        order: sectionOrder * 2,
        type: "chord_lyric",
        chordLine: part.chords,
        lyricLine: part.lyrics,
        section: part.name,
        sectionOrder,
        segments: [],
      },
    ];

    return {
      order: sectionOrder,
      name: part.name,
      category: part.name,
      lines: sectionLines,
      lineCount: sectionLines.length,
      chordsUsed: Array.from(new Set(part.chords.split(/\s+/).filter(Boolean))),
      autoDetected: false,
    };
  });

  const lines = sections.flatMap((section) => section.lines);

  return {
    songId: existingSongId,
    title: meta.title,
    slug: slugify(meta.title),
    artistName: meta.artist,
    artistSlug: slugify(meta.artist),
    description: meta.description,
    tempo: Number(meta.tempo) || 90,
    vibe: meta.vibe,
    genre: meta.genre,
    year: Number(meta.year) || new Date().getFullYear(),
    language: meta.language,
    difficulty: meta.difficulty,
    capo: meta.capo,
    key: meta.key,
    cover: meta.cover || "",
    tags: meta.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    source: "manual",
    chordsUsed: Array.from(
      new Set(
        cleanParts.flatMap((part) =>
          part.chords
            .split(/\s+/)
            .map((chord) => chord.trim())
            .filter(Boolean),
        ),
      ),
    ),
    lines,
    sections,
    sectionFlow: sections.map((section) => section.name),
    lineCount: lines.length,
    sectionCount: sections.length,
    rawText: cleanParts
      .map((part) => `[${part.name}]\n${part.chords}\n${part.lyrics}`.trim())
      .join("\n\n"),
  };
}

export function partsFromViewSong(
  parts: Array<{ name: string; chords: string; lyrics: string }>,
): SongPartInput[] {
  return parts.map((part) => ({
    name: part.name,
    chords: part.chords,
    lyrics: part.lyrics,
  }));
}
