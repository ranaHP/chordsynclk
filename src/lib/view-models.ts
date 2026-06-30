/* eslint-disable @typescript-eslint/no-explicit-any */
export function docId(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.$oid) return value.$oid;
  return String(value);
}

export function normalizeUser(u: any) {
  const id = docId(u?._id) || u?.id || u?.userId;
  return {
    id,
    name: u?.name || u?.email || "Unknown User",
    handle: u?.handle || (u?.email ? `@${String(u.email).split("@")[0]}` : "@user"),
    email: u?.email || "",
    avatar:
      u?.avatar || `https://i.pravatar.cc/200?u=${encodeURIComponent(id || u?.email || "user")}`,
    bio: u?.bio || "ChordSync member",
    isAdmin: !!u?.isAdmin,
  };
}

export function normalizeGroup(g: any) {
  const id = docId(g?._id) || g?.id || g?.groupId;
  return {
    id,
    name: g?.name || "Untitled Group",
    description: g?.description || "",
    image: g?.image || `https://picsum.photos/seed/${encodeURIComponent(id || "group")}/800/800`,
    members: (g?.members || []).map((m: any) => ({
      userId: docId(m?.userId) || m?.userId,
      role: m?.role === "Owner" ? "Scroller" : m?.role === "Member" ? "Sync" : m?.role || "Sync",
    })),
    inviteLink:
      g?.inviteLink ||
      (g?.inviteCode ? `chordsync.live/invite/${g.inviteCode}` : `chordsync.live/groups/${id}`),
  };
}

export function normalizeEvent(e: any) {
  const id = docId(e?._id) || e?.id || e?.eventId;
  return {
    id,
    publicId: e?.eventId || e?.id,
    groupId: docId(e?.groupId) || e?.groupId,
    name: e?.name || "Untitled Event",
    description: e?.description || "",
    image: e?.image || `https://picsum.photos/seed/${encodeURIComponent(id || "event")}/800/800`,
    date: e?.date || new Date().toISOString(),
    duration: e?.duration || 90,
    playlists: (e?.playlists || []).map((p: any) => ({
      id: docId(p?._id) || p?.id,
      name: p?.name || "Playlist",
      description: p?.description || "",
      items: (p?.items || []).map((it: any) => ({
        id: docId(it?._id) || it?.id,
        songId: docId(it?.songId) || it?.songId,
        partName: it?.partName || "Full Song",
        transpose: Number(it?.transpose || 0),
        arrangement: (it?.arrangement || []).map((section: any, sectionIndex: number) => ({
          sectionId: section?.sectionId || `section-${sectionIndex + 1}`,
          name: section?.name || "Section",
          sourcePartName: section?.sourcePartName || section?.name || "Section",
          lines: (section?.lines || []).map((line: any) => ({
            type: line?.type || "lyric_only",
            chordLine: line?.chordLine || "",
            lyricLine: line?.lyricLine || "",
          })),
        })),
      })),
    })),
  };
}

function normalizePartLines(lines: any[] = []) {
  return lines.map((line: any) => ({
    type: line?.type || "lyric_only",
    chordLine: line?.chordLine || "",
    lyricLine: line?.lyricLine || "",
  }));
}

function looksLikeChordLine(value: string) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return (
    /[A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add|\d|\/)?/.test(trimmed) && !/[a-z]{4,}/.test(trimmed)
  );
}

function buildPartsFromGroupedLines(lines: any[] = []) {
  if (!Array.isArray(lines) || !lines.length) return [];

  const groups = new Map<string, any[]>();
  lines.forEach((line: any) => {
    const name = line?.section || line?.sectionName || "Full Song";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)?.push(line);
  });

  return [...groups.entries()].map(([name, groupedLines]) => ({
    name,
    chords: groupedLines.map((line: any) => line?.chordLine || "").join("\n"),
    lyrics: groupedLines.map((line: any) => line?.lyricLine || "").join("\n"),
    lines: normalizePartLines(groupedLines),
  }));
}

function buildPartsFromRawText(rawText = "") {
  if (!rawText.trim()) return [];

  const sections = rawText
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return sections
    .map((block, sectionOrder) => {
      const rows = block.split("\n");
      let name = "Full Song";
      const lines: Array<{ type: string; chordLine: string; lyricLine: string }> = [];

      rows.forEach((rawRow) => {
        const row = rawRow.replace(/\r/g, "");
        const headingMatch = row.match(/^\[(.+)\]$/);
        if (headingMatch) {
          name = headingMatch[1]?.trim() || name;
          return;
        }

        const previous = lines[lines.length - 1];
        if (looksLikeChordLine(row)) {
          lines.push({ type: "chord_lyric", chordLine: row, lyricLine: "" });
          return;
        }

        if (previous && previous.chordLine && !previous.lyricLine) {
          previous.lyricLine = row;
          return;
        }

        lines.push({ type: row.trim() ? "lyric_only" : "blank", chordLine: "", lyricLine: row });
      });

      return {
        name,
        order: sectionOrder,
        chords: lines
          .map((line) => line.chordLine)
          .filter(Boolean)
          .join("\n"),
        lyrics: lines
          .map((line) => line.lyricLine)
          .filter(Boolean)
          .join("\n"),
        lines,
      };
    })
    .filter(
      (part) =>
        part.lines.length > 0 || part.chords.trim().length > 0 || part.lyrics.trim().length > 0,
    );
}

export function normalizeSong(s: any) {
  const sourceId = docId(s?._id) || s?.id || "";
  const publicSongId = s?.songId || "";
  const id = publicSongId || sourceId;
  const partsFromSections =
    Array.isArray(s?.sections) && s.sections.length
      ? s.sections.map((section: any) => ({
          name: section?.name || section?.category || "Section",
          chords: (section?.lines || []).map((line: any) => line?.chordLine || "").join("\n"),
          lyrics: (section?.lines || []).map((line: any) => line?.lyricLine || "").join("\n"),
          lines: normalizePartLines(section?.lines || []),
        }))
      : [];
  const partsFromGroupedLines = buildPartsFromGroupedLines(s?.lines || []);
  const partsFromLines =
    Array.isArray(s?.lines) && s.lines.length
      ? [
          {
            name: "Full Song",
            chords: s.lines.map((line: any) => line?.chordLine || "").join("\n"),
            lyrics: s.lines.map((line: any) => line?.lyricLine || "").join("\n"),
            lines: normalizePartLines(s.lines),
          },
        ]
      : [];
  const partsFromRawText = buildPartsFromRawText(s?.rawText || "");

  const hasRenderableSectionLines = partsFromSections.some(
    (part) =>
      (part.lines && part.lines.length > 0) ||
      part.chords.trim().length > 0 ||
      part.lyrics.trim().length > 0,
  );

  return {
    id,
    sourceId,
    publicSongId,
    title: s?.title || "Untitled Song",
    artist: s?.artistName || s?.artist || "Unknown Artist",
    cover:
      s?.cover ||
      `https://picsum.photos/seed/${encodeURIComponent(id || s?.title || "song")}/600/600`,
    description: s?.description || "",
    tempo: s?.tempo || 90,
    vibe: s?.vibe || "Live",
    genre: s?.genre || "Music",
    year: s?.year || new Date().getFullYear(),
    language: s?.language || "Sinhala",
    popularity: s?.popularity || 50,
    difficulty: s?.difficulty || "Easy",
    capo: s?.capo || "None",
    key: s?.key || "-",
    tags: s?.tags || [s?.source || "chordslk"],
    beat: s?.timeSignature || s?.beat || "4/4",
    isFavorite: !!s?.isFavorite,
    parts: hasRenderableSectionLines
      ? partsFromSections
      : partsFromGroupedLines.length
        ? partsFromGroupedLines
        : partsFromLines.length
          ? partsFromLines
          : partsFromRawText,
    rawText: s?.rawText || "",
    isNew: false,
  };
}
