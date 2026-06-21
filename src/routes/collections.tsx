import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PaginationBar } from "@/components/PaginationBar";
import { api, API_ENABLED } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Search, Music2, Disc3, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/collections")({
  head: () => ({
    meta: [
      { title: "Collections - ChordSync Live" },
      {
        name: "description",
        content: "Browse the full catalogue of artists and their chord sheets.",
      },
    ],
  }),
  component: CollectionsPage,
});

interface ArtistTile {
  artistId: string;
  name: string;
  slug: string;
  songCount: number;
  source?: string;
  cover: string;
}

type SongRow = {
  songId: string;
  title: string;
  artistName: string;
  key?: string;
  chordsUsed?: string[];
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function CollectionsPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"artists" | "songs">("artists");
  const [artists, setArtists] = useState<ArtistTile[]>([]);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [artistPage, setArtistPage] = useState(1);
  const [songPage, setSongPage] = useState(1);
  const [artistPages, setArtistPages] = useState(1);
  const [songPages, setSongPages] = useState(1);
  const [artistTotal, setArtistTotal] = useState(0);
  const [songTotal, setSongTotal] = useState(0);
  const [loading, setLoading] = useState(API_ENABLED);
  const [error, setError] = useState<string | null>(null);
  const debouncedQ = useDebouncedValue(q, 250);

  useEffect(() => {
    if (tab === "artists") setArtistPage(1);
    else setSongPage(1);
  }, [debouncedQ, tab]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) return;
      setLoading(true);
      try {
        if (tab === "artists") {
          const {
            artists: artistRows,
            total,
            pages,
            page,
          } = await api.listArtists(debouncedQ, artistPage, 20);
          if (cancelled) return;
          setArtists(
            artistRows.map((artist) => ({
              artistId: String(artist.artistId || artist.slug || artist.name),
              name: String(artist.name || "Unknown Artist"),
              slug: String(artist.slug || artist.name || "artist"),
              songCount: Number(artist.songCount ?? 0),
              source: typeof artist.source === "string" ? artist.source : undefined,
              cover: `https://picsum.photos/seed/${encodeURIComponent(String(artist.slug || artist.name || "artist"))}/600/600`,
            })),
          );
          setArtistTotal(total || 0);
          setArtistPages(pages || 1);
          setArtistPage(page || 1);
        } else {
          const {
            songs: songRows,
            total,
            pages,
            page,
          } = await api.listSongs(
            debouncedQ,
            "",
            songPage,
            24,
            {},
            { sort: "title", content: "summary" },
          );
          if (cancelled) return;
          setSongs(
            songRows.map((song) => ({
              songId: String(song.songId || ""),
              title: String(song.title || "Untitled Song"),
              artistName: String(song.artistName || "Unknown Artist"),
              key: typeof song.key === "string" ? song.key : undefined,
              chordsUsed: Array.isArray(song.chordsUsed)
                ? song.chordsUsed.filter((chord): chord is string => typeof chord === "string")
                : [],
            })),
          );
          setSongTotal(total || 0);
          setSongPages(pages || 1);
          setSongPage(page || 1);
        }
        setError(null);
      } catch (loadError: unknown) {
        if (!cancelled) setError(getErrorMessage(loadError, "Failed to load collections"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [artistPage, debouncedQ, songPage, tab]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-amber-glow text-xs font-bold uppercase tracking-widest">Catalogue</p>
            <h1 className="text-4xl sm:text-5xl font-black">Collections</h1>
            <p className="text-white/50 mt-2 max-w-xl text-sm">
              Every artist, every chord sheet - synced and ready for the stage.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-white/30">
            {API_ENABLED ? "Live · backend" : "Backend not configured"}
          </span>
        </div>

        <div className="glass-card rounded-2xl p-3 sm:p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/30" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search artists or song titles..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-glow/40"
            />
          </div>
          <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 text-xs font-bold">
            <button
              onClick={() => setTab("artists")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${tab === "artists" ? "bg-amber-glow text-stage-black" : "text-white/60"}`}
            >
              <Disc3 className="size-3.5" /> Artists ({artistTotal})
            </button>
            <button
              onClick={() => setTab("songs")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${tab === "songs" ? "bg-amber-glow text-stage-black" : "text-white/60"}`}
            >
              <Music2 className="size-3.5" /> Songs ({songTotal})
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-white/50 text-sm mb-4">
            <Loader2 className="size-4 animate-spin" /> Loading from backend...
          </div>
        )}
        {error && <div className="text-rose-300/80 text-xs mb-4">{error}</div>}

        {tab === "artists" ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {artists.map((artist) => (
                <Link
                  key={artist.artistId}
                  to="/search"
                  className="group glass-card rounded-2xl overflow-hidden hover:border-amber-glow/40 transition-all hover:-translate-y-1"
                >
                  <div className="aspect-square relative overflow-hidden">
                    <img
                      src={artist.cover}
                      alt={artist.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stage-black via-stage-black/40 to-transparent" />
                    <div className="absolute top-2 right-2 size-7 rounded-full bg-stage-black/60 backdrop-blur flex items-center justify-center">
                      <Disc3 className="size-3.5 text-amber-glow animate-pulse" />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-sm truncate">{artist.name}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
                      {artist.songCount} {artist.songCount === 1 ? "song" : "songs"}
                    </p>
                  </div>
                </Link>
              ))}
              {!artists.length && !loading && (
                <p className="text-white/40 text-sm col-span-full text-center py-12">
                  No artists match "{q}".
                </p>
              )}
            </div>
            <div className="mt-6">
              <PaginationBar
                page={artistPage}
                pages={artistPages}
                onPageChange={setArtistPage}
                loading={loading}
              />
            </div>
          </>
        ) : (
          <>
            <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/5">
              {songs.map((song) => (
                <Link
                  key={song.songId}
                  to="/songs/$songId"
                  params={{ songId: song.songId }}
                  className="flex items-center gap-3 p-3 sm:p-4 hover:bg-white/[0.03] transition-colors group"
                >
                  <div className="size-10 rounded-lg bg-amber-glow/10 border border-amber-glow/20 flex items-center justify-center text-amber-glow font-black text-sm">
                    {song.key ?? "-"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{song.title}</p>
                    <p className="text-[11px] text-white/40 truncate">{song.artistName}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5">
                    {(song.chordsUsed ?? []).slice(0, 4).map((chord, index) => (
                      <span
                        key={index}
                        className="chord-text text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10"
                      >
                        {chord}
                      </span>
                    ))}
                  </div>
                  <ExternalLink className="size-3.5 text-white/30 group-hover:text-amber-glow transition-colors" />
                </Link>
              ))}
              {!songs.length && !loading && (
                <p className="text-white/40 text-sm text-center py-12">No songs match "{q}".</p>
              )}
            </div>
            <div className="mt-6">
              <PaginationBar
                page={songPage}
                pages={songPages}
                onPageChange={setSongPage}
                loading={loading}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
