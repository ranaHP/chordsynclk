const FAVORITES_KEY = "csl_song_favorites_v1";

export function readLocalFavoriteSongIds() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((value) => String(value)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeLocalFavoriteSongIds(songIds: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...new Set(songIds.filter(Boolean))]));
}

export function isLocalFavoriteSong(songId: string) {
  return readLocalFavoriteSongIds().includes(songId);
}

export function toggleLocalFavoriteSong(songId: string, favorite?: boolean) {
  const current = new Set(readLocalFavoriteSongIds());
  const nextFavorite = typeof favorite === "boolean" ? favorite : !current.has(songId);
  if (nextFavorite) current.add(songId);
  else current.delete(songId);
  const next = [...current];
  writeLocalFavoriteSongIds(next);
  return { favorite: nextFavorite, favoriteSongIds: next };
}
