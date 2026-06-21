import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SongTile, Shelf } from "@/components/SongTile";
import { api, API_ENABLED } from "@/lib/api";
import { COLLECTIONS, MASHUPS, USERS, getUser } from "@/lib/mock-data";
import { useData, useAuth } from "@/lib/store";
import { normalizeSong } from "@/lib/view-models";
import { useEffect, useState } from "react";
import { Radio, Sparkles, Users as UsersIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChordSync Live - Home" },
      {
        name: "description",
        content: "Top hits, recent songs, mashups, and live jam groups for guitarists.",
      },
    ],
  }),
  component: HomePage,
});

type ViewSong = ReturnType<typeof normalizeSong>;

function HomePage() {
  const { user } = useAuth();
  const { groups, events } = useData();
  const upcoming = events[0];
  const [topSongs, setTopSongs] = useState<ViewSong[]>([]);
  const [recentSongs, setRecentSongs] = useState<ViewSong[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadSongs() {
      if (!API_ENABLED) return;
      try {
        const [topRes, recentRes] = await Promise.all([
          api.listSongs("", "", 1, 10, {}, { sort: "title" }),
          api.listSongs("", "", 1, 10, {}, { sort: "recent" }),
        ]);
        if (cancelled) return;
        setTopSongs((topRes.songs || []).map(normalizeSong));
        setRecentSongs((recentRes.songs || []).map(normalizeSong));
      } catch {
        if (cancelled) return;
        setTopSongs([]);
        setRecentSongs([]);
      }
    }

    loadSongs();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10 space-y-12 sm:space-y-16">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-stage-card p-6 sm:p-10 animate-fade-in-up">
          <div className="absolute -top-20 -right-20 size-72 bg-amber-glow/20 blur-3xl rounded-full" />
          <div className="relative grid lg:grid-cols-[1.3fr_1fr] gap-8 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-glow/10 border border-amber-glow/30 text-amber-glow text-[10px] font-bold uppercase tracking-widest">
                <Radio className="size-3 animate-pulse" /> Live tonight
              </span>
              <h1 className="mt-4 text-4xl sm:text-5xl md:text-6xl font-black leading-[1.05]">
                Welcome back,{" "}
                <span className="text-amber-glow italic font-light">
                  {user?.name?.split(" ")[0] ?? "performer"}
                </span>
              </h1>
              <p className="mt-3 text-white/60 max-w-prose">
                Build setlists, follow chord sheets at your tempo, and keep your whole group on the
                same line in stage mode.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/search"
                  className="px-5 py-2.5 rounded-full bg-amber-glow text-stage-black font-bold text-sm glow-amber hover:scale-105 transition-transform"
                >
                  Browse chords
                </Link>
                {upcoming && (
                  <Link
                    to="/events/$eventId"
                    params={{ eventId: upcoming.id }}
                    className="px-5 py-2.5 rounded-full border border-white/15 text-white text-sm font-medium hover:bg-white/5 transition-colors"
                  >
                    Open next event →
                  </Link>
                )}
              </div>
            </div>
            <div className="hidden lg:block">
              <FloatingEQ />
            </div>
          </div>
        </section>

        <Shelf
          title="Top Hits of the Moment"
          subtitle="What performers are playing tonight"
          action={
            <Link
              to="/search"
              className="text-xs font-bold text-amber-glow uppercase tracking-widest hover:underline"
            >
              View all
            </Link>
          }
        >
          {topSongs.map((song) => (
            <div key={song.id} className="snap-start">
              <SongTile song={song} />
            </div>
          ))}
        </Shelf>

        <Shelf title="Recently Added" subtitle="Fresh chord sheets, just transcribed">
          {recentSongs.map((song) => (
            <div key={song.id} className="snap-start">
              <SongTile song={song} size="sm" />
            </div>
          ))}
        </Shelf>

        <section className="space-y-4">
          <h2 className="text-2xl sm:text-3xl font-black">Song Collections</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {COLLECTIONS.map((collection) => (
              <div
                key={collection.id}
                className="group relative aspect-[4/5] rounded-2xl overflow-hidden ring-1 ring-white/5 hover:ring-amber-glow/40 transition-all cursor-pointer"
              >
                <img
                  src={collection.image}
                  alt={collection.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stage-black via-stage-black/40 to-transparent" />
                <div className="absolute inset-0 p-4 flex flex-col justify-end">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-glow">
                    {collection.tag}
                  </p>
                  <h3 className="text-base sm:text-lg font-black leading-tight">
                    {collection.name}
                  </h3>
                  <p className="text-[10px] text-white/50 mt-1">
                    {collection.songIds.length} songs
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-3">
                <Sparkles className="text-amber-glow size-6" /> Mashup Nonstop
              </h2>
              <p className="text-sm text-white/40">Stitched together for one-take sets</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MASHUPS.map((mashup) => (
              <div
                key={mashup.id}
                className="glass-card rounded-2xl p-1 group cursor-pointer hover:border-amber-glow/30 transition-colors"
              >
                <div className="relative aspect-[16/9] rounded-xl overflow-hidden">
                  <img
                    src={mashup.image}
                    alt={mashup.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stage-black/95 via-stage-black/30 to-transparent" />
                  <div className="absolute bottom-0 p-4 w-full">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neon-sync">
                      {mashup.duration} • nonstop
                    </p>
                    <h3 className="text-lg font-black">{mashup.name}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-3">
              <UsersIcon className="text-amber-glow size-6" /> Active Jam Groups
            </h2>
            <Link
              to="/groups"
              className="text-xs font-bold text-amber-glow uppercase tracking-widest hover:underline"
            >
              Open groups
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <Link
                key={group.id}
                to="/groups/$groupId"
                params={{ groupId: group.id }}
                className="glass-card rounded-2xl overflow-hidden block group hover:border-amber-glow/30 transition-colors"
              >
                <div className="aspect-[16/9] relative overflow-hidden">
                  <img
                    src={group.image}
                    alt={group.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stage-black to-transparent" />
                </div>
                <div className="p-4">
                  <h3 className="font-black text-lg">{group.name}</h3>
                  <p className="text-xs text-white/50 line-clamp-2 mt-1">{group.description}</p>
                  <div className="flex -space-x-2 mt-3">
                    {group.members.slice(0, 5).map((member) => {
                      const memberUser = getUser(member.userId);
                      return memberUser ? (
                        <img
                          key={member.userId}
                          src={memberUser.avatar}
                          alt={memberUser.name}
                          className="size-7 rounded-full ring-2 ring-stage-card"
                        />
                      ) : null;
                    })}
                    {group.members.length > 5 && (
                      <div className="size-7 rounded-full bg-white/10 ring-2 ring-stage-card text-[10px] font-bold flex items-center justify-center">
                        +{group.members.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl sm:text-3xl font-black">Performers to Follow</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {USERS.slice(0, 12).map((performer) => (
              <div
                key={performer.id}
                className="glass-card rounded-2xl p-3 sm:p-4 text-center hover:border-amber-glow/30 transition-colors"
              >
                <img
                  src={performer.avatar}
                  alt={performer.name}
                  className="size-16 sm:size-20 mx-auto rounded-full ring-2 ring-amber-glow/20"
                />
                <h4 className="mt-3 font-bold text-sm truncate">{performer.name}</h4>
                <p className="text-[10px] text-white/40 truncate">{performer.handle}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function FloatingEQ() {
  return (
    <div className="flex items-end justify-center gap-1.5 h-40">
      {Array.from({ length: 16 }).map((_, index) => (
        <div
          key={index}
          className="w-2 bg-gradient-to-t from-amber-deep to-amber-glow rounded-full animate-eq"
          style={{
            height: `${20 + ((index * 13) % 100)}%`,
            animationDelay: `${index * 80}ms`,
            animationDuration: `${0.6 + (index % 4) * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
