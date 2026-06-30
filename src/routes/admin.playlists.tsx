import { createFileRoute, Link } from "@tanstack/react-router";
import { PaginationBar } from "@/components/PaginationBar";
import { api, API_ENABLED } from "@/lib/api";
import type { PlaylistItem } from "@/lib/mock-data";
import { useData } from "@/lib/store";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { normalizeEvent, normalizeGroup, normalizeSong } from "@/lib/view-models";
import { Field, Modal, inputCls } from "./groups";
import { Copy, Edit3, GripVertical, Plus, Radio, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/admin/playlists")({
  component: AdminPlaylists,
});

type ViewGroup = ReturnType<typeof normalizeGroup>;
type ViewEvent = ReturnType<typeof normalizeEvent>;
type ViewSong = ReturnType<typeof normalizeSong>;
type ViewPlaylist = ViewEvent["playlists"][number];
type ViewPlaylistItem = ViewPlaylist["items"][number];
type ArrangementSection = NonNullable<ViewPlaylistItem["arrangement"]>[number];

function createSectionId() {
  return `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function cloneArrangement(arrangement: ArrangementSection[] = []) {
  return arrangement.map((section) => ({
    sectionId: section.sectionId || createSectionId(),
    name: section.name,
    sourcePartName: section.sourcePartName || section.name,
    lines: (section.lines || []).map((line) => ({
      type: line.type || "lyric_only",
      chordLine: line.chordLine || "",
      lyricLine: line.lyricLine || "",
    })),
  }));
}

function buildArrangementFromSong(song: ViewSong, partName: string) {
  const parts =
    partName === "Full Song"
      ? song.parts
      : song.parts.filter(
          (part) => part.name.trim().toLowerCase() === partName.trim().toLowerCase(),
        );

  return parts.map((part, index) => ({
    sectionId: `${song.id}-${part.name}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    name: part.name,
    sourcePartName: part.name,
    lines: (part.lines || []).map((line) => ({
      type: line.type || "lyric_only",
      chordLine: line.chordLine || "",
      lyricLine: line.lyricLine || "",
    })),
  }));
}

function stringifyArrangementPreview(section: ArrangementSection) {
  return (section.lines || [])
    .slice(0, 2)
    .map((line) => line.lyricLine || line.chordLine || "")
    .filter(Boolean)
    .join(" · ");
}

function AdminPlaylists() {
  const local = useData();
  const [groups, setGroups] = useState<ViewGroup[]>([]);
  const [events, setEvents] = useState<ViewEvent[]>([]);
  const [songsById, setSongsById] = useState<Record<string, ViewSong>>({});
  const [loading, setLoading] = useState(API_ENABLED);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [arrangementDraft, setArrangementDraft] = useState<ArrangementSection[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [playlistForm, setPlaylistForm] = useState({ name: "", description: "" });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [songQ, setSongQ] = useState("");
  const [songPage, setSongPage] = useState(1);
  const [songPages, setSongPages] = useState(1);
  const [songTotal, setSongTotal] = useState(0);
  const [songLoading, setSongLoading] = useState(false);
  const [librarySongs, setLibrarySongs] = useState<ViewSong[]>([]);
  const [selectedSong, setSelectedSong] = useState<ViewSong | null>(null);
  const [selectedPart, setSelectedPart] = useState("Full Song");
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const debouncedSongQ = useDebouncedValue(songQ, 250);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId],
  );
  const selectedPlaylist = useMemo(
    () => selectedEvent?.playlists.find((playlist) => playlist.id === selectedPlaylistId) || null,
    [selectedEvent, selectedPlaylistId],
  );
  const selectedItem = useMemo(
    () => selectedPlaylist?.items.find((item) => item.id === selectedItemId) || null,
    [selectedItemId, selectedPlaylist],
  );
  const selectedItemSong = selectedItem ? songsById[String(selectedItem.songId)] : null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) {
        const nextGroups = local.groups.map(normalizeGroup);
        const nextEvents = local.events.map(normalizeEvent);
        if (cancelled) return;
        setGroups(nextGroups);
        setEvents(nextEvents);
        setSelectedEventId(nextEvents[0]?.id || "");
        setSelectedPlaylistId(nextEvents[0]?.playlists[0]?.id || "");
        setSelectedItemId(nextEvents[0]?.playlists[0]?.items[0]?.id || "");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const groupRes = await api.listGroups();
        if (cancelled) return;
        const nextGroups = (groupRes.groups || []).map(normalizeGroup);
        setGroups(nextGroups);

        const eventResponses = await Promise.all(
          nextGroups.map(async (group) => {
            const res = await api.listEvents(group.id);
            return (res.events || []).map(normalizeEvent);
          }),
        );
        if (cancelled) return;
        const nextEvents = eventResponses.flat();
        setEvents(nextEvents);
        setSelectedEventId((current) => current || nextEvents[0]?.id || "");
        setSelectedPlaylistId((current) => current || nextEvents[0]?.playlists[0]?.id || "");
        setSelectedItemId((current) => current || nextEvents[0]?.playlists[0]?.items[0]?.id || "");
      } catch (error) {
        if (cancelled) return;
        setNotice(error instanceof Error ? error.message : "Failed to load playlists");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [local.events, local.groups]);

  useEffect(() => {
    if (!selectedEvent) return;
    setSelectedPlaylistId((current) => current || selectedEvent.playlists[0]?.id || "");
  }, [selectedEvent]);

  useEffect(() => {
    if (!selectedPlaylist) return;
    setSelectedItemId((current) => current || selectedPlaylist.items[0]?.id || "");
  }, [selectedPlaylist]);

  useEffect(() => {
    if (!selectedItem) {
      setArrangementDraft([]);
      return;
    }
    setArrangementDraft(cloneArrangement(selectedItem.arrangement || []));
  }, [selectedItem]);

  useEffect(() => {
    let cancelled = false;

    async function loadEventSongs() {
      const songIds = Array.from(
        new Set(
          events.flatMap((event) =>
            event.playlists.flatMap((playlist) =>
              playlist.items.map((item) => String(item.songId)).filter(Boolean),
            ),
          ),
        ),
      );

      if (!songIds.length || !API_ENABLED) return;

      try {
        const res = await api.getSongsByIds(songIds);
        if (cancelled) return;
        const nextSongs = Object.fromEntries(
          (res.songs || []).map((song) => {
            const normalized = normalizeSong(song);
            return [normalized.id, normalized];
          }),
        );
        setSongsById((current) => ({ ...current, ...nextSongs }));
      } catch {
        if (cancelled) return;
      }
    }

    void loadEventSongs();
    return () => {
      cancelled = true;
    };
  }, [events]);

  useEffect(() => {
    if (!pickerOpen || !API_ENABLED) return;
    let cancelled = false;

    async function loadLibrary() {
      setSongLoading(true);
      try {
        const res = await api.listSongs(
          debouncedSongQ,
          "",
          songPage,
          12,
          {},
          { content: "summary" },
        );
        if (cancelled) return;
        const nextSongs = (res.songs || []).map(normalizeSong);
        setLibrarySongs(nextSongs);
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

    void loadLibrary();
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, debouncedSongQ, songPage]);

  useEffect(() => {
    setSongPage(1);
  }, [debouncedSongQ]);

  const updateEventState = (event: ViewEvent) => {
    setEvents((current) => current.map((entry) => (entry.id === event.id ? event : entry)));
  };

  const openPlaylistCreate = () => {
    setEditingPlaylistId(null);
    setPlaylistForm({ name: "", description: "" });
    setCreateOpen(true);
  };

  const createPlaylist = async () => {
    if (!selectedEvent || !playlistForm.name.trim() || working) return;
    setWorking(true);
    setNotice("");
    try {
      const res = await api.addPlaylist(
        selectedEvent.id,
        playlistForm.name,
        playlistForm.description,
      );
      const nextEvent = normalizeEvent(res.event);
      updateEventState(nextEvent);
      const nextPlaylist = nextEvent.playlists[nextEvent.playlists.length - 1];
      setSelectedPlaylistId(nextPlaylist?.id || "");
      setSelectedItemId("");
      setCreateOpen(false);
      setNotice("Playlist created.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to create playlist");
    } finally {
      setWorking(false);
    }
  };

  const savePlaylist = async () => {
    if (!selectedEvent || !editingPlaylistId || !playlistForm.name.trim() || working) return;
    setWorking(true);
    setNotice("");
    try {
      const res = await api.updatePlaylist(selectedEvent.id, editingPlaylistId, playlistForm);
      const nextEvent = normalizeEvent(res.event);
      updateEventState(nextEvent);
      setEditingPlaylistId(null);
      setNotice("Playlist updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to update playlist");
    } finally {
      setWorking(false);
    }
  };

  const removePlaylist = async (playlistId: string) => {
    if (!selectedEvent || working) return;
    setWorking(true);
    setNotice("");
    try {
      const res = await api.deletePlaylist(selectedEvent.id, playlistId);
      const nextEvent = normalizeEvent(res.event);
      updateEventState(nextEvent);
      setSelectedPlaylistId(nextEvent.playlists[0]?.id || "");
      setSelectedItemId(nextEvent.playlists[0]?.items[0]?.id || "");
      setNotice("Playlist deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to delete playlist");
    } finally {
      setWorking(false);
    }
  };

  const loadSongDetail = async (songId: string) => {
    const existing = songsById[songId];
    if (existing?.parts.length) {
      setSelectedSong(existing);
      setSelectedPart(existing.parts[0]?.name || "Full Song");
      return;
    }

    try {
      const res = await api.getSong(songId);
      const nextSong = normalizeSong(res.song);
      setSongsById((current) => ({ ...current, [nextSong.id]: nextSong }));
      setSelectedSong(nextSong);
      setSelectedPart(nextSong.parts[0]?.name || "Full Song");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to load song details");
    }
  };

  const addSongBlock = async () => {
    if (!selectedEvent || !selectedPlaylist || !selectedSong || working) return;
    setWorking(true);
    setNotice("");
    try {
      const arrangement = buildArrangementFromSong(selectedSong, selectedPart);
      const res = await api.addPlaylistItem(
        selectedEvent.id,
        selectedPlaylist.id,
        selectedSong.id,
        selectedPart === "Full Song" ? undefined : selectedPart,
        arrangement as unknown as Record<string, unknown>[],
        0,
      );
      const nextEvent = normalizeEvent(res.event);
      updateEventState(nextEvent);
      const nextPlaylist = nextEvent.playlists.find(
        (playlist) => playlist.id === selectedPlaylist.id,
      );
      const nextItem = nextPlaylist?.items[nextPlaylist.items.length - 1];
      setSelectedItemId(nextItem?.id || "");
      setPickerOpen(false);
      setSelectedSong(null);
      setSelectedPart("Full Song");
      setNotice("Song block loaded onto canvas.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to add song block");
    } finally {
      setWorking(false);
    }
  };

  const duplicateSongBlock = async (item: ViewPlaylistItem) => {
    if (!selectedEvent || !selectedPlaylist || working) return;
    setWorking(true);
    setNotice("");
    try {
      const res = await api.addPlaylistItem(
        selectedEvent.id,
        selectedPlaylist.id,
        String(item.songId),
        item.partName,
        cloneArrangement(item.arrangement || []) as unknown as Record<string, unknown>[],
        item.transpose || 0,
      );
      const nextEvent = normalizeEvent(res.event);
      updateEventState(nextEvent);
      setNotice("Song block duplicated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to duplicate song block");
    } finally {
      setWorking(false);
    }
  };

  const removeSongBlock = async (itemId: string) => {
    if (!selectedEvent || !selectedPlaylist || working) return;
    setWorking(true);
    setNotice("");
    try {
      const res = await api.removePlaylistItem(selectedEvent.id, selectedPlaylist.id, itemId);
      const nextEvent = normalizeEvent(res.event);
      updateEventState(nextEvent);
      const nextPlaylist = nextEvent.playlists.find(
        (playlist) => playlist.id === selectedPlaylist.id,
      );
      setSelectedItemId(nextPlaylist?.items[0]?.id || "");
      setNotice("Song block removed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to remove song block");
    } finally {
      setWorking(false);
    }
  };

  const moveBlock = async (from: number, to: number) => {
    if (!selectedEvent || !selectedPlaylist || working || from === to) return;
    setWorking(true);
    setNotice("");
    try {
      const res = await api.reorderPlaylist(selectedEvent.id, selectedPlaylist.id, from, to);
      const nextEvent = normalizeEvent(res.event);
      updateEventState(nextEvent);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to reorder song blocks");
    } finally {
      setWorking(false);
    }
  };

  const saveArrangement = async (nextArrangement = arrangementDraft) => {
    if (!selectedEvent || !selectedPlaylist || !selectedItem || working) return;
    setWorking(true);
    setNotice("");
    try {
      const res = await api.updatePlaylistItem(
        selectedEvent.id,
        selectedPlaylist.id,
        selectedItem.id,
        {
          arrangement: nextArrangement,
        },
      );
      const nextEvent = normalizeEvent(res.event);
      updateEventState(nextEvent);
      setNotice("Arrangement saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to save arrangement");
    } finally {
      setWorking(false);
    }
  };

  const addBlankSection = () => {
    setArrangementDraft((current) => [
      ...current,
      {
        sectionId: createSectionId(),
        name: `Section ${current.length + 1}`,
        sourcePartName: "Custom",
        lines: [{ type: "chord_lyric", chordLine: "", lyricLine: "" }],
      },
    ]);
  };

  const updateSection = (
    sectionId: string,
    updater: (section: ArrangementSection) => ArrangementSection,
  ) => {
    setArrangementDraft((current) =>
      current.map((section) => (section.sectionId === sectionId ? updater(section) : section)),
    );
  };

  const removeSection = (sectionId: string) => {
    setArrangementDraft((current) => current.filter((section) => section.sectionId !== sectionId));
  };

  const duplicateSection = (sectionId: string) => {
    setArrangementDraft((current) => {
      const index = current.findIndex((section) => section.sectionId === sectionId);
      if (index < 0) return current;
      const clone = cloneArrangement([current[index]])[0];
      clone.sectionId = createSectionId();
      const next = [...current];
      next.splice(index + 1, 0, clone);
      return next;
    });
  };

  const moveSection = (sectionId: string, direction: -1 | 1) => {
    setArrangementDraft((current) => {
      const index = current.findIndex((section) => section.sectionId === sectionId);
      if (index < 0) return current;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      const [section] = next.splice(index, 1);
      next.splice(targetIndex, 0, section);
      return next;
    });
  };

  const updateSongBlockTranspose = async (nextTranspose: number) => {
    if (!selectedEvent || !selectedPlaylist || !selectedItem || working) return;
    setWorking(true);
    setNotice("");
    try {
      const res = await api.updatePlaylistItem(
        selectedEvent.id,
        selectedPlaylist.id,
        selectedItem.id,
        {
          transpose: nextTranspose,
        },
      );
      const nextEvent = normalizeEvent(res.event);
      updateEventState(nextEvent);
      setNotice("Song transpose updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to update transpose");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black sm:text-4xl">Playlist Pro</h1>
          <p className="text-sm text-white/40">
            Empty canvas, load songs, then arrange each song section by section.
          </p>
        </div>
        {selectedEvent && (
          <button
            onClick={openPlaylistCreate}
            className="rounded-full bg-amber-glow px-4 py-2 text-sm font-bold text-stage-black"
          >
            <Plus className="mr-1 inline size-4" />
            New playlist
          </button>
        )}
      </div>

      {notice && <p className="text-xs text-amber-glow">{notice}</p>}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="glass-card space-y-4 rounded-2xl p-4">
          <Field label="Event">
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                const nextEvent = events.find((entry) => entry.id === e.target.value);
                setSelectedPlaylistId(nextEvent?.playlists[0]?.id || "");
                setSelectedItemId(nextEvent?.playlists[0]?.items[0]?.id || "");
              }}
              className={inputCls}
            >
              <option value="">Select event</option>
              {events.map((event) => {
                const group = groups.find((entry) => entry.id === event.groupId);
                return (
                  <option key={event.id} value={event.id}>
                    {event.name} · {group?.name || "Group"}
                  </option>
                );
              })}
            </select>
          </Field>

          {selectedEvent ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Selected Event</p>
                <h3 className="mt-2 text-lg font-black">{selectedEvent.name}</h3>
                <p className="mt-1 text-sm text-white/45">
                  {selectedEvent.description || "No description"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/events/$eventId"
                    params={{ eventId: selectedEvent.publicId || selectedEvent.id }}
                    className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold"
                  >
                    Open event
                  </Link>
                  <Link
                    to="/live/$eventId"
                    params={{ eventId: selectedEvent.publicId || selectedEvent.id }}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold"
                  >
                    <Radio className="mr-1 inline size-3.5" />
                    Stage
                  </Link>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black">Playlists</h3>
                  <button
                    onClick={openPlaylistCreate}
                    className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-white/70"
                  >
                    <Plus className="mr-1 inline size-3.5" />
                    Add
                  </button>
                </div>
                {selectedEvent.playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => {
                      setSelectedPlaylistId(playlist.id);
                      setSelectedItemId(playlist.items[0]?.id || "");
                    }}
                    className={`w-full rounded-2xl border p-3 text-left ${
                      selectedPlaylistId === playlist.id
                        ? "border-amber-glow/40 bg-amber-glow/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{playlist.name}</p>
                        <p className="mt-1 text-xs text-white/45">
                          {playlist.description || "No description"}
                        </p>
                      </div>
                      <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-bold text-white/60">
                        {playlist.items.length}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-white/45">
              {loading ? "Loading events..." : "No event selected."}
            </p>
          )}
        </aside>

        <section className="space-y-4">
          {selectedPlaylist ? (
            <>
              <div className="glass-card rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-black">{selectedPlaylist.name}</h2>
                    <p className="mt-1 text-sm text-white/45">
                      {selectedPlaylist.description || "No description"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setEditingPlaylistId(selectedPlaylist.id);
                        setPlaylistForm({
                          name: selectedPlaylist.name,
                          description: selectedPlaylist.description,
                        });
                      }}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70"
                    >
                      <Edit3 className="mr-1 inline size-3.5" />
                      Rename
                    </button>
                    <button
                      onClick={() => setPickerOpen(true)}
                      className="rounded-xl bg-amber-glow px-3 py-2 text-xs font-bold text-stage-black"
                    >
                      <Plus className="mr-1 inline size-3.5" />
                      Load song
                    </button>
                    <button
                      onClick={() => void removePlaylist(selectedPlaylist.id)}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200"
                    >
                      <Trash2 className="mr-1 inline size-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 2xl:grid-cols-[380px_minmax(0,1fr)]">
                <div className="glass-card rounded-2xl p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black">Canvas</h3>
                      <p className="text-sm text-white/40">
                        Start from empty. Every block is one loaded song with its own section flow.
                      </p>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-white/60">
                      {selectedPlaylist.items.length} blocks
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedPlaylist.items.map((item, index) => {
                      const song = songsById[String(item.songId)];
                      return (
                        <button
                          key={item.id}
                          draggable={!working}
                          onClick={() => setSelectedItemId(item.id)}
                          onDragStart={() => setDragItemId(item.id)}
                          onDragEnd={() => setDragItemId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (!dragItemId || dragItemId === item.id || !selectedPlaylist) return;
                            const from = selectedPlaylist.items.findIndex(
                              (entry) => entry.id === dragItemId,
                            );
                            const to = selectedPlaylist.items.findIndex(
                              (entry) => entry.id === item.id,
                            );
                            if (from >= 0 && to >= 0) {
                              void moveBlock(from, to);
                            }
                            setDragItemId(null);
                          }}
                          className={`w-full rounded-2xl border p-4 text-left ${
                            selectedItemId === item.id
                              ? "border-amber-glow/40 bg-amber-glow/10"
                              : "border-white/10 bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-white/35">
                              <GripVertical className="size-4" />
                              <span className="text-xs font-bold">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                            </div>
                            {song ? (
                              <img
                                src={song.cover}
                                alt={song.title}
                                className="size-12 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="size-12 rounded-xl bg-white/5" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold">
                                {song?.title || item.songId}
                              </p>
                              <p className="truncate text-xs text-white/45">
                                {song?.artist || "Unknown artist"} · {item.partName || "Full Song"}
                              </p>
                              <p className="truncate text-[11px] text-white/35">
                                Transpose {item.transpose && item.transpose > 0 ? "+" : ""}
                                {item.transpose || 0} · {(item.arrangement || []).length} sections ·{" "}
                                {(item.arrangement || []).reduce(
                                  (count, section) => count + (section.lines?.length || 0),
                                  0,
                                )}{" "}
                                lines
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {!selectedPlaylist.items.length ? (
                      <button
                        onClick={() => setPickerOpen(true)}
                        className="w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center text-sm font-bold text-white/40 hover:border-amber-glow/40 hover:text-amber-glow"
                      >
                        Empty canvas. Load your first song block.
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-4">
                  {selectedItem ? (
                    <>
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-amber-glow">
                            Playlist Pro Editor
                          </p>
                          <h3 className="mt-2 text-xl font-black">
                            {selectedItemSong?.title || selectedItem.songId}
                          </h3>
                          <p className="mt-1 text-sm text-white/45">
                            {selectedItemSong?.artist || "Unknown artist"} ·{" "}
                            {selectedItem.partName || "Full Song"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => void duplicateSongBlock(selectedItem)}
                            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70"
                          >
                            <Copy className="mr-1 inline size-3.5" />
                            Duplicate song
                          </button>
                          <button
                            onClick={addBlankSection}
                            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70"
                          >
                            <Plus className="mr-1 inline size-3.5" />
                            Add section
                          </button>
                          <button
                            onClick={() => void saveArrangement()}
                            disabled={working}
                            className="rounded-xl bg-amber-glow px-3 py-2 text-xs font-bold text-stage-black disabled:opacity-50"
                          >
                            <Save className="mr-1 inline size-3.5" />
                            Save arrangement
                          </button>
                          <button
                            onClick={() => void removeSongBlock(selectedItem.id)}
                            className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200"
                          >
                            <Trash2 className="mr-1 inline size-3.5" />
                            Remove song
                          </button>
                        </div>
                      </div>

                      <div className="mb-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                            Song Transpose
                          </p>
                          <p className="mt-2 text-2xl font-black">
                            {selectedItem.transpose && selectedItem.transpose > 0 ? "+" : ""}
                            {selectedItem.transpose || 0}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((step) => (
                            <button
                              key={step}
                              onClick={() => void updateSongBlockTranspose(step)}
                              disabled={working}
                              className={`rounded-lg px-3 py-2 text-sm font-bold transition disabled:opacity-50 ${
                                (selectedItem.transpose || 0) === step
                                  ? "bg-amber-glow text-stage-black"
                                  : "border border-white/10 bg-white/5 text-white/75"
                              }`}
                            >
                              {step > 0 ? `+${step}` : step}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        {arrangementDraft.map((section, sectionIndex) => (
                          <div
                            key={section.sectionId || sectionIndex}
                            className="rounded-2xl border border-white/10 bg-white/5 p-4"
                          >
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <input
                                  value={section.name}
                                  onChange={(e) =>
                                    updateSection(section.sectionId || "", (current) => ({
                                      ...current,
                                      name: e.target.value,
                                    }))
                                  }
                                  className={`${inputCls} font-bold`}
                                />
                                <p className="mt-2 text-xs text-white/35">
                                  {stringifyArrangementPreview(section) || "No lines yet"}
                                </p>
                                <p className="mt-2 text-xs text-white/35">
                                  {(section.lines || []).length} lines inside this section
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => moveSection(section.sectionId || "", -1)}
                                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/65"
                                >
                                  Move up
                                </button>
                                <button
                                  onClick={() => moveSection(section.sectionId || "", 1)}
                                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/65"
                                >
                                  Move down
                                </button>
                                <button
                                  onClick={() => duplicateSection(section.sectionId || "")}
                                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/65"
                                >
                                  Duplicate section
                                </button>
                                <button
                                  onClick={() => removeSection(section.sectionId || "")}
                                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-bold text-red-200"
                                >
                                  Remove section
                                </button>
                              </div>
                            </div>

                            <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
                                Section Preview
                              </p>
                              <div className="mt-3 space-y-2 text-sm text-white/70">
                                {(section.lines || []).slice(0, 6).map((line, lineIndex) => (
                                  <div
                                    key={`${section.sectionId}-${lineIndex}`}
                                    className="rounded-lg bg-white/[0.03] px-3 py-2"
                                  >
                                    {line.chordLine ? (
                                      <p className="whitespace-pre-wrap font-mono text-[12px] text-amber-glow/90">
                                        {line.chordLine}
                                      </p>
                                    ) : null}
                                    <p className="whitespace-pre-wrap text-sm text-white/75">
                                      {line.lyricLine || "Instrumental / empty line"}
                                    </p>
                                  </div>
                                ))}
                                {(section.lines || []).length > 6 ? (
                                  <p className="text-xs text-white/35">
                                    + {(section.lines || []).length - 6} more lines in this section
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}

                        {!arrangementDraft.length ? (
                          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center text-sm font-bold text-white/40">
                            This song block has no sections yet. Add or duplicate sections to start
                            arranging it.
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center text-sm font-bold text-white/40">
                      Select a song block from the canvas to edit its sections.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card rounded-2xl p-8 text-center text-white/45">
              Select an event and playlist to open the Playlist Pro canvas.
            </div>
          )}
        </section>
      </div>

      {createOpen && (
        <Modal title="Create playlist" onClose={() => setCreateOpen(false)}>
          <PlaylistForm
            form={playlistForm}
            setForm={setPlaylistForm}
            saving={working}
            onSubmit={() => void createPlaylist()}
            submitLabel="Create playlist"
          />
        </Modal>
      )}

      {editingPlaylistId && (
        <Modal title="Edit playlist" onClose={() => setEditingPlaylistId(null)}>
          <PlaylistForm
            form={playlistForm}
            setForm={setPlaylistForm}
            saving={working}
            onSubmit={() => void savePlaylist()}
            submitLabel="Save playlist"
          />
        </Modal>
      )}

      {pickerOpen && selectedPlaylist && (
        <Modal title="Load song into canvas" onClose={() => setPickerOpen(false)} mobileFullscreen>
          <div className="space-y-4">
            <Field label="Search songs">
              <input
                value={songQ}
                onChange={(e) => setSongQ(e.target.value)}
                className={inputCls}
                placeholder="Search title, artist, part..."
              />
            </Field>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-white/10 p-2">
              {librarySongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => void loadSongDetail(song.id)}
                  className={`flex w-full items-center gap-3 rounded-xl p-2 text-left ${
                    selectedSong?.id === song.id ? "bg-amber-glow/10" : "hover:bg-white/5"
                  }`}
                >
                  <img
                    src={song.cover}
                    alt={song.title}
                    className="size-12 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{song.title}</p>
                    <p className="truncate text-xs text-white/45">
                      {song.artist} · {song.key}
                    </p>
                  </div>
                </button>
              ))}
              {!librarySongs.length && !songLoading ? (
                <p className="py-6 text-center text-xs text-white/40">No songs found.</p>
              ) : null}
            </div>
            <PaginationBar
              page={songPage}
              pages={songPages}
              onPageChange={setSongPage}
              loading={songLoading}
            />
            <p className="text-[10px] text-white/35">{songTotal} songs matched</p>

            {selectedSong ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedSong.cover}
                    alt={selectedSong.title}
                    className="size-14 rounded-xl object-cover"
                  />
                  <div>
                    <p className="font-bold">{selectedSong.title}</p>
                    <p className="text-xs text-white/45">{selectedSong.artist}</p>
                  </div>
                </div>
                <Field label="Load part">
                  <select
                    value={selectedPart}
                    onChange={(e) => setSelectedPart(e.target.value)}
                    className={inputCls}
                  >
                    <option value="Full Song">Full Song</option>
                    {selectedSong.parts.map((part) => (
                      <option key={part.name} value={part.name}>
                        {part.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  onClick={() => void addSongBlock()}
                  disabled={working}
                  className="w-full rounded-xl bg-amber-glow py-3 font-bold text-stage-black disabled:opacity-50"
                >
                  {working ? "Loading..." : "Load song into canvas"}
                </button>
              </div>
            ) : null}
          </div>
        </Modal>
      )}
    </div>
  );
}

function PlaylistForm({
  form,
  setForm,
  saving,
  onSubmit,
  submitLabel,
}: {
  form: { name: string; description: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; description: string }>>;
  saving: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="space-y-3">
      <Field label="Playlist name">
        <input
          value={form.name}
          onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
          className={inputCls}
        />
      </Field>
      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
          className={`${inputCls} min-h-20`}
        />
      </Field>
      <button
        onClick={onSubmit}
        disabled={!form.name.trim() || saving}
        className="w-full rounded-xl bg-amber-glow py-3 font-bold text-stage-black disabled:opacity-50"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
