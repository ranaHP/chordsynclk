import { createFileRoute, Link } from "@tanstack/react-router";
import { api, API_ENABLED } from "@/lib/api";
import { useData } from "@/lib/store";
import { normalizeEvent, normalizeGroup } from "@/lib/view-models";
import { Field, Modal, inputCls } from "./groups";
import { Edit3, Plus, Radio, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/admin/events")({
  component: AdminEvents,
});

type ViewGroup = ReturnType<typeof normalizeGroup>;
type ViewEvent = ReturnType<typeof normalizeEvent>;

function AdminEvents() {
  const local = useData();
  const [groups, setGroups] = useState<ViewGroup[]>([]);
  const [events, setEvents] = useState<ViewEvent[]>([]);
  const [loading, setLoading] = useState(API_ENABLED);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ViewEvent | null>(null);
  const [form, setForm] = useState({
    groupId: "",
    name: "",
    description: "",
    image: "",
    date: "",
    duration: 90,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) {
        const nextGroups = local.groups.map(normalizeGroup);
        const nextEvents = local.events.map(normalizeEvent);
        setGroups(nextGroups);
        setEvents(nextEvents);
        setSelectedGroupId(nextGroups[0]?.id || "");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const groupRes = await api.listGroups();
        if (cancelled) return;
        const nextGroups = (groupRes.groups || []).map(normalizeGroup);
        setGroups(nextGroups);
        setSelectedGroupId((current) => current || nextGroups[0]?.id || "");

        const eventResponses = await Promise.all(
          nextGroups.map(async (group) => {
            const res = await api.listEvents(group.id);
            return (res.events || []).map(normalizeEvent);
          }),
        );
        if (cancelled) return;
        setEvents(eventResponses.flat());
      } catch (error) {
        if (cancelled) return;
        setNotice(error instanceof Error ? error.message : "Failed to load events");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [local.events, local.groups]);

  const visibleEvents = useMemo(
    () => (selectedGroupId ? events.filter((event) => event.groupId === selectedGroupId) : events),
    [events, selectedGroupId],
  );

  const startCreate = () => {
    setEditingEvent(null);
    setForm({
      groupId: selectedGroupId || groups[0]?.id || "",
      name: "",
      description: "",
      image: "",
      date: "",
      duration: 90,
    });
    setCreateOpen(true);
  };

  const createEvent = async () => {
    if (!form.name.trim() || !form.groupId || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const payload = {
        groupId: form.groupId,
        name: form.name,
        description: form.description,
        image: form.image || `https://picsum.photos/seed/${encodeURIComponent(form.name)}/800/600`,
        date: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
        duration: Number(form.duration) || 90,
      };

      if (API_ENABLED) {
        const res = await api.createEvent(payload);
        setEvents((current) => [normalizeEvent(res.event), ...current]);
      } else {
        const event = local.createEvent(payload);
        setEvents((current) => [normalizeEvent(event), ...current]);
      }

      setCreateOpen(false);
      setNotice("Event created.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to create event");
    } finally {
      setSaving(false);
    }
  };

  const updateEvent = async () => {
    if (!editingEvent || !form.name.trim() || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const payload = {
        name: form.name,
        description: form.description,
        image: form.image,
        date: form.date ? new Date(form.date).toISOString() : editingEvent.date,
        duration: Number(form.duration) || 90,
      };
      if (API_ENABLED) {
        const res = await api.updateEvent(editingEvent.id, payload);
        const next = normalizeEvent(res.event);
        setEvents((current) => current.map((entry) => (entry.id === next.id ? next : entry)));
      }
      setEditingEvent(null);
      setNotice("Event updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (event: ViewEvent) => {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      if (API_ENABLED) {
        await api.deleteEvent(event.id);
        setEvents((current) => current.filter((entry) => entry.id !== event.id));
      }
      setNotice("Event deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to delete event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black sm:text-4xl">Events</h1>
          <p className="text-sm text-white/40">
            {events.length} events {loading ? "loading..." : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className={`${inputCls} min-w-52`}
          >
            <option value="">All groups</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <button
            onClick={startCreate}
            className="rounded-full bg-amber-glow px-4 py-2 text-sm font-bold text-stage-black"
          >
            <Plus className="mr-1 inline size-4" />
            New event
          </button>
        </div>
      </div>

      {notice && <p className="text-xs text-amber-glow">{notice}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleEvents.map((event) => {
          const group = groups.find((entry) => entry.id === event.groupId);
          return (
            <div key={event.id} className="glass-card rounded-2xl p-4">
              <div className="flex gap-4">
                <img
                  src={event.image}
                  alt={event.name}
                  className="size-24 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-black">{event.name}</h3>
                      <p className="mt-1 text-sm text-white/45">{group?.name || "Unknown group"}</p>
                    </div>
                    <Link
                      to="/live/$eventId"
                      params={{ eventId: event.publicId || event.id }}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold"
                    >
                      <Radio className="mr-1 inline size-3.5" />
                      Stage
                    </Link>
                  </div>
                  <p className="mt-2 text-sm text-white/45">
                    {event.description || "No description"}
                  </p>
                  <div className="mt-3 text-xs text-white/45">
                    {new Date(event.date).toLocaleString()} · {event.duration} min ·{" "}
                    {event.playlists.length} playlists
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to="/events/$eventId"
                      params={{ eventId: event.publicId || event.id }}
                      className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold"
                    >
                      Open editor
                    </Link>
                    <button
                      onClick={() => {
                        setEditingEvent(event);
                        setForm({
                          groupId: event.groupId,
                          name: event.name,
                          description: event.description,
                          image: event.image,
                          date: event.date ? new Date(event.date).toISOString().slice(0, 16) : "",
                          duration: event.duration,
                        });
                      }}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70"
                    >
                      <Edit3 className="mr-1 inline size-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => void deleteEvent(event)}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200"
                    >
                      <Trash2 className="mr-1 inline size-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {createOpen && (
        <Modal title="Create event" onClose={() => setCreateOpen(false)}>
          <EventForm
            form={form}
            setForm={setForm}
            groups={groups}
            saving={saving}
            onSubmit={() => void createEvent()}
            submitLabel="Create event"
          />
        </Modal>
      )}

      {editingEvent && (
        <Modal title="Edit event" onClose={() => setEditingEvent(null)}>
          <EventForm
            form={form}
            setForm={setForm}
            groups={groups}
            saving={saving}
            onSubmit={() => void updateEvent()}
            submitLabel="Save event"
            disableGroup
          />
        </Modal>
      )}
    </div>
  );
}

function EventForm({
  form,
  setForm,
  groups,
  saving,
  onSubmit,
  submitLabel,
  disableGroup = false,
}: {
  form: {
    groupId: string;
    name: string;
    description: string;
    image: string;
    date: string;
    duration: number;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      groupId: string;
      name: string;
      description: string;
      image: string;
      date: string;
      duration: number;
    }>
  >;
  groups: ViewGroup[];
  saving: boolean;
  onSubmit: () => void;
  submitLabel: string;
  disableGroup?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Field label="Group">
        <select
          value={form.groupId}
          onChange={(e) => setForm((current) => ({ ...current, groupId: e.target.value }))}
          disabled={disableGroup}
          className={inputCls}
        >
          <option value="">Select group</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Name">
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
      <Field label="Image URL">
        <input
          value={form.image}
          onChange={(e) => setForm((current) => ({ ...current, image: e.target.value }))}
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date & time">
          <input
            type="datetime-local"
            value={form.date}
            onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))}
            className={inputCls}
          />
        </Field>
        <Field label="Duration">
          <input
            type="number"
            value={form.duration}
            onChange={(e) =>
              setForm((current) => ({ ...current, duration: Number(e.target.value) || 90 }))
            }
            className={inputCls}
          />
        </Field>
      </div>
      <button
        onClick={onSubmit}
        disabled={!form.name.trim() || !form.groupId || saving}
        className="w-full rounded-xl bg-amber-glow py-3 font-bold text-stage-black disabled:opacity-50"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
