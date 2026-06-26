import { Link } from "@tanstack/react-router";
import type { Song } from "@/lib/mock-data";
import { Clock3, Guitar, Music2, UserRound } from "lucide-react";

type SongCard = Pick<
  Song,
  "id" | "title" | "artist" | "cover" | "isNew" | "key" | "tempo" | "difficulty" | "genre" | "beat" | "tags"
>;

function difficultyTone(level?: string) {
  if (level === "Hard") return "border-rose-400/30 bg-rose-500/10 text-rose-200";
  if (level === "Medium") return "border-amber-400/30 bg-amber-500/10 text-amber-100";
  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
}

function chordPreview(song: SongCard) {
  return [...(song.tags || []), song.key]
    .filter(Boolean)
    .slice(0, 4)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

export function SongTile({ song, size = "md" }: { song: SongCard; size?: "sm" | "md" | "lg" }) {
  const width =
    size === "lg"
      ? "w-[21rem] sm:w-[23rem]"
      : size === "sm"
        ? "w-[19rem] sm:w-[20.5rem]"
        : "w-[20rem] sm:w-[22rem]";

  const chords = chordPreview(song);

  return (
    <Link to="/songs/$songId" params={{ songId: song.id }} className={`${width} group block shrink-0`}>
      <article className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(20,22,30,0.96),rgba(11,12,18,0.96))] p-3.5 text-white shadow-[0_18px_45px_rgba(0,0,0,0.28)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-amber-glow/30 group-hover:shadow-[0_22px_55px_rgba(0,0,0,0.34)] sm:p-4">
        <div className="flex gap-3">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-[1.1rem] bg-stage-black sm:size-26">
            <img
              src={song.cover}
              alt={song.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute left-2.5 top-2.5 flex size-8 items-center justify-center rounded-[0.8rem] border border-white/10 bg-[rgba(37,99,235,0.22)] text-amber-glow backdrop-blur-md">
              <Music2 className="size-4" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-[1.05rem] font-black tracking-tight text-white sm:text-[1.15rem]">
                  {song.title}
                </h3>
                <div className="mt-1.5 flex items-center gap-1.5 text-[0.78rem] text-white/55 sm:text-[0.82rem]">
                  <UserRound className="size-3.5 shrink-0 text-white/35" />
                  <p className="truncate">{song.artist}</p>
                </div>
              </div>

              {song.isNew ? (
                <span className="shrink-0 rounded-full border border-amber-glow/25 bg-amber-glow/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-glow">
                  New
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] font-bold text-amber-glow sm:text-[0.88rem]">
              <Guitar className="size-3.5 text-white/35" />
              {chords.length ? chords.map((chord) => <span key={`${song.id}-${chord}`}>{chord}</span>) : <span>{song.key}</span>}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-white/55 sm:text-[11px]">
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
              <span className={`inline-flex rounded-full border px-2 py-1 ${difficultyTone(song.difficulty)}`}>
                {song.difficulty || "Easy"}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function Shelf({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-black sm:text-3xl">{title}</h2>
          {subtitle && <p className="text-sm text-white/40">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 no-scrollbar snap-x snap-mandatory">
        {children}
      </div>
    </section>
  );
}
