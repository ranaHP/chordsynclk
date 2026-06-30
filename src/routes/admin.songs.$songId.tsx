import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { buildSongPayload, partsFromViewSong } from "@/lib/song-admin";
import { normalizeSong } from "@/lib/view-models";
import { Field, inputCls } from "../routes/groups";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/songs/$songId")({
  notFoundComponent: () => <div className="p-8 text-white/60">Song not found.</div>,
  component: EditSong,
});

type SongPart = { name: string; chords: string; lyrics: string };
type ViewSong = ReturnType<typeof normalizeSong>;

function EditSong() {
  const { songId } = Route.useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState<ViewSong | null>(null);
  const [parts, setParts] = useState<SongPart[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const deleteSong = async () => {
    if (!song || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await api.deleteSong(song.id);
      navigate({ to: "/admin/songs" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete song");
      setDeleting(false);
    }
  };

  if (!song) return <div className="p-8 text-white/60">Song not found.</div>;

  return (
    <div className="max-w-4xl space-y-6 p-4 sm:p-8">
      <Link
        to="/admin/songs"
        className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-amber-glow"
      >
        <ChevronLeft className="size-3.5" /> Songs
      </Link>

      <header className="flex flex-wrap items-end gap-4">
        <img src={song.cover} alt={song.title} className="size-20 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black">{song.title}</h1>
          <p className="text-sm text-white/50">
            {song.artist} · {song.year}
          </p>
        </div>
        <button
          onClick={() => void deleteSong()}
          disabled={deleting}
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-200 disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete song"}
        </button>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-black">Song parts</h3>
          <button
            onClick={() =>
              setParts((current) => [
                ...current,
                { name: `Part ${current.length + 1}`, chords: "", lyrics: "" },
              ])
            }
            className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 hover:text-amber-glow"
          >
            <Plus className="mr-1 inline size-3.5" />
            Add part
          </button>
        </div>

        {parts.map((part, idx) => (
          <div key={`${part.name}-${idx}`} className="glass-card space-y-2 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <input
                className={`${inputCls} max-w-xs text-xs font-bold uppercase tracking-widest text-amber-glow`}
                value={part.name}
                onChange={(e) =>
                  setParts((current) =>
                    current.map((entry, i) =>
                      i === idx ? { ...entry, name: e.target.value } : entry,
                    ),
                  )
                }
              />
              <button
                onClick={() => setParts((current) => current.filter((_, i) => i !== idx))}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50 hover:text-red-200"
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            <Field label="Chord line">
              <input
                className={`${inputCls} font-mono`}
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
                className={`${inputCls} min-h-24 font-mono`}
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
        onClick={() => void saveSong()}
        disabled={saving}
        className="w-full rounded-xl bg-amber-glow py-3 font-bold text-stage-black disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}
