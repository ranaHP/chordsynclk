import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await api.listSongs(q, "", 1, 500);
        if (cancelled) return;
        setSongs((res.songs || []).map(normalizeSong));
      } catch {
        if (cancelled) return;
        setSongs([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black">Songs</h1>
          <p className="text-sm text-white/40">{songs.length} in library</p>
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
