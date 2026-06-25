import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PaginationBar } from "@/components/PaginationBar";
import { api, API_ENABLED } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { normalizeSong } from "@/lib/view-models";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Browse Chords - ChordSync Live" }] }),
  component: SearchPage,
});

type ViewSong = ReturnType<typeof normalizeSong>;

const KEY_OPTIONS = [
  "",
  "A",
  "Am",
  "B",
  "Bm",
  "Bb",
  "C",
  "Cm",
  "D",
  "Dm",
  "E",
  "Em",
  "F",
  "Fm",
  "G",
  "Gm",
];
const BEAT_OPTIONS = ["", "4/4", "3/4", "6/8", "2/4"];
const SOURCE_OPTIONS = ["", "chordslk"];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function SearchPage() {
  const [q, setQ] = useState("");
  const [artistName, setArtistName] = useState("");
  const [keyFilter, setKeyFilter] = useState("");
  const [beatFilter, setBeatFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "artist" | "key" | "recent">("title");
  const [songs, setSongs] = useState<ViewSong[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(API_ENABLED);
  const [error, setError] = useState("");

  const debouncedQ = useDebouncedValue(q, 250);
  const debouncedArtist = useDebouncedValue(artistName, 250);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, debouncedArtist, keyFilter, beatFilter, sourceFilter, sortBy]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) return;
      setLoading(true);
      setError("");
      try {
        const res = await api.listSongs(
          debouncedQ,
          "",
          page,
          24,
          {
            artistName: debouncedArtist,
            key: keyFilter,
            timeSignature: beatFilter,
            source: sourceFilter,
          },
          { sort: sortBy, content: "summary" },
        );
        if (cancelled) return;
        setSongs((res.songs || []).map(normalizeSong));
        setPage(res.page || 1);
        setPages(res.pages || 1);
        setTotal(res.total || 0);
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
  }, [beatFilter, debouncedArtist, debouncedQ, keyFilter, page, sortBy, sourceFilter]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10 space-y-6">
        <header className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-black">Browse Chords</h1>
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search songs or artists..."
                className="w-full pl-11 pr-4 py-3 sm:py-4 rounded-2xl bg-stage-card border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-amber-glow/50 focus:ring-2 focus:ring-amber-glow/20 transition-all"
              />
            </div>
            <input
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Filter by artist name..."
              className="w-full px-4 py-3 sm:py-4 rounded-2xl bg-stage-card border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-amber-glow/50 focus:ring-2 focus:ring-amber-glow/20 transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={keyFilter}
              onChange={(e) => setKeyFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium rounded-full bg-stage-card border border-white/10 text-white/80 focus:outline-none focus:border-amber-glow/40"
            >
              <option value="">All keys</option>
              {KEY_OPTIONS.filter(Boolean).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={beatFilter}
              onChange={(e) => setBeatFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium rounded-full bg-stage-card border border-white/10 text-white/80 focus:outline-none focus:border-amber-glow/40"
            >
              <option value="">All beats</option>
              {BEAT_OPTIONS.filter(Boolean).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium rounded-full bg-stage-card border border-white/10 text-white/80 focus:outline-none focus:border-amber-glow/40"
            >
              <option value="">All sources</option>
              {SOURCE_OPTIONS.filter(Boolean).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 text-xs font-medium rounded-full bg-amber-glow/10 border border-amber-glow/30 text-amber-glow focus:outline-none capitalize"
            >
              <option value="title">Sort: Title</option>
              <option value="artist">Sort: Artist</option>
              <option value="key">Sort: Key</option>
              <option value="recent">Sort: Recent</option>
            </select>
          </div>
        </header>

        {loading && <p className="text-sm text-white/50">Loading songs...</p>}
        {error && <p className="text-xs text-amber-glow">{error}</p>}
        <p className="text-xs text-white/40">
          {total} song{total === 1 ? "" : "s"}
        </p>

        <div className="space-y-3">
          {songs.map((song) => (
            <Link
              key={song.id}
              to="/song/$songId"
              params={{ songId: song.id }}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-stage-card/70 p-3 transition-all hover:border-amber-glow/30 hover:bg-white/[0.04] sm:flex-row sm:items-center"
            >
              <img
                src={song.cover}
                alt={song.title}
                className="h-24 w-full rounded-xl object-cover sm:size-20 sm:shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black">{song.title}</p>
                    <p className="truncate text-sm text-white/55">{song.artist}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-white/45">
                    {song.key ? (
                      <span className="rounded-full border border-white/10 px-2 py-1">
                        Key {song.key}
                      </span>
                    ) : null}
                    {song.tempo ? (
                      <span className="rounded-full border border-white/10 px-2 py-1">
                        {song.tempo} BPM
                      </span>
                    ) : null}
                    {song.timeSignature ? (
                      <span className="rounded-full border border-white/10 px-2 py-1">
                        {song.timeSignature}
                      </span>
                    ) : null}
                    {song.source ? (
                      <span className="rounded-full border border-white/10 px-2 py-1 uppercase">
                        {song.source}
                      </span>
                    ) : null}
                  </div>
                </div>
                {!!song.tags?.length && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/40">
                    {song.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-full bg-white/5 px-2 py-1">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
          {!songs.length && !loading && (
            <div className="py-16 text-center text-white/40">
              No songs match. Loosen your filters.
            </div>
          )}
        </div>

        <PaginationBar page={page} pages={pages} onPageChange={setPage} loading={loading} />
      </div>
    </AppShell>
  );
}
