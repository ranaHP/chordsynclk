import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AmbientStage } from "@/components/AppShell";
import { SongTile, Shelf } from "@/components/SongTile";
import { api, API_ENABLED } from "@/lib/api";
import { USERS } from "@/lib/mock-data";
import { useAuth, useData } from "@/lib/store";
import { normalizeSong } from "@/lib/view-models";
import { useEffect, useState } from "react";
import {
  type LucideIcon,
  CircleDot,
  Flag,
  Guitar,
  Menu,
  Music2,
  NotebookText,
  Search,
  Star,
  UserRound,
  Users as UsersIcon,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChordSync Live - Home" },
      {
        name: "description",
        content: "Play, sing, and feel Sri Lanka with chords, artists, playlists, and community.",
      },
    ],
  }),
  component: HomePage,
});

type ViewSong = ReturnType<typeof normalizeSong>;

const HOME_LINKS = [
  { label: "Songs", to: "/search" },
  { label: "Artists", to: "/collections" },
  { label: "Chords", to: "/search" },
  { label: "Playlists", to: "/groups" },
  { label: "Blog", to: "/users" },
];

const MOBILE_HOME_LINKS = [
  { label: "Songs", to: "/search", icon: Music2 },
  { label: "Artists", to: "/collections", icon: Star },
  { label: "Chords", to: "/search", icon: CircleDot },
  { label: "Playlists", to: "/groups", icon: NotebookText },
  { label: "Community", to: "/users", icon: UsersIcon },
];

const FLOATING_ORNAMENTS: {
  icon: LucideIcon;
  top: string;
  left: string;
  delay: string;
  size: string;
  tone: string;
  rotate: string;
}[] = [
  {
    icon: Music2,
    top: "12%",
    left: "74%",
    delay: "0ms",
    size: "size-7",
    tone: "text-amber-glow/90",
    rotate: "-rotate-12",
  },
  {
    icon: Guitar,
    top: "30%",
    left: "88%",
    delay: "900ms",
    size: "size-8",
    tone: "text-white/60",
    rotate: "rotate-12",
  },
  {
    icon: Star,
    top: "48%",
    left: "73%",
    delay: "1500ms",
    size: "size-6",
    tone: "text-amber-glow/75",
    rotate: "rotate-6",
  },
  {
    icon: CircleDot,
    top: "18%",
    left: "92%",
    delay: "2200ms",
    size: "size-5",
    tone: "text-white/55",
    rotate: "-rotate-6",
  },
];

const STATS = [
  { icon: Music2, value: "10,000+", label: "Songs" },
  { icon: Guitar, value: "2,500+", label: "Artists" },
  { icon: NotebookText, value: "50,000+", label: "Chords" },
  { icon: UsersIcon, value: "25K+", label: "Users" },
];

const FEATURES = [
  { icon: Guitar, label: "Easy to Play" },
  { icon: CircleDot, label: "Accurate Chords" },
  { icon: Flag, label: "Sri Lankan Songs" },
  { icon: UsersIcon, label: "Community Driven" },
];

function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups } = useData();
  const [topSongs, setTopSongs] = useState<ViewSong[]>([]);
  const [recentSongs, setRecentSongs] = useState<ViewSong[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSongs() {
      if (!API_ENABLED) return;
      try {
        const [topRes, recentRes] = await Promise.all([
          api.listSongs("", "", 1, 8, {}, { sort: "title" }),
          api.listSongs("", "", 1, 8, {}, { sort: "recent" }),
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
    <div className="min-h-screen bg-[#070812] text-white">
      <AmbientStage />

      <section className="relative overflow-hidden bg-[#090b17]">
        <div className="absolute inset-0">
          <img
            src="/landing/bg-1.png"
            alt="Beach session"
            className="animate-slow-pan h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,10,20,0.96)_0%,rgba(12,14,28,0.86)_32%,rgba(17,12,28,0.36)_62%,rgba(6,5,15,0.82)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_30%,rgba(255,179,85,0.22),transparent_28%),radial-gradient(circle_at_72%_18%,rgba(120,80,255,0.14),transparent_20%)]" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-[1720px] flex-col px-4 pb-6 pt-4 sm:px-6 lg:px-8">
          <header className="animate-fade-in-soft rounded-[1rem] border border-white/10 bg-[rgba(9,11,23,0.72)] px-3.5 py-3.5 backdrop-blur-xl sm:px-6 sm:py-4">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4 lg:flex-nowrap lg:gap-8">
              <Link to="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <div className="animate-pulse-ring flex size-10 shrink-0 items-center justify-center rounded-[1.1rem] border border-amber-glow/45 bg-amber-glow/10 text-amber-glow sm:size-12 sm:rounded-[1.25rem]">
                  <Guitar className="size-6 sm:size-8" />
                </div>
                <div className="min-w-0 leading-none">
                  <p className="text-[1.1rem] font-black tracking-tight text-white sm:text-[1.4rem] pb-1">CHORD</p>
                  <p className="-mt-1 text-[1.0rem] font-black tracking-tight text-amber-glow sm:text-[1.4rem]">
                    SYNCLK
                  </p>
                </div>
              </Link>

              <nav className="hidden items-center gap-8 lg:flex">
                {HOME_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="text-[1.05rem] font-semibold text-white/88 transition-colors hover:text-amber-glow"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
                <button
                  onClick={() => navigate({ to: "/search" })}
                  className="group hidden min-w-0 flex-1 items-center gap-3 rounded-full border border-white/20 bg-white/4 px-4 py-3 text-left text-white/55 backdrop-blur-md transition-colors hover:border-amber-glow/45 hover:text-white lg:flex lg:min-w-[340px]"
                >
                  <Search className="size-5 text-amber-glow" />
                  <span className="truncate text-sm sm:text-base">Search songs, artists...</span>
                </button>

                {user ? (
                  <div className="hidden items-center gap-3 rounded-full border border-white/15 bg-white/5 px-3 py-2 lg:flex">
                    <img src={user.avatar} alt={user.name} className="size-10 rounded-full object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{user.name}</p>
                      <p className="truncate text-xs text-white/55">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Link
                      to="/auth"
                      className="hidden text-lg font-semibold text-white/95 transition-colors hover:text-amber-glow lg:block"
                    >
                      Login
                    </Link>
                    <Link
                      to="/auth"
                      className="inline-flex items-center gap-1.5 rounded-[1.05rem] bg-amber-glow px-2 py-2 text-[0.82rem] font-black text-stage-black shadow-[0_14px_40px_rgba(251,191,36,0.28)] transition-transform hover:scale-[1.02] sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-2 sm:text-lg"
                    >
                      <UserRound className="size-3 sm:size-4" />
                      <span className="hidden sm:inline">Sign Up</span>
                      <span className="sm:hidden">Join</span>
                    </Link>
                  </>
                )}

                <button
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  className="flex size-10 shrink-0 items-center justify-center rounded-[1.05rem] border border-white/12 bg-white/[0.04] text-white transition-colors hover:border-amber-glow/40 hover:text-amber-glow sm:size-12 sm:rounded-2xl lg:hidden"
                  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                >
                  {mobileMenuOpen ? <X className="size-4 sm:size-5" /> : <Menu className="size-4 sm:size-5" />}
                </button>
              </div>
            </div>

            {mobileMenuOpen && (
              <nav className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
                {MOBILE_HOME_LINKS.map(({ label, to, icon: Icon }) => (
                  <Link
                    key={label}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-[68px] items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-left text-sm font-bold text-white/82 transition-colors hover:border-amber-glow/40 hover:text-amber-glow"
                  >
                    <Icon className="size-4 shrink-0 text-amber-glow" />
                    <span>{label}</span>
                  </Link>
                ))}
              </nav>
            )}
          </header>

          <div className="relative flex flex-1 items-center py- pt-10 sm:py-12 lg:py-14">
            <div className="grid w-full gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
              <div className="max-w-[640px] animate-fade-in-soft [animation-delay:120ms]">
                <div className="flex flex-wrap items-center gap-3 text-[0.72rem] font-extrabold uppercase tracking-[0.16em] text-amber-glow sm:text-[0.95rem]">
                  <span>Chords</span>
                  <span className="h-px w-8 bg-amber-glow/50" />
                  <span>Community</span>
                  <span className="h-px w-8 bg-amber-glow/50" />
                  <span>Music</span>
                </div>

                <h1 className="hero-text mt-5 text-[3.45rem] leading-[0.86] text-white sm:text-[5.2rem] lg:text-[8.2rem]">
                  <span className="block">PLAY.</span>
                  <span className="block">SING.</span>
                  <span className="mt-1 block text-amber-glow">FEEL SRI LANKA.</span>
                </h1>

                <p className="mt-5 max-w-[520px] text-base leading-7 text-white/85 sm:text-[1.08rem] sm:leading-8">
                  Find guitar chords for your favorite songs. Made for Sri Lankan music lovers.
                </p>

                <button
                  onClick={() => navigate({ to: "/search" })}
                  className="mt-5 flex w-full items-center gap-3 rounded-[1.15rem] border border-white/18 bg-[rgba(9,12,24,0.62)] px-4 py-3 text-left text-white/60 backdrop-blur-md transition-colors hover:border-amber-glow/40 hover:text-white sm:mt-6 sm:rounded-[1.25rem]"
                >
                  <Search className="size-5 shrink-0 text-amber-glow" />
                  <span className="truncate text-[0.9rem] sm:text-base">Search songs, artists, chords...</span>
                </button>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/search"
                    className="inline-flex items-center justify-center gap-3 rounded-[1.2rem] bg-amber-glow px-6 py-3.5 text-base font-black text-stage-black shadow-[0_18px_50px_rgba(251,191,36,0.24)] transition-transform hover:scale-[1.02] sm:text-lg"
                  >
                    <Guitar className="size-5" /> Explore Songs
                  </Link>
                  <Link
                    to="/search"
                    className="inline-flex items-center justify-center gap-3 rounded-[1.2rem] border border-white/25 bg-white/4 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-md transition-colors hover:border-amber-glow/40 hover:bg-white/8 sm:text-lg"
                  >
                    <Star className="size-5 text-amber-glow" /> Popular Chords
                  </Link>
                </div>
              </div>

              <div className="relative min-h-[260px] animate-fade-in-soft [animation-delay:220ms] lg:min-h-[560px]  hidden md:block">
                <div className="pointer-events-none absolute inset-0 hidden md:block">
                  {FLOATING_ORNAMENTS.map(({ icon: Icon, top, left, delay, size, tone, rotate }) => (
                    <div
                      key={`${top}-${left}-${delay}`}
                      className={`animate-drift-float absolute ${rotate}`}
                      style={{ top, left, animationDelay: delay }}
                    >
                      <Icon className={`${size} ${tone} drop-shadow-[0_0_18px_rgba(251,191,36,0.24)]`} />
                    </div>
                  ))}
                </div>

                <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-end">
                  <div className="animate-drift-float hidden shrink-0 flex-col items-center justify-center self-end rounded-full border border-white/20 bg-[rgba(16,16,20,0.48)] text-center backdrop-blur-xl sm:flex sm:size-[188px] [animation-delay:1500ms]">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-white/75">
                      Made For
                    </p>
                    <p className="mt-2 text-[1.55rem] font-black leading-none text-white sm:text-[2rem]">
                      SRI LANKA
                    </p>
                    <div className="mt-3 h-px w-20 bg-amber-glow/50" />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute left-0 top-24 hidden gap-2 lg:grid ">
              {Array.from({ length: 9 }).map((_, row) => (
                <div key={row} className="flex gap-2">
                  {Array.from({ length: 6 }).map((__, col) => (
                    <span key={`${row}-${col}`} className="size-1 rounded-full bg-white/35" />
                  ))}
                </div>
              ))}
            </div>

            <div className="absolute right-0 top-24 hidden gap-2 lg:grid">
              {Array.from({ length: 9 }).map((_, row) => (
                <div key={row} className="flex gap-2">
                  {Array.from({ length: 6 }).map((__, col) => (
                    <span key={`${row}-${col}`} className="size-1 rounded-full bg-white/35" />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-auto space-y-4 animate-fade-in-soft [animation-delay:340ms] ">
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] mt-10  md:mt-0">
              <div className="grid grid-cols-2 gap-3 rounded-[2rem] border border-white/14 bg-[rgba(6,10,20,0.8)] px-4 py-5 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:grid-cols-4 sm:px-6">
                {STATS.map(({ icon: Icon, value, label }) => (
                  <div
                    key={label}
                    className="flex min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-2 text-center transition-transform hover:-translate-y-1 sm:border-r sm:border-white/8 last:border-r-0 sm:pr-3"
                  >
                    <Icon className="size-7 text-amber-glow" />
                    <p className="mt-3 text-xl font-black text-white sm:text-[2.2rem]">{value}</p>
                    <p className="text-sm text-white/78 sm:text-base">{label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-[2rem] border border-white/14 bg-[rgba(6,10,20,0.72)] p-4 backdrop-blur-xl sm:grid-cols-4">
                {FEATURES.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-white/[0.03] px-3 py-4 text-center text-xs font-bold text-white/88 transition-colors hover:bg-white/[0.06] sm:text-sm"
                  >
                    <Icon className="size-4 shrink-0 text-amber-glow" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 bg-[#070812]">
        <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:space-y-14 sm:px-6 lg:px-8">
          <Shelf
            title="Top Hits of the Moment"
            subtitle="What performers are playing tonight"
            action={
              <Link
                to="/search"
                className="text-xs font-black uppercase tracking-[0.18em] text-amber-glow hover:underline"
              >
                View all
              </Link>
            }
          >
            {topSongs.map((song) => (
              <div key={song.id} className="snap-center">
                <SongTile song={song} size="lg" />
              </div>
            ))}
          </Shelf>

          <Shelf title="Fresh Chords" subtitle="Recently added for your next session">
            {recentSongs.map((song) => (
              <div key={song.id} className="snap-center">
                <SongTile song={song} size="sm" />
              </div>
            ))}
          </Shelf>

          <section className="space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white sm:text-3xl">Active Jam Groups</h2>
                <p className="mt-1 text-sm text-white/45">
                  Join crews that are building live playlists and synced performances.
                </p>
              </div>
              <Link
                to="/groups"
                className="text-xs font-black uppercase tracking-[0.18em] text-amber-glow hover:underline"
              >
                Open groups
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groups.slice(0, 6).map((group) => (
                <Link
                  key={group.id}
                  to="/groups/$groupId"
                  params={{ groupId: group.id }}
                  className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-stage-card/80 transition-all hover:-translate-y-1 hover:border-amber-glow/35"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={group.image}
                      alt={group.name}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#080911] via-transparent to-transparent" />
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black text-white">{group.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-white/55">{group.description}</p>
                      </div>
                      <span className="rounded-full border border-amber-glow/25 bg-amber-glow/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-glow">
                        Live
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {group.members.slice(0, 4).map((member) => {
                          const performer = USERS.find((entry) => entry.id === member.userId);
                          return performer ? (
                            <img
                              key={member.userId}
                              src={performer.avatar}
                              alt={performer.name}
                              className="size-9 rounded-full border-2 border-[#070812] object-cover"
                            />
                          ) : null;
                        })}
                      </div>
                      <p className="text-sm font-semibold text-white/70">{group.members.length} members</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
