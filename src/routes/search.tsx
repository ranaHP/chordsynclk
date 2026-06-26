import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PaginationBar } from "@/components/PaginationBar";
import { api, API_ENABLED } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { normalizeSong } from "@/lib/view-models";
import {
  ArrowRight,
  Clock3,
  Guitar,
  Loader2,
  Music2,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Browse Chords - ChordSync Live" }] }),
  component: SearchPage,
});

type ViewSong = ReturnType<typeof normalizeSong>;

const KEY_OPTIONS = ["", "A", "Am", "B", "Bm", "Bb", "C", "Cm", "D", "Dm", "E", "Em", "F", "Fm", "G", "Gm"];
const BEAT_OPTIONS = ["", "4/4", "3/4", "6/8", "2/4"];
const SOURCE_OPTIONS = ["", "chordslk"];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function difficultyTone(level?: string) {
  if (level === "Hard") return "border-rose-400/30 bg-rose-500/10 text-rose-200";
  if (level === "Medium") return "border-amber-400/30 bg-amber-500/10 text-amber-100";
  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
}

function chordPreview(song: ViewSong) {
  return [...(song.tags || []), song.key]
    .filter(Boolean)
    .slice(0, 4)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function SearchPage() {
  const [q, setQ] = useState("");
  const [artistName, setArtistName] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [appliedArtistName, setAppliedArtistName] = useState("");
  const [keyFilter, setKeyFilter] = useState("");
  const [beatFilter, setBeatFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "artist" | "key" | "recent">("title");
  const [songs, setSongs] = useState<ViewSong[]>([]);
  const [previewSongs, setPreviewSongs] = useState<ViewSong[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(API_ENABLED);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const searchShellRef = useRef<HTMLDivElement | null>(null);
  const debouncedQ = useDebouncedValue(q, 250);
  const debouncedArtist = useDebouncedValue(artistName, 250);
  const mobileSearchOverlay = searchMode;

  const focusSearchLayout = () => {
    if (typeof window === "undefined") return;
    setSearchMode(true);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      searchShellRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  const applySearch = () => {
    setAppliedQ(q);
    setAppliedArtistName(artistName);
    setPage(1);
    setSearchMode(false);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        searchShellRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }
  };

  const clearDraftSearch = () => {
    setQ("");
    setArtistName("");
  };

  useEffect(() => {
    setPage(1);
  }, [appliedQ, appliedArtistName, keyFilter, beatFilter, sourceFilter, sortBy]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) return;
      setLoading(true);
      setError("");
      try {
        const res = await api.listSongs(
          appliedQ,
          "",
          page,
          24,
          {
            artistName: appliedArtistName,
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
  }, [appliedArtistName, appliedQ, beatFilter, keyFilter, page, sortBy, sourceFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      const hasSearch = debouncedQ.trim() || debouncedArtist.trim();
      if (!API_ENABLED || !searchMode || !hasSearch) {
        setPreviewSongs([]);
        setPreviewLoading(false);
        setPreviewError("");
        return;
      }

      setPreviewLoading(true);
      setPreviewError("");
      try {
        const res = await api.listSongs(
          debouncedQ,
          "",
          1,
          8,
          {
            artistName: debouncedArtist,
            key: keyFilter,
            timeSignature: beatFilter,
            source: sourceFilter,
          },
          { sort: sortBy, content: "summary" },
        );
        if (cancelled) return;
        setPreviewSongs((res.songs || []).map(normalizeSong));
      } catch (loadError: unknown) {
        if (cancelled) return;
        setPreviewError(getErrorMessage(loadError, "Failed to preview songs"));
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [debouncedArtist, debouncedQ, searchMode, beatFilter, keyFilter, sourceFilter, sortBy]);

  return (
    <AppShell>
      <div className={`mx-auto max-w-7xl px-4 py-5 sm:space-y-6 sm:py-10 ${mobileSearchOverlay ? "space-y-0" : "space-y-5"}`}>
        <header
          ref={searchShellRef}
          className={`z-30 -mx-4 px-4 backdrop-blur-xl sm:static sm:mx-0 sm:border-none sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 ${
            mobileSearchOverlay
              ? "fixed inset-x-0 top-[68px] bottom-0 border-none bg-stage-black/98 pb-4 pt-3"
              : "sticky top-[68px] border-b border-white/8 bg-stage-black/95 pb-3 pt-2"
          }`}
        >
          <div
            className={`rounded-[1.45rem] border border-white/10 bg-stage-card/85 shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:rounded-[1.85rem] ${
              searchMode ? "flex h-[calc(100dvh-96px)] min-h-0 flex-col space-y-3 p-3" : "space-y-4 p-3.5 sm:p-5"
            }`}
          >
            {!searchMode && (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-[1.15rem] font-black sm:text-4xl">Browse Chords</h1>
                  <p className="mt-1 text-[11px] leading-5 text-white/50 sm:text-sm">
                    Search at the top, preview in a list, then open the browse results below.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-white/60 sm:text-[11px]">
                  {total} song{total === 1 ? "" : "s"}
                </div>
              </div>
            )}

            {searchMode && (
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-sm font-black text-white">Search songs</p>
                <button
                  type="button"
                  onClick={() => setSearchMode(false)}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold text-white/60 transition-colors hover:text-white"
                >
                  <X className="size-3.5" />
                  Close
                </button>
              </div>
            )}

            <div className={`grid gap-3 ${searchMode ? "" : "lg:grid-cols-[1.6fr_1fr_auto] lg:items-center"}`}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onFocus={focusSearchLayout}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applySearch();
                    }
                  }}
                  placeholder="Search songs, titles, artists..."
                  className="w-full rounded-[1.15rem] border border-white/10 bg-[#121318] py-3 pl-11 pr-4 text-[0.95rem] text-white placeholder-white/30 transition-all focus:border-amber-glow/50 focus:outline-none focus:ring-2 focus:ring-amber-glow/20 sm:rounded-2xl sm:py-4"
                />
              </div>

              <div className={`relative ${searchMode ? "hidden sm:block" : ""}`}>
                <input
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  onFocus={focusSearchLayout}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applySearch();
                    }
                  }}
                  placeholder="Artist name"
                  className="w-full rounded-[1.15rem] border border-white/10 bg-[#121318] px-4 py-3 text-[0.95rem] text-white placeholder-white/30 transition-all focus:border-amber-glow/50 focus:outline-none focus:ring-2 focus:ring-amber-glow/20 sm:rounded-2xl sm:py-4"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen((open) => !open)}
                  className={`inline-flex items-center justify-center gap-2 rounded-[1.05rem] border border-white/10 bg-white/5 px-3.5 py-3 text-xs font-bold text-white/85 transition-colors hover:border-amber-glow/35 hover:text-amber-glow ${
                    searchMode ? "" : "sm:hidden"
                  }`}
                >
                  <SlidersHorizontal className="size-4" />
                  Filters
                </button>
                <button
                  type="button"
                  onClick={applySearch}
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-[1.05rem] bg-amber-glow px-4 py-3 text-sm font-black text-stage-black shadow-[0_16px_40px_rgba(251,191,36,0.22)] transition-transform hover:scale-[1.02] ${
                    searchMode ? "" : "sm:flex-none sm:rounded-2xl sm:px-5"
                  }`}
                >
                  Search
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>

            <div
              className={`${mobileFiltersOpen || searchMode ? "grid" : "hidden"} gap-2 ${
                searchMode ? "grid-cols-2 sm:grid-cols-4" : "sm:grid sm:grid-cols-2 xl:grid-cols-4"
              }`}
            >
              {searchMode && (
                <input
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="Artist name"
                  className="col-span-2 rounded-[1rem] border border-white/10 bg-[#121318] px-3 py-3 text-sm text-white/85 placeholder-white/30 focus:border-amber-glow/40 focus:outline-none sm:hidden"
                />
              )}
              <select
                value={keyFilter}
                onChange={(e) => setKeyFilter(e.target.value)}
                className="w-full rounded-[1rem] border border-white/10 bg-[#121318] px-3 py-3 text-sm text-white/85 focus:border-amber-glow/40 focus:outline-none"
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
                className="w-full rounded-[1rem] border border-white/10 bg-[#121318] px-3 py-3 text-sm text-white/85 focus:border-amber-glow/40 focus:outline-none"
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
                className="w-full rounded-[1rem] border border-white/10 bg-[#121318] px-3 py-3 text-sm text-white/85 focus:border-amber-glow/40 focus:outline-none"
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
                className="w-full rounded-[1rem] border border-amber-glow/25 bg-amber-glow/10 px-3 py-3 text-sm font-semibold text-amber-glow focus:outline-none"
              >
                <option value="title">Sort by Title</option>
                <option value="artist">Sort by Artist</option>
                <option value="key">Sort by Key</option>
                <option value="recent">Sort by Recent</option>
              </select>
            </div>

            {searchMode && (
              <div className="min-h-0 flex-1 overflow-hidden rounded-[1.3rem] border border-white/10 bg-[#0f1015] p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Quick results</p>
                  <button
                    type="button"
                    onClick={clearDraftSearch}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white/60 transition-colors hover:text-white"
                  >
                    Clear
                  </button>
                </div>

                {!debouncedQ.trim() && !debouncedArtist.trim() ? (
                  <div className="rounded-[1rem] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
                    Start typing to preview songs in a vertical list.
                  </div>
                ) : previewLoading ? (
                  <div className="flex items-center justify-center gap-2 rounded-[1rem] border border-white/8 px-4 py-8 text-sm text-white/55">
                    <Loader2 className="size-4 animate-spin" />
                    Searching...
                  </div>
                ) : previewError ? (
                  <div className="rounded-[1rem] border border-amber-glow/20 bg-amber-glow/6 px-4 py-4 text-sm text-amber-glow">
                    {previewError}
                  </div>
                ) : previewSongs.length ? (
                  <div className="-mx-1 max-h-full space-y-1 overflow-y-auto px-1 pb-6">
                    {previewSongs.map((song) => (
                      <button
                        key={song.id}
                        type="button"
                        onClick={() => {
                          setQ(song.title);
                          setArtistName(song.artist);
                          setAppliedQ(song.title);
                          setAppliedArtistName(song.artist);
                          setPage(1);
                          setSearchMode(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-[1rem] border-b border-white/8 bg-transparent px-2 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.03]"
                      >
                        <img
                          src={song.cover}
                          alt={song.title}
                          className="size-12 shrink-0 rounded-[0.8rem] object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">{song.title}</p>
                          <p className="truncate text-xs text-white/50">{song.artist}</p>
                        </div>
                        <div className="text-right text-[11px] text-white/45">
                          <p>{song.key || "-"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1rem] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
                    No quick matches. Try fewer filters or a shorter search.
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {loading && !searchMode && <p className="text-sm text-white/50">Loading songs...</p>}
        {error && !searchMode && <p className="text-xs text-amber-glow">{error}</p>}

        {!searchMode && (
          <>
            <div className="space-y-3">
              {songs.map((song) => (
                <Link
                  key={song.id}
                  to="/songs/$songId"
                  params={{ songId: song.id }}
                  className="group block overflow-hidden rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,28,0.96),rgba(11,12,18,0.96))] p-3.5 text-white shadow-[0_16px_35px_rgba(0,0,0,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-glow/25 sm:p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative size-18 shrink-0 overflow-hidden rounded-[1rem] bg-stage-black sm:size-20">
                      <img
                        src={song.cover}
                        alt={song.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-[0.75rem] border border-white/10 bg-[rgba(37,99,235,0.22)] text-amber-glow backdrop-blur-md">
                        <Music2 className="size-3.5" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-[0.98rem] font-black tracking-tight text-white sm:text-[1.08rem]">
                            {song.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-1.5 text-[0.76rem] text-white/55 sm:text-[0.82rem]">
                            <UserRound className="size-3.5 shrink-0 text-white/35" />
                            <p className="truncate">{song.artist}</p>
                          </div>
                        </div>

                        <span className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[10px] ${difficultyTone(song.difficulty)}`}>
                          {song.difficulty || "Easy"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] font-bold text-amber-glow sm:text-[0.85rem]">
                        <Guitar className="size-3.5 text-white/35" />
                        {chordPreview(song).map((chord) => (
                          <span key={`${song.id}-${chord}`}>{chord}</span>
                        ))}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-white/50 sm:text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
                          <Clock3 className="size-3 text-violet-300" />
                          {song.beat || "4/4"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
                          <Music2 className="size-3 text-cyan-300" />
                          {song.tempo || 90} BPM
                        </span>
                        <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-white/65">
                          {song.genre || "Music"}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}

              {!songs.length && !loading && (
                <div className="rounded-[1.4rem] border border-dashed border-white/10 py-16 text-center text-white/40">
                  No songs match. Loosen your filters.
                </div>
              )}
            </div>

            <PaginationBar page={page} pages={pages} onPageChange={setPage} loading={loading} />
          </>
        )}
      </div>
    </AppShell>
  );
}
