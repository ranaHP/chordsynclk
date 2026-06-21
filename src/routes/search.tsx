import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SongTile } from "@/components/SongTile";
import { api, API_ENABLED } from "@/lib/api";
import { normalizeSong } from "@/lib/view-models";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Browse Chords - ChordSync Live" }] }),
  component: SearchPage,
});

const FILTERS = ["artist", "key", "beat", "source"] as const;
type Facet = (typeof FILTERS)[number];
type ViewSong = ReturnType<typeof normalizeSong>;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function SearchPage() {
  const [q, setQ] = useState("");
  const [facets, setFacets] = useState<Record<Facet, string | null>>({
    artist: null,
    key: null,
    beat: null,
    source: null,
  });
  const [sortBy, setSortBy] = useState<"title" | "artist" | "key">("title");
  const [songs, setSongs] = useState<ViewSong[]>([]);
  const [loading, setLoading] = useState(API_ENABLED);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) return;
      setLoading(true);
      setError("");
      try {
        const res = await api.listSongs(q, "", 1, 500, {
          artistName: facets.artist || "",
          key: facets.key || "",
          timeSignature: facets.beat || "",
          source: facets.source || "",
        });
        if (cancelled) return;
        setSongs((res.songs || []).map(normalizeSong));
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(loadError, "Failed to load songs"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [q, facets.artist, facets.beat, facets.key, facets.source]);

  const options = useMemo(
    () => ({
      artist: [...new Set(songs.map((song) => song.artist))].sort((a, b) => a.localeCompare(b)),
      key: [...new Set(songs.map((song) => song.key))].sort((a, b) => a.localeCompare(b)),
      beat: [...new Set(songs.map((song) => song.beat))].sort((a, b) => a.localeCompare(b)),
      source: [...new Set(songs.map((song) => song.tags[0] || "unknown"))].sort((a, b) =>
        a.localeCompare(b),
      ),
    }),
    [songs],
  );

  const results = useMemo(() => {
    return [...songs].sort((a, b) => {
      if (sortBy === "artist") return a.artist.localeCompare(b.artist);
      if (sortBy === "key") return a.key.localeCompare(b.key);
      return a.title.localeCompare(b.title);
    });
  }, [songs, sortBy]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10 space-y-6">
        <header className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-black">Browse Chords</h1>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search songs, artists..."
              className="w-full pl-11 pr-4 py-3 sm:py-4 rounded-2xl bg-stage-card border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-amber-glow/50 focus:ring-2 focus:ring-amber-glow/20 transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filterName) => (
              <select
                key={filterName}
                value={facets[filterName] ?? ""}
                onChange={(e) =>
                  setFacets((current) => ({
                    ...current,
                    [filterName]: e.target.value || null,
                  }))
                }
                className="px-3 py-2 text-xs font-medium rounded-full bg-stage-card border border-white/10 text-white/80 focus:outline-none focus:border-amber-glow/40 capitalize"
              >
                <option value="">{filterName}</option>
                {options[filterName].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ))}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 text-xs font-medium rounded-full bg-amber-glow/10 border border-amber-glow/30 text-amber-glow focus:outline-none capitalize"
            >
              <option value="title">Sort: Title</option>
              <option value="artist">Sort: Artist</option>
              <option value="key">Sort: Key</option>
            </select>
          </div>
        </header>

        {loading && <p className="text-sm text-white/50">Loading songs...</p>}
        {error && <p className="text-xs text-amber-glow">{error}</p>}
        <p className="text-xs text-white/40">
          {results.length} song{results.length === 1 ? "" : "s"}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {results.map((song) => (
            <div key={song.id} className="w-full">
              <SongTile song={song} />
            </div>
          ))}
          {!results.length && (
            <div className="col-span-full py-16 text-center text-white/40">
              No songs match. Loosen your filters.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
