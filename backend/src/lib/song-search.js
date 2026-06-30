function safeText(value) {
  return String(value || "")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

export function normalizeSearchValue(value = "") {
  return safeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9#b\s/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeSearchQuery(value = "") {
  return Array.from(
    new Set(
      normalizeSearchValue(value)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  ).slice(0, 8);
}

function collectSectionNames(song = {}) {
  const fromSections = Array.isArray(song.sections)
    ? song.sections.map((section) => safeText(section?.name || section?.category))
    : [];
  const fromFlow = Array.isArray(song.sectionFlow) ? song.sectionFlow.map((name) => safeText(name)) : [];
  return Array.from(new Set([...fromSections, ...fromFlow].filter(Boolean)));
}

function collectLinesText(song = {}) {
  const sectionLines = Array.isArray(song.sections)
    ? song.sections.flatMap((section) =>
        (section?.lines || []).flatMap((line) => [safeText(line?.chordLine), safeText(line?.lyricLine)]),
      )
    : [];
  const flatLines = Array.isArray(song.lines)
    ? song.lines.flatMap((line) => [safeText(line?.chordLine), safeText(line?.lyricLine)])
    : [];
  return [...sectionLines, ...flatLines].filter(Boolean);
}

export function buildSongSearchDocument(song = {}) {
  const sectionNames = collectSectionNames(song);
  const lineText = collectLinesText(song);
  const chunks = [
    safeText(song.title),
    safeText(song.artistName),
    safeText(song.artistSlug),
    safeText(song.description),
    safeText(song.genre),
    safeText(song.language),
    safeText(song.key),
    safeText(song.timeSignature),
    safeText(song.capo),
    ...(song.tags || []).map((tag) => safeText(tag)),
    ...(song.chordsUsed || []).map((chord) => safeText(chord)),
    ...sectionNames,
    ...lineText.slice(0, 40),
    safeText(song.rawText).slice(0, 1400),
  ].filter(Boolean);

  const searchText = normalizeSearchValue(chunks.join(" "));
  const searchTokens = tokenizeSearchQuery(searchText);

  return {
    sectionNames,
    searchText,
    searchTokens,
  };
}

export function buildSearchClauses(query = "") {
  const normalizedQuery = normalizeSearchValue(query);
  const tokens = tokenizeSearchQuery(query);
  if (!normalizedQuery) return [];

  const phraseRegex = new RegExp(normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, ".*"), "i");
  const exactRegex = new RegExp(normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  return [
    { title: exactRegex },
    { artistName: exactRegex },
    { sectionFlow: exactRegex },
    { sectionNames: exactRegex },
    { "sections.name": exactRegex },
    { "sections.category": exactRegex },
    { tags: exactRegex },
    { chordsUsed: exactRegex },
    ...(tokens.length ? [{ searchTokens: { $in: tokens } }] : []),
    ...(normalizedQuery.length >= 4 ? [{ searchText: phraseRegex }, { rawText: phraseRegex }] : []),
  ];
}

export function computeSongSearchRank(song = {}, query = "") {
  const normalizedQuery = normalizeSearchValue(query);
  const tokens = tokenizeSearchQuery(query);
  if (!normalizedQuery) return 0;

  const title = normalizeSearchValue(song.title);
  const artist = normalizeSearchValue(song.artistName);
  const sectionNames = normalizeSearchValue((song.sectionNames || song.sectionFlow || []).join(" "));
  const tags = normalizeSearchValue((song.tags || []).join(" "));
  const chords = normalizeSearchValue((song.chordsUsed || []).join(" "));
  const searchText = normalizeSearchValue(song.searchText || song.rawText || "");

  let score = 0;
  if (title === normalizedQuery) score += 200;
  else if (title.startsWith(normalizedQuery)) score += 160;
  else if (title.includes(normalizedQuery)) score += 120;

  if (artist === normalizedQuery) score += 120;
  else if (artist.startsWith(normalizedQuery)) score += 90;
  else if (artist.includes(normalizedQuery)) score += 70;

  if (sectionNames.includes(normalizedQuery)) score += 95;
  if (tags.includes(normalizedQuery)) score += 55;
  if (chords.includes(normalizedQuery)) score += 45;
  if (searchText.includes(normalizedQuery)) score += 30;

  score += tokens.filter((token) => title.includes(token)).length * 30;
  score += tokens.filter((token) => artist.includes(token)).length * 18;
  score += tokens.filter((token) => sectionNames.includes(token)).length * 22;
  score += tokens.filter((token) => searchText.includes(token)).length * 8;

  return score;
}
