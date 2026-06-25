import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PaginationBar } from "@/components/PaginationBar";
import { useData } from "@/lib/store";
import type { Event, Playlist, PlaylistItem, SongPartName } from "@/lib/mock-data";
import { Field, Modal, inputCls } from "./groups";
import { useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, Radio, Trash2, X } from "lucide-react";
import { api, API_ENABLED } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { normalizeEvent, normalizeSong } from "@/lib/view-models";

export const Route = createFileRoute("/events/$eventId")({
  head: () => ({ meta: [{ title: "Event - ChordSync Live" }] }),
  component: EventPage,
});

const PART_OPTIONS: ("Full Song" | SongPartName | string)[] = [
  "Full Song",
  "Intro",
  "Verse 1",
  "Verse",
  "Pre-Chorus",
  "Chorus",
  "Post-Chorus",
  "Verse 2",
  "Bridge",
  "Guitar Solo",
  "Final Chorus",
  "Outro",
];
const KEY_OPTIONS = [
  "",
  "A",
  "Am",
  "B",
  "Bm",
  "Bb",
  "C",
  "Cm",
  "D",
  "Dm",
  "E",
  "Em",
  "F",
  "Fm",
  "G",
  "Gm",
];
const BEAT_OPTIONS = ["", "4/4", "3/4", "6/8", "2/4"];
const SOURCE_OPTIONS = ["", "chordslk"];

type ViewEvent = ReturnType<typeof normalizeEvent>;
type ViewSong = ReturnType<typeof normalizeSong>;
type EventState = Event | ViewEvent;
type PlaylistState = Playlist | ViewEvent["playlists"][number];
type PlaylistItemState = PlaylistItem | ViewEvent["playlists"][number]["items"][number];

function EventPage() {
  const { eventId } = Route.useParams();
  const local = useData();
  const localEvent = local.events.find((e) => e.id === eventId);

  const [eventData, setEventData] = useState<EventState | null>(localEvent || null);
  const [eventSongsData, setEventSongsData] = useState<ViewSong[]>([]);
  const [librarySongs, setLibrarySongs] = useState<ViewSong[]>([]);
  const [loading, setLoading] = useState(API_ENABLED);
  const [error, setError] = useState("");

  const [plOpen, setPlOpen] = useState(false);
  const [plForm, setPlForm] = useState({ name: "", description: "" });
  const [addSongFor, setAddSongFor] = useState<string | null>(null);
  const [songQ, setSongQ] = useState("");
  const [songFilters, setSongFilters] = useState({
    artist: "",
    key: "",
    beat: "",
    source: "",
  });
  const [songPage, setSongPage] = useState(1);
  const [songPages, setSongPages] = useState(1);
  const [songTotal, setSongTotal] = useState(0);
  const [songLoading, setSongLoading] = useState(false);
  const [partChoice, setPartChoice] = useState<(typeof PART_OPTIONS)[number]>("Full Song");
  const [editingPlId, setEditingPlId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ playlistId: string; itemId: string } | null>(null);
  const debouncedSongQ = useDebouncedValue(songQ, 250);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) return;
      setLoading(true);
      setError("");

      try {
        const eventRes = await api.getEvent(eventId);
        if (cancelled) return;
        const normalizedEvent = normalizeEvent(eventRes.event);
        setEventData(normalizedEvent);

        const uniqueSongIds = Array.from(
          new Set(
            normalizedEvent.playlists.flatMap((playlist) =>
              playlist.items.map((item) => String(item.songId)).filter(Boolean),
            ),
          ),
        );
        if (!uniqueSongIds.length) {
          setEventSongsData([]);
          return;
        }

        const songsRes = await api.getSongsByIds(uniqueSongIds);
        if (cancelled) return;
        setEventSongsData((songsRes.songs || []).map(normalizeSong));
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load event data");
        if (localEvent) setEventData(localEvent);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, localEvent]);

  const ev = eventData;
  const songMap = useMemo(
    () => new Map([...eventSongsData, ...librarySongs].map((s) => [s.id, s])),
    [eventSongsData, librarySongs],
  );

  useEffect(() => {
    setSongPage(1);
  }, [
    addSongFor,
    debouncedSongQ,
    songFilters.artist,
    songFilters.beat,
    songFilters.key,
    songFilters.source,
  ]);

  useEffect(() => {
    if (!addSongFor || !API_ENABLED) return;
    let cancelled = false;

    async function loadSongPicker() {
      setSongLoading(true);
      try {
        const res = await api.listSongs(
          debouncedSongQ,
          "",
          songPage,
          12,
          {
            artistName: songFilters.artist,
            key: songFilters.key,
            timeSignature: songFilters.beat,
            source: songFilters.source,
          },
          { sort: "title", content: "summary" },
        );
        if (cancelled) return;
        const normalized = (res.songs || []).map(normalizeSong);
        setLibrarySongs(normalized);
        setSongPage(res.page || 1);
        setSongPages(res.pages || 1);
        setSongTotal(res.total || 0);
      } catch {
        if (cancelled) return;
        setLibrarySongs([]);
      } finally {
        if (!cancelled) setSongLoading(false);
      }
    }

    loadSongPicker();
    return () => {
      cancelled = true;
    };
  }, [
    addSongFor,
    debouncedSongQ,
    songFilters.artist,
    songFilters.beat,
    songFilters.key,
    songFilters.source,
    songPage,
  ]);

  const apiEventId = ev?.id || eventId;

  const addPlaylist = async () => {
    if (!plForm.name || !ev || actionKey) return;
    setActionKey("playlist:create");
    try {
      if (API_ENABLED) {
        const res = await api.addPlaylist(apiEventId, plForm.name, plForm.description);
        setEventData(normalizeEvent(res.event));
      } else {
        local.addPlaylist(ev.id, plForm.name, plForm.description);
        setEventData(local.events.find((e) => e.id === ev.id) || null);
      }

      setPlForm({ name: "", description: "" });
      setPlOpen(false);
    } catch (playlistError: unknown) {
      setError(playlistError instanceof Error ? playlistError.message : "Failed to create playlist");
    } finally {
      setActionKey(null);
    }
  };

  const savePlaylist = async (plId: string) => {
    if (!ev || actionKey) return;
    setActionKey(`playlist:save:${plId}`);
    try {
      if (API_ENABLED) {
        const res = await api.updatePlaylist(apiEventId, plId, editForm);
        setEventData(normalizeEvent(res.event));
      } else {
        local.updatePlaylist(ev.id, plId, editForm);
        setEventData(local.events.find((e) => e.id === ev.id) || null);
      }

      setEditingPlId(null);
    } catch (playlistError: unknown) {
      setError(playlistError instanceof Error ? playlistError.message : "Failed to update playlist");
    } finally {
      setActionKey(null);
    }
  };

  const deletePlaylist = async (plId: string) => {
    if (!ev || actionKey) return;
    setActionKey(`playlist:delete:${plId}`);
    try {
      if (API_ENABLED) {
        const res = await api.deletePlaylist(apiEventId, plId);
        setEventData(normalizeEvent(res.event));
      } else {
        local.deletePlaylist(ev.id, plId);
        setEventData(local.events.find((e) => e.id === ev.id) || null);
      }
    } catch (playlistError: unknown) {
      setError(playlistError instanceof Error ? playlistError.message : "Failed to delete playlist");
    } finally {
      setActionKey(null);
    }
  };

  const addItem = async (plId: string, songId: string) => {
    if (!ev || actionKey) return;
    setActionKey(`item:add:${plId}:${songId}`);
    try {
      if (API_ENABLED) {
        const res = await api.addPlaylistItem(apiEventId, plId, songId, partChoice);
        setEventData(normalizeEvent(res.event));
      } else {
        local.addPlaylistItem(ev.id, plId, {
          songId,
          partName: partChoice as PlaylistItem["partName"],
        });
        setEventData(local.events.find((e) => e.id === ev.id) || null);
      }

      setAddSongFor(null);
    } catch (playlistError: unknown) {
      setError(playlistError instanceof Error ? playlistError.message : "Failed to add playlist item");
    } finally {
      setActionKey(null);
    }
  };

  const removeItem = async (plId: string, itemId: string) => {
    if (!ev || actionKey) return;
    setActionKey(`item:remove:${itemId}`);
    try {
      if (API_ENABLED) {
        const res = await api.removePlaylistItem(apiEventId, plId, itemId);
        setEventData(normalizeEvent(res.event));
      } else {
        local.removePlaylistItem(ev.id, plId, itemId);
        setEventData(local.events.find((e) => e.id === ev.id) || null);
      }
    } catch (playlistError: unknown) {
      setError(playlistError instanceof Error ? playlistError.message : "Failed to remove playlist item");
    } finally {
      setActionKey(null);
    }
  };

  const moveItem = async (plId: string, from: number, to: number) => {
    if (!ev || actionKey || from === to) return;
    setActionKey(`item:move:${plId}`);
    try {
      if (API_ENABLED) {
        const res = await api.reorderPlaylist(apiEventId, plId, from, to);
        setEventData(normalizeEvent(res.event));
      } else {
        local.reorderPlaylist(ev.id, plId, from, to);
        setEventData(local.events.find((e) => e.id === ev.id) || null);
      }
    } catch (playlistError: unknown) {
      setError(playlistError instanceof Error ? playlistError.message : "Failed to reorder playlist");
    } finally {
      setActionKey(null);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-white/60">Loading event...</div>
      </AppShell>
    );
  }

  if (!ev) {
    return (
      <AppShell>
        <div className="p-8 text-center text-white/60">
          Event not found.{error && <div className="mt-2 text-xs text-red-300">{error}</div>}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="relative">
        <div className="aspect-[3/1] sm:aspect-[5/1] relative overflow-hidden">
          <img src={ev.image} alt={ev.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-stage-black via-stage-black/40 to-transparent" />
        </div>
        <div className="max-w-5xl mx-auto px-4 -mt-20 sm:-mt-24 relative">
          <h1 className="text-4xl sm:text-5xl font-black">{ev.name}</h1>
          <p className="text-white/60 mt-2 max-w-prose">{ev.description}</p>
          {error && (
            <p className="mt-2 text-xs text-amber-glow">
              Using local data because API failed: {error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/50">
            <span>
              {new Date(ev.date).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}
            </span>
            <span>• {ev.duration} min</span>
          </div>
          <div className="mt-4 flex gap-3 flex-wrap">
            <Link
              to="/live/$eventId"
              params={{ eventId: ev.publicId || eventId }}
              className="px-5 py-2.5 rounded-full bg-amber-glow text-stage-black font-bold text-sm flex items-center gap-2 glow-amber hover:scale-105 transition-transform"
            >
              <Radio className="size-4" /> Start stage mode
            </Link>
            <button
              onClick={() => setPlOpen(true)}
              className="px-5 py-2.5 rounded-full border border-white/15 text-sm font-bold hover:bg-white/5"
            >
              <Plus className="inline size-4 mr-1" /> New playlist
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {ev.playlists.length === 0 && (
          <div className="glass-card rounded-2xl p-8 text-center text-white/50">
            No playlists yet. Create one to start building this setlist.
          </div>
        )}
        {ev.playlists.map((pl: PlaylistState) => (
          <div key={pl.id} className="glass-card rounded-2xl p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0 flex-1">
                {editingPlId === pl.id ? (
                  <div className="space-y-2">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputCls}
                    />
                    <input
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      className={inputCls}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => savePlaylist(pl.id)}
                        disabled={actionKey === `playlist:save:${pl.id}`}
                        className="px-3 py-1 rounded-md bg-amber-glow text-stage-black text-xs font-bold"
                      >
                        {actionKey === `playlist:save:${pl.id}` ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingPlId(null)}
                        className="px-3 py-1 rounded-md bg-white/5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="text-xl font-black truncate">{pl.name}</h3>
                    <p className="text-xs text-white/50">{pl.description}</p>
                  </>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => {
                    setEditingPlId(pl.id);
                    setEditForm({ name: pl.name, description: pl.description });
                  }}
                  className="text-[10px] uppercase tracking-widest text-white/40 px-2 py-1 hover:text-white"
                >
                  Edit
                </button>
                <button
                  onClick={() => deletePlaylist(pl.id)}
                  disabled={actionKey === `playlist:delete:${pl.id}`}
                  className="size-8 rounded-md hover:bg-destructive/20 hover:text-destructive flex items-center justify-center"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {pl.items.map((item: PlaylistItemState, idx: number) => {
                const s = songMap.get(item.songId);
                if (!s) {
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white/40"
                    >
                      Missing song: {item.songId}
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    draggable={!actionKey}
                    onDragStart={() => setDragState({ playlistId: pl.id, itemId: item.id })}
                    onDragEnd={() => setDragState(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!dragState || dragState.playlistId !== pl.id || dragState.itemId === item.id) {
                        return;
                      }
                      const from = pl.items.findIndex((entry) => entry.id === dragState.itemId);
                      const to = pl.items.findIndex((entry) => entry.id === item.id);
                      if (from >= 0 && to >= 0) {
                        void moveItem(pl.id, from, to);
                      }
                      setDragState(null);
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border group transition-colors ${
                      dragState?.itemId === item.id
                        ? "bg-amber-glow/10 border-amber-glow/30"
                        : "bg-white/5 border-white/5"
                    }`}
                  >
                    <div className="flex flex-col">
                      <button
                        onClick={() => idx > 0 && moveItem(pl.id, idx, idx - 1)}
                        disabled={idx === 0 || actionKey === `item:move:${pl.id}`}
                        className="text-white/30 hover:text-amber-glow disabled:opacity-20 text-xs"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => idx < pl.items.length - 1 && moveItem(pl.id, idx, idx + 1)}
                        disabled={idx === pl.items.length - 1 || actionKey === `item:move:${pl.id}`}
                        className="text-white/30 hover:text-amber-glow disabled:opacity-20 text-xs"
                      >
                        ▼
                      </button>
                    </div>
                    <GripVertical className="size-3.5 text-white/20" />
                    <img src={s.cover} alt={s.title} className="size-10 rounded-md object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{s.title}</p>
                      <p className="text-[10px] text-white/40 truncate">
                        {s.artist} • {item.partName ?? "Full Song"}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(pl.id, item.id)}
                      disabled={actionKey === `item:remove:${item.id}`}
                      className="size-8 rounded-md hover:bg-destructive/20 hover:text-destructive flex items-center justify-center"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => {
                  setSongQ("");
                  setSongFilters({ artist: "", key: "", beat: "", source: "" });
                  setSongPage(1);
                  setAddSongFor(pl.id);
                }}
                disabled={Boolean(actionKey)}
                className="w-full py-3 border border-dashed border-white/15 rounded-xl text-xs font-bold text-white/40 hover:text-amber-glow hover:border-amber-glow/40 transition-all disabled:opacity-50"
              >
                + Add song or part
              </button>
              <p className="text-[10px] text-white/35">
                Drag and drop to reorder, or use the move buttons for exact placement.
              </p>
            </div>
          </div>
        ))}
      </div>

      {plOpen && (
        <Modal title="New playlist" onClose={() => setPlOpen(false)}>
          <div className="space-y-3">
            <Field label="Name">
              <input
                value={plForm.name}
                onChange={(e) => setPlForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Description">
              <input
                value={plForm.description}
                onChange={(e) => setPlForm((f) => ({ ...f, description: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <button
              onClick={addPlaylist}
              disabled={!plForm.name || actionKey === "playlist:create"}
              className="w-full py-3 rounded-xl bg-amber-glow text-stage-black font-bold disabled:opacity-50"
            >
              {actionKey === "playlist:create" ? "Creating..." : "Create"}
            </button>
          </div>
        </Modal>
      )}

      {addSongFor && (
        <Modal title="Add song or section" onClose={() => setAddSongFor(null)}>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={songQ}
              onChange={(e) => setSongQ(e.target.value)}
              placeholder="Search song..."
              className={inputCls}
            />
            <select
              value={partChoice}
              onChange={(e) => setPartChoice(e.target.value)}
              className={inputCls + " w-40 shrink-0"}
            >
              {PART_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <input
              value={songFilters.artist}
              onChange={(e) =>
                setSongFilters((current) => ({ ...current, artist: e.target.value }))
              }
              placeholder="Artist name"
              className={inputCls}
            />
            <select
              value={songFilters.key}
              onChange={(e) => setSongFilters((current) => ({ ...current, key: e.target.value }))}
              className={inputCls}
            >
              <option value="">Key</option>
              {KEY_OPTIONS.filter(Boolean).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
            <select
              value={songFilters.beat}
              onChange={(e) => setSongFilters((current) => ({ ...current, beat: e.target.value }))}
              className={inputCls}
            >
              <option value="">Beat</option>
              {BEAT_OPTIONS.filter(Boolean).map((beat) => (
                <option key={beat} value={beat}>
                  {beat}
                </option>
              ))}
            </select>
            <select
              value={songFilters.source}
              onChange={(e) =>
                setSongFilters((current) => ({ ...current, source: e.target.value }))
              }
              className={inputCls}
            >
              <option value="">Source</option>
              {SOURCE_OPTIONS.filter(Boolean).map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1.5">
            {songLoading && <p className="py-3 text-xs text-white/50">Loading songs...</p>}
            {librarySongs.map((s) => (
              <button
                key={s.id}
                onClick={() => addItem(addSongFor, s.id)}
                disabled={Boolean(actionKey)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left disabled:opacity-60"
              >
                <img src={s.cover} alt={s.title} className="size-10 rounded-md object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{s.title}</p>
                  <p className="text-[10px] text-white/40 truncate">
                    {s.artist} • {s.key}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-amber-glow">
                  {actionKey === `item:add:${addSongFor}:${s.id}` ? "ADDING..." : "ADD"}
                </span>
              </button>
            ))}
            {!librarySongs.length && !songLoading && (
              <p className="py-6 text-center text-xs text-white/40">No songs found.</p>
            )}
          </div>
          <div className="mt-3">
            <PaginationBar
              page={songPage}
              pages={songPages}
              onPageChange={setSongPage}
              loading={songLoading}
            />
          </div>
          <p className="mt-2 text-[10px] text-white/35">{songTotal} songs matched</p>
        </Modal>
      )}
    </AppShell>
  );
}
