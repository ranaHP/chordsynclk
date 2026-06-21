import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { buildSongPayload, partsFromViewSong } from "@/lib/song-admin";
import { normalizeSong } from "@/lib/view-models";
import { Field, inputCls } from "../routes/groups";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/songs/$songId")({
  notFoundComponent: () => <div className="p-8 text-white/60">Song not found.</div>,
  component: EditSong,
});

type SongPart = { name: string; chords: string; lyrics: string };
type ViewSong = ReturnType<typeof normalizeSong>;

function EditSong() {
  const { songId } = Route.useParams();
  const [song, setSong] = useState<ViewSong | null>(null);
  const [parts, setParts] = useState<SongPart[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await api.getSong(songId);
        if (cancelled) return;
        const normalized = normalizeSong(res.song);
        setSong(normalized);
        setParts(partsFromViewSong(normalized.parts));
      } catch {
        if (cancelled) return;
        setSong(null);
        setParts([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [songId]);

  const saveSong = async () => {
    if (!song) return;
    setSaving(true);
    setError("");
    try {
      const payload = buildSongPayload(
        {
          title: song.title,
          artist: song.artist,
          description: song.description,
          tempo: String(song.tempo),
          vibe: song.vibe,
          genre: song.genre,
          year: String(song.year),
          language: song.language,
          difficulty: song.difficulty,
          capo: song.capo,
          key: song.key,
          tags: song.tags.join(", "),
          cover: song.cover,
        },
        parts,
        song.id,
      );
      const res = await api.updateSong(song.id, payload);
      const normalized = normalizeSong(res.song);
      setSong(normalized);
      setParts(partsFromViewSong(normalized.parts));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save song");
    } finally {
      setSaving(false);
    }
  };

  if (!song) return <div className="p-8 text-white/60">Song not found.</div>;

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl">
      <Link
        to="/admin/songs"
        className="text-xs text-white/50 hover:text-amber-glow inline-flex items-center gap-1"
      >
        <ChevronLeft className="size-3.5" /> Songs
      </Link>
      <header className="flex gap-4 items-end">
        <img src={song.cover} alt={song.title} className="size-20 rounded-xl object-cover" />
        <div>
          <h1 className="text-3xl font-black">{song.title}</h1>
          <p className="text-white/50 text-sm">
            {song.artist} • {song.year}
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h3 className="font-black">Song parts</h3>
        {parts.map((part, idx) => (
          <div key={idx} className="glass-card rounded-2xl p-4 space-y-2">
            <p className="text-xs uppercase tracking-widest text-amber-glow font-bold">
              {part.name}
            </p>
            <Field label="Chord line">
              <input
                className={inputCls + " font-mono"}
                value={part.chords}
                onChange={(e) =>
                  setParts((current) =>
                    current.map((entry, i) =>
                      i === idx ? { ...entry, chords: e.target.value } : entry,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Lyrics">
              <textarea
                className={`${inputCls} font-mono min-h-24`}
                value={part.lyrics}
                onChange={(e) =>
                  setParts((current) =>
                    current.map((entry, i) =>
                      i === idx ? { ...entry, lyrics: e.target.value } : entry,
                    ),
                  )
                }
              />
            </Field>
          </div>
        ))}
      </section>

      {error && <p className="text-xs text-amber-glow">{error}</p>}
      <button
        onClick={saveSong}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-amber-glow text-stage-black font-bold disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}
