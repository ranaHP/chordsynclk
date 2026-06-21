import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Field, inputCls } from "../routes/groups";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { buildSongPayload } from "@/lib/song-admin";

export const Route = createFileRoute("/admin/songs/new")({
  component: NewSong,
});

const PART_NAMES = [
  "Intro",
  "Verse 1",
  "Pre-Chorus",
  "Chorus",
  "Post-Chorus",
  "Verse 2",
  "Bridge",
  "Guitar Solo",
  "Final Chorus",
  "Outro",
];

function NewSong() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState({
    title: "",
    artist: "",
    description: "",
    tempo: "100",
    vibe: "Uplifting",
    genre: "Rock",
    year: "2024",
    language: "English",
    difficulty: "Medium",
    capo: "None",
    key: "G",
    tags: "",
    cover: "",
  });
  const [parts, setParts] = useState(PART_NAMES.map((name) => ({ name, chords: "", lyrics: "" })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const saveSong = async () => {
    if (!meta.title || !meta.artist) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.createSong(buildSongPayload(meta, parts));
      navigate({ to: "/admin/songs/$songId", params: { songId: String(res.song.songId || "") } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save song");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl">
      <Link
        to="/admin/songs"
        className="text-xs text-white/50 hover:text-amber-glow inline-flex items-center gap-1"
      >
        <ChevronLeft className="size-3.5" /> Songs
      </Link>
      <h1 className="text-3xl font-black">Add a new song</h1>

      <section className="glass-card rounded-2xl p-5 space-y-3">
        <h3 className="font-black mb-2">Metadata</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Title">
            <input
              className={inputCls}
              value={meta.title}
              onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
            />
          </Field>
          <Field label="Artist">
            <input
              className={inputCls}
              value={meta.artist}
              onChange={(e) => setMeta((m) => ({ ...m, artist: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            className={`${inputCls} min-h-20`}
            value={meta.description}
            onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Tempo">
            <input
              className={inputCls}
              value={meta.tempo}
              onChange={(e) => setMeta((m) => ({ ...m, tempo: e.target.value }))}
            />
          </Field>
          <Field label="Vibe">
            <input
              className={inputCls}
              value={meta.vibe}
              onChange={(e) => setMeta((m) => ({ ...m, vibe: e.target.value }))}
            />
          </Field>
          <Field label="Genre">
            <input
              className={inputCls}
              value={meta.genre}
              onChange={(e) => setMeta((m) => ({ ...m, genre: e.target.value }))}
            />
          </Field>
          <Field label="Year">
            <input
              className={inputCls}
              value={meta.year}
              onChange={(e) => setMeta((m) => ({ ...m, year: e.target.value }))}
            />
          </Field>
          <Field label="Language">
            <input
              className={inputCls}
              value={meta.language}
              onChange={(e) => setMeta((m) => ({ ...m, language: e.target.value }))}
            />
          </Field>
          <Field label="Difficulty">
            <input
              className={inputCls}
              value={meta.difficulty}
              onChange={(e) => setMeta((m) => ({ ...m, difficulty: e.target.value }))}
            />
          </Field>
          <Field label="Capo">
            <input
              className={inputCls}
              value={meta.capo}
              onChange={(e) => setMeta((m) => ({ ...m, capo: e.target.value }))}
            />
          </Field>
          <Field label="Key">
            <input
              className={inputCls}
              value={meta.key}
              onChange={(e) => setMeta((m) => ({ ...m, key: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Tags (comma separated)">
          <input
            className={inputCls}
            value={meta.tags}
            onChange={(e) => setMeta((m) => ({ ...m, tags: e.target.value }))}
          />
        </Field>
        <Field label="Cover URL">
          <input
            className={inputCls}
            value={meta.cover}
            onChange={(e) => setMeta((m) => ({ ...m, cover: e.target.value }))}
            placeholder="https://..."
          />
        </Field>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black">Song parts</h3>
          <button
            onClick={() => setParts((p) => [...p, { name: "New Part", chords: "", lyrics: "" }])}
            className="text-xs font-bold text-amber-glow flex items-center gap-1"
          >
            <Plus className="size-3.5" /> Add part
          </button>
        </div>
        {parts.map((p, idx) => (
          <div key={idx} className="glass-card rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <input
                className={inputCls + " font-bold"}
                value={p.name}
                onChange={(e) =>
                  setParts((arr) =>
                    arr.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                  )
                }
              />
              <button
                onClick={() => setParts((arr) => arr.filter((_, i) => i !== idx))}
                className="size-9 rounded-md hover:bg-destructive/20 hover:text-destructive flex items-center justify-center"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <Field label="Chord line">
              <input
                className={inputCls + " font-mono"}
                value={p.chords}
                onChange={(e) =>
                  setParts((arr) =>
                    arr.map((x, i) => (i === idx ? { ...x, chords: e.target.value } : x)),
                  )
                }
                placeholder="G   Cmaj7   Em7   D"
              />
            </Field>
            <Field label="Lyrics">
              <textarea
                className={`${inputCls} font-mono min-h-24`}
                value={p.lyrics}
                onChange={(e) =>
                  setParts((arr) =>
                    arr.map((x, i) => (i === idx ? { ...x, lyrics: e.target.value } : x)),
                  )
                }
              />
            </Field>
          </div>
        ))}
      </section>

      {error && <p className="text-xs text-amber-glow">{error}</p>}
      <div className="flex gap-2 sticky bottom-4 glass-card rounded-2xl p-3">
        <button
          onClick={saveSong}
          disabled={saving || !meta.title || !meta.artist}
          className="flex-1 py-3 rounded-xl bg-amber-glow text-stage-black font-bold disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save song"}
        </button>
        <Link to="/admin/songs" className="px-4 py-3 rounded-xl border border-white/15 text-sm">
          Cancel
        </Link>
      </div>
    </div>
  );
}
