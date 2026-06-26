import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useData, USERS } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Copy,
  Plus,
  UserPlus,
  Users as UsersIcon,
  ShieldCheck,
  Radio,
} from "lucide-react";
import { Field, Modal, inputCls } from "./groups";
import { api, API_ENABLED } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { normalizeEvent, normalizeGroup, normalizeUser } from "@/lib/view-models";

export const Route = createFileRoute("/groups/$groupId")({
  head: ({ params }) => ({
    meta: [
      { title: "Group - ChordSync Live" },
      { name: "description", content: `Group ${params.groupId}` },
    ],
  }),
  component: GroupDetail,
});

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type ViewGroup = ReturnType<typeof normalizeGroup>;
type ViewEvent = ReturnType<typeof normalizeEvent>;
type ViewUser = ReturnType<typeof normalizeUser>;
type GroupMember = ViewGroup["members"][number];
type EventPlaylist = ViewEvent["playlists"][number];

function GroupDetail() {
  const { groupId } = Route.useParams();
  const local = useData();
  const localGroup = useMemo(
    () => local.groups.find((groupEntry) => groupEntry.id === groupId) || null,
    [groupId, local.groups],
  );
  const localEvents = useMemo(
    () => local.events.filter((eventEntry) => eventEntry.groupId === groupId),
    [groupId, local.events],
  );

  const [group, setGroup] = useState<ViewGroup | null>(localGroup || null);
  const [groupEvents, setGroupEvents] = useState<ViewEvent[]>(localEvents);
  const [users, setUsers] = useState<ViewUser[]>(USERS);
  const [loading, setLoading] = useState(API_ENABLED);
  const [error, setError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidatePages, setCandidatePages] = useState(1);
  const [evOpen, setEvOpen] = useState(false);
  const [evForm, setEvForm] = useState({
    name: "",
    description: "",
    image: "",
    date: "",
    duration: 90,
  });
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 250);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) return;
      setLoading(true);
      setError("");
      try {
        const groupRes = await api.getGroup(groupId);
        if (cancelled) return;
        setGroup(normalizeGroup(groupRes.group));
        setGroupEvents((groupRes.events || []).map(normalizeEvent));
        const memberUsers = (groupRes.users || []).map(normalizeUser);
        const byId = new Map(memberUsers.map((entry) => [entry.id, entry]));
        setUsers([...byId.values()]);
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(loadError, "Failed to load group data"));
        if (localGroup) {
          setGroup(localGroup);
          setGroupEvents(localEvents);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, localGroup, localEvents]);

  useEffect(() => {
    if (!addOpen || !API_ENABLED) return;
    let cancelled = false;

    async function loadCandidates() {
      setCandidatesLoading(true);
      try {
        const res = await api.listUsers(debouncedSearch, candidatePage, 12);
        if (cancelled) return;
        const remoteUsers = (res.users || []).map(normalizeUser);
        setUsers((current) => {
          const byId = new Map(current.map((entry) => [entry.id, entry]));
          remoteUsers.forEach((entry) => byId.set(entry.id, entry));
          return [...byId.values()];
        });
        setCandidatePages(res.pages || 1);
        setCandidatePage(res.page || 1);
      } catch {
        if (cancelled) return;
      } finally {
        if (!cancelled) setCandidatesLoading(false);
      }
    }

    loadCandidates();
    return () => {
      cancelled = true;
    };
  }, [addOpen, candidatePage, debouncedSearch]);

  useEffect(() => {
    setCandidatePage(1);
  }, [debouncedSearch, addOpen]);

  const refreshGroup = async () => {
    if (!API_ENABLED) return;
    const res = await api.getGroup(groupId);
    setGroup(normalizeGroup(res.group));
    setGroupEvents((res.events || []).map(normalizeEvent));
  };

  const candidates = useMemo(() => {
    if (!group) return [];
    return users.filter(
      (entry) =>
        !group.members.some((member: GroupMember) => member.userId === entry.id) &&
        (!debouncedSearch ||
          entry.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          entry.handle.toLowerCase().includes(debouncedSearch.toLowerCase())),
    );
  }, [debouncedSearch, group, users]);

  const addMember = async (userId: string) => {
    if (!group || addingMemberId) return;
    setAddingMemberId(userId);
    try {
      if (API_ENABLED) {
        const res = await api.addMember(group.id, userId, "Member");
        setGroup(normalizeGroup(res.group));
      } else {
        local.addGroupMember(group.id, userId);
        setGroup(local.groups.find((groupEntry) => groupEntry.id === group.id) || group);
      }
    } catch (memberError: unknown) {
      setError(getErrorMessage(memberError, "Failed to add member"));
    } finally {
      setAddingMemberId(null);
    }
  };

  const changeRole = async (userId: string, role: "Member" | "Scroller") => {
    if (!group || roleUpdatingId) return;
    setRoleUpdatingId(userId);
    try {
      if (API_ENABLED) {
        const res = await api.setMemberRole(group.id, userId, role);
        setGroup(normalizeGroup(res.group));
      } else {
        local.setMemberRole(group.id, userId, role);
        setGroup(local.groups.find((groupEntry) => groupEntry.id === group.id) || group);
      }
    } catch (roleError: unknown) {
      setError(getErrorMessage(roleError, "Failed to update member role"));
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const createEvent = async () => {
    if (!group || !evForm.name || !evForm.date || creatingEvent) return;
    const body = {
      groupId: group.id,
      name: evForm.name,
      description: evForm.description,
      image:
        evForm.image || `https://picsum.photos/seed/${encodeURIComponent(evForm.name)}/800/600`,
      date: new Date(evForm.date).toISOString(),
      duration: evForm.duration,
    };

    setCreatingEvent(true);
    try {
      if (API_ENABLED) {
        await api.createEvent(body);
        await refreshGroup();
      } else {
        const event = local.createEvent(body);
        setGroupEvents([event, ...groupEvents]);
      }

      setEvOpen(false);
      setEvForm({ name: "", description: "", image: "", date: "", duration: 90 });
    } catch (createError: unknown) {
      setError(getErrorMessage(createError, "Failed to create event"));
    } finally {
      setCreatingEvent(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-white/60">Loading group...</div>
      </AppShell>
    );
  }

  if (!group) {
    return (
      <AppShell>
        <div className="p-8 text-center text-white/60">
          Group not found.
          {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
        </div>
      </AppShell>
    );
  }

  const inviteCode = group.inviteLink.split("/").filter(Boolean).pop() || group.inviteLink;

  return (
    <AppShell>
      <div className="relative">
        <div className="aspect-[3/1] sm:aspect-[5/1] relative overflow-hidden">
          <img src={group.image} alt={group.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-stage-black via-stage-black/40 to-transparent" />
        </div>
        <div className="max-w-6xl mx-auto px-4 -mt-20 sm:-mt-24 relative ">
          <div className="glass-card rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-4xl sm:text-5xl font-black">{group.name}</h1>
                <p className="text-white/60 mt-2 max-w-prose">{group.description}</p>
                {error && <p className="mt-2 text-xs text-amber-glow">{error}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAddOpen(true)}
                  className="px-4 py-2.5 rounded-full bg-amber-glow text-stage-black text-sm font-bold flex items-center gap-2"
                >
                  <UserPlus className="size-4" /> Add member
                </button>
                <button
                  onClick={() => setEvOpen(true)}
                  className="px-4 py-2.5 rounded-full border border-white/15 text-sm font-bold flex items-center gap-2"
                >
                  <Plus className="size-4" /> Create event
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4 mt-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">
                  Invite Link
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="px-3 py-2 rounded-xl bg-stage-elevated border border-white/10 text-xs text-white/70 break-all flex-1 min-w-[220px]">
                    {group.inviteLink}
                  </div>
                  <button
                    onClick={() => navigator.clipboard?.writeText(group.inviteLink)}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold flex items-center gap-2"
                  >
                    <Copy className="size-3.5" /> Copy
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">
                  Invite Code
                </p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-black tracking-[0.2em]">{inviteCode}</p>
                  <button
                    onClick={() => navigator.clipboard?.writeText(inviteCode)}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold flex items-center gap-2"
                  >
                    <Copy className="size-3.5" /> Copy code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl px-4 py-8 grid lg:grid-cols-[1.15fr_0.85fr] gap-8  ">
        <section className="space-y-4 ">
          <div className="flex items-end justify-between gap-4  ">
            <div>
              <h2 className="text-2xl font-black">Events</h2>
              <p className="text-sm text-white/40">Open stage from here.</p>
            </div>
            <button
              onClick={() => setEvOpen(true)}
              className="px-3 py-1.5 rounded-full bg-amber-glow text-stage-black text-xs font-bold flex items-center gap-1.5 mx-5"
            >
              <Plus className="size-3.5" /> New event
            </button>
          </div>

          {groupEvents.length === 0 && (
            <div className="glass-card rounded-2xl p-8 text-center text-white/50">
              No events yet. Create one to start building playlists and stage mode sessions.
            </div>
          )}

          <div className="space-y-3">
            {groupEvents.map((event: ViewEvent) => (
              <div key={event.id} className="glass-card rounded-2xl p-4 sm:p-5  ">
                <div className="flex gap-4">
                  <img
                    src={event.image}
                    alt={event.name}
                    className="size-20 rounded-xl object-cover ring-1 ring-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-black text-lg truncate">{event.name}</h3>
                        <p className="text-xs text-white/50 line-clamp-2 mt-1">
                          {event.description}
                        </p>
                      </div>
                      <Link
                        to="/live/$eventId"
                        params={{ eventId: event.publicId || event.id }}
                        className="px-3 py-2 rounded-xl border border-white/10 text-xs font-bold flex items-center gap-2 hover:bg-white/5"
                      >
                        <Radio className="size-3.5" /> Start
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-3 text-[11px] text-white/40 mt-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(event.date).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      <span>• {event.duration} min</span>
                      <span>
                        •{" "}
                        {event.playlists.reduce(
                          (count: number, playlist: EventPlaylist) => count + playlist.items.length,
                          0,
                        )}{" "}
                        songs
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      <Link
                        to="/events/$eventId"
                        params={{ eventId: event.publicId || event.id }}
                        className="px-3 py-2 rounded-xl bg-amber-glow text-stage-black text-xs font-bold"
                      >
                        Open event
                      </Link>
                      <Link
                        to="/live/$eventId"
                        params={{ eventId: event.publicId || event.id }}
                        className="px-3 py-2 rounded-xl border border-white/10 text-xs font-bold"
                      >
                        Fullscreen mode
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-2xl font-black">Members</h3>
              <p className="text-sm text-white/40">Assign roles and manage scrollers.</p>
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold mx-auto"
            >
              Add
            </button>
          </div>

          <div className="space-y-2">
            {group.members.map((member: GroupMember) => {
              const memberUser =
                users.find((entry) => entry.id === member.userId) ||
                USERS.find((entry) => entry.id === member.userId);
              if (!memberUser) return null;

              return (
                <div
                  key={member.userId}
                  className="glass-card rounded-xl p-3 flex items-center gap-3"
                >
                  <img
                    src={memberUser.avatar}
                    alt={memberUser.name}
                    className="size-10 rounded-full ring-1 ring-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{memberUser.name}</p>
                    <p className="text-[10px] text-white/40">{memberUser.handle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.role === "Scroller" && (
                      <span className="px-2 py-1 rounded-full bg-amber-glow/10 text-amber-glow text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                        <ShieldCheck className="size-3" /> Scroller
                      </span>
                    )}
                    <select
                      value={member.role}
                      onChange={(e) =>
                        changeRole(member.userId, e.target.value as "Member" | "Scroller")
                      }
                      disabled={roleUpdatingId === member.userId}
                      className="text-[10px] bg-white/5 border border-white/10 rounded-md px-1.5 py-1 font-bold uppercase tracking-wider"
                    >
                      <option value="Member">Member</option>
                      <option value="Scroller">Scroller</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass-card rounded-2xl p-4 ">
            <div className="flex items-center gap-2 mb-2">
              <UsersIcon className="size-4 text-amber-glow" />
              <p className="text-sm font-black">Group Summary</p>
            </div>
            <div className="space-y-1 text-xs text-white/50">
              <p>{group.members.length} members</p>
              <p>{groupEvents.length} events</p>
              <p>
                {groupEvents.reduce(
                  (count: number, event: ViewEvent) =>
                    count +
                    event.playlists.reduce(
                      (playlistCount: number, playlist: EventPlaylist) =>
                        playlistCount + playlist.items.length,
                      0,
                    ),
                  0,
                )}{" "}
                total playlist items
              </p>
            </div>
          </div>
        </aside>
      </div>

      {addOpen && (
        <Modal title="Add members" onClose={() => setAddOpen(false)}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search performers..."
            className={inputCls + " mb-3"}
          />
          <div className="max-h-80 overflow-y-auto space-y-1.5">
            {candidatesLoading && (
              <p className="py-3 text-center text-xs text-white/50">Loading members...</p>
            )}
            {candidates.map((entry) => (
              <button
                key={entry.id}
                onClick={() => addMember(entry.id)}
                disabled={addingMemberId === entry.id}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left disabled:opacity-60"
              >
                <img src={entry.avatar} alt={entry.name} className="size-9 rounded-full" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{entry.name}</p>
                  <p className="text-[10px] text-white/40">{entry.handle}</p>
                </div>
                <span className="text-[10px] font-bold text-amber-glow">
                  {addingMemberId === entry.id ? "ADDING..." : "ADD"}
                </span>
              </button>
            ))}
            {!candidates.length && !candidatesLoading && (
              <p className="text-white/40 text-xs text-center py-6">No more performers to add.</p>
            )}
          </div>
          {API_ENABLED && candidatePages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-white/50">
              <button
                onClick={() => setCandidatePage((current) => Math.max(1, current - 1))}
                disabled={candidatePage <= 1}
                className="rounded-full border border-white/10 px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {candidatePage} of {candidatePages}
              </span>
              <button
                onClick={() => setCandidatePage((current) => Math.min(candidatePages, current + 1))}
                disabled={candidatePage >= candidatePages}
                className="rounded-full border border-white/10 px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </Modal>
      )}

      {evOpen && (
        <Modal title="Create event" onClose={() => setEvOpen(false)}>
          <div className="space-y-3">
            <Field label="Name">
              <input
                value={evForm.name}
                onChange={(e) => setEvForm((current) => ({ ...current, name: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={evForm.description}
                onChange={(e) =>
                  setEvForm((current) => ({ ...current, description: e.target.value }))
                }
                className={`${inputCls} min-h-16 resize-y`}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Date & time">
                <input
                  type="datetime-local"
                  value={evForm.date}
                  onChange={(e) => setEvForm((current) => ({ ...current, date: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Duration (min)">
                <input
                  type="number"
                  value={evForm.duration}
                  onChange={(e) =>
                    setEvForm((current) => ({ ...current, duration: Number(e.target.value) }))
                  }
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Image URL">
              <input
                value={evForm.image}
                onChange={(e) => setEvForm((current) => ({ ...current, image: e.target.value }))}
                className={inputCls}
                placeholder="https://..."
              />
            </Field>
            <button
              onClick={createEvent}
              disabled={!evForm.name || !evForm.date || creatingEvent}
              className="w-full py-3 rounded-xl bg-amber-glow text-stage-black font-bold disabled:opacity-50"
            >
              {creatingEvent ? "Creating event..." : "Create event"}
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
