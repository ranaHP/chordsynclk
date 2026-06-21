import { createFileRoute } from "@tanstack/react-router";
import { API_ENABLED, api } from "@/lib/api";
import { USERS } from "@/lib/mock-data";
import { useData } from "@/lib/store";
import { normalizeSong } from "@/lib/view-models";
import { Music, Users, Calendar, ListMusic } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type ViewSong = ReturnType<typeof normalizeSong>;

function AdminDashboard() {
  const { groups, events } = useData();
  const [songs, setSongs] = useState<ViewSong[]>([]);
  const playlists = events.reduce((n, e) => n + e.playlists.length, 0);

  useEffect(() => {
    let cancelled = false;

    async function loadSongs() {
      if (!API_ENABLED) return;

      try {
        const res = await api.listSongs("", "", 1, 6);
        if (cancelled) return;
        setSongs((res.songs || []).map(normalizeSong));
      } catch {
        if (cancelled) return;
        setSongs([]);
      }
    }

    loadSongs();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    { label: "Songs", value: songs.length, icon: Music, color: "amber-glow" },
    { label: "Users", value: USERS.length, icon: Users, color: "neon-sync" },
    { label: "Groups", value: groups.length, icon: Users, color: "amber-glow" },
    { label: "Events", value: events.length, icon: Calendar, color: "neon-hot" },
    { label: "Playlists", value: playlists, icon: ListMusic, color: "amber-glow" },
  ];

  return (
    <div className="p-4 sm:p-8 space-y-8">
      <header>
        <h1 className="text-3xl sm:text-4xl font-black">Dashboard</h1>
        <p className="text-sm text-white/40">Library health and ongoing activity at a glance.</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-5">
            <s.icon className="size-5 text-amber-glow mb-3" />
            <p className="text-3xl font-black">{s.value}</p>
            <p className="text-xs uppercase tracking-widest text-white/40 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-black text-lg mb-4">Recent songs</h3>
          <div className="space-y-2">
            {songs.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                <img src={s.cover} alt={s.title} className="size-10 rounded-md object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{s.title}</p>
                  <p className="text-[10px] text-white/40 truncate">
                    {s.artist} • {s.genre}
                  </p>
                </div>
                <span className="chord-text text-xs">{s.key}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-black text-lg mb-4">Upcoming events</h3>
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                <img src={e.image} alt={e.name} className="size-10 rounded-md object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{e.name}</p>
                  <p className="text-[10px] text-white/40">
                    {new Date(e.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
