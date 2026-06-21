import { createFileRoute, Link } from "@tanstack/react-router";
import { PaginationBar } from "@/components/PaginationBar";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { normalizeSong } from "@/lib/view-models";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/admin/songs")({
  component: AdminSongs,
});

type ViewSong = ReturnType<typeof normalizeSong>;

function AdminSongs() {
  const [q, setQ] = useState("");
  const [songs, setSongs] = useState<ViewSong[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const debouncedQ = useDebouncedValue(q, 250);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await api.listSongs(debouncedQ, "", page, 25, {}, { sort: "title" });
        if (cancelled) return;
        setSongs((res.songs || []).map(normalizeSong));
        setPage(res.page || 1);
        setPages(res.pages || 1);
        setTotal(res.total || 0);
      } catch {
        if (cancelled) return;
        setSongs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, page]);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black">Songs</h1>
          <p className="text-sm text-white/40">
            {total} in library{loading ? " · Loading..." : ""}
          </p>
        </div>
        <Link
          to="/admin/songs/new"
          className="px-4 py-2 rounded-full bg-amber-glow text-stage-black text-sm font-bold flex items-center gap-2"
        >
          <Plus className="size-4" /> Add song
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or artist..."
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-stage-card border border-white/10 text-white text-sm focus:outline-none focus:border-amber-glow/50"
        />
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="text-[10px] uppercase tracking-widest text-white/40 bg-white/[0.02]">
              <tr>
                <th className="text-left p-3">Song</th>
                <th className="text-left p-3">Artist</th>
                <th className="text-left p-3">Genre</th>
                <th className="text-left p-3">Year</th>
                <th className="text-left p-3">Key</th>
                <th className="text-left p-3">Tempo</th>
                <th className="text-left p-3"></th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => (
                <tr key={song.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="p-3 flex items-center gap-3">
                    <img
                      src={song.cover}
                      alt={song.title}
                      className="size-9 rounded-md object-cover"
                    />
                    <span className="font-bold">{song.title}</span>
                  </td>
                  <td className="p-3 text-white/70">{song.artist}</td>
                  <td className="p-3 text-white/60">{song.genre}</td>
                  <td className="p-3 text-white/60">{song.year}</td>
                  <td className="p-3 chord-text">{song.key}</td>
                  <td className="p-3 text-white/60">{song.tempo}</td>
                  <td className="p-3 text-right">
                    <Link
                      to="/admin/songs/$songId"
                      params={{ songId: song.id }}
                      className="text-amber-glow text-xs font-bold uppercase tracking-widest"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {!songs.length && !loading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-white/40">
                    No songs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar page={page} pages={pages} onPageChange={setPage} loading={loading} />
    </div>
  );
}
