import { Link } from "@tanstack/react-router";
import type { Song } from "@/lib/mock-data";

type SongCard = Pick<Song, "id" | "title" | "artist" | "cover" | "isNew" | "key">;

export function SongTile({ song, size = "md" }: { song: SongCard; size?: "sm" | "md" | "lg" }) {
  const w = size === "sm" ? "w-44 sm:w-36" : size === "lg" ? "w-60 sm:w-56" : "w-52 sm:w-44";
  return (
    <Link
      to="/songs/$songId"
      params={{ songId: song.id }}
      className={`${w} group cursor-pointer shrink-0 block`}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.35rem] border border-white/10 bg-stage-card ring-1 ring-white/5 transition-all group-hover:-translate-y-1 group-hover:ring-amber-glow/40">
        <img
          src={song.cover}
          alt={song.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stage-black via-stage-black/45 to-transparent" />
        {song.isNew && (
          <span className="absolute left-3 top-3 rounded-full bg-amber-glow px-2.5 py-1 text-[10px] font-black text-stage-black">
            NEW
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-black text-white transition-colors group-hover:text-amber-glow">
                  {song.title}
                </h4>
                <p className="mt-1 truncate text-[11px] text-white/60">{song.artist}</p>
              </div>
              <span className="shrink-0 rounded-full bg-stage-black/75 px-2 py-1 text-[10px] chord-text text-amber-glow">
                {song.key}
              </span>
            </div>
          </div>
        </div>
      </div>
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
          <h2 className="text-2xl sm:text-3xl font-black truncate">{title}</h2>
          {subtitle && <p className="text-sm text-white/40">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar snap-x snap-mandatory">
        {children}
      </div>
    </section>
  );
}
