import { Link } from "@tanstack/react-router";
import type { Song } from "@/lib/mock-data";

type SongCard = Pick<Song, "id" | "title" | "artist" | "cover" | "isNew" | "key">;

export function SongTile({ song, size = "md" }: { song: SongCard; size?: "sm" | "md" | "lg" }) {
  const w = size === "sm" ? "w-36" : size === "lg" ? "w-56" : "w-44";
  return (
    <Link
      to="/songs/$songId"
      params={{ songId: song.id }}
      className={`${w} group cursor-pointer shrink-0 block`}
    >
      <div className="aspect-square rounded-2xl overflow-hidden mb-3 relative ring-1 ring-white/5 group-hover:ring-amber-glow/40 transition-all">
        <img
          src={song.cover}
          alt={song.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stage-black/90 via-stage-black/10 to-transparent" />
        {song.isNew && (
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-glow text-stage-black text-[10px] font-black rounded">
            NEW
          </span>
        )}
        <span className="absolute bottom-2 right-2 chord-text text-xs bg-stage-black/70 px-1.5 py-0.5 rounded">
          {song.key}
        </span>
      </div>
      <h4 className="font-bold text-sm truncate group-hover:text-amber-glow transition-colors">
        {song.title}
      </h4>
      <p className="text-xs text-white/40 truncate">{song.artist}</p>
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
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar snap-x">
        {children}
      </div>
    </section>
  );
}
