import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { api, API_ENABLED } from "@/lib/api";
import { getUser } from "@/lib/mock-data";
import { useAuth, useData, USERS } from "@/lib/store";
import { normalizeGroup } from "@/lib/view-models";
import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

export const Route = createFileRoute("/groups")({
  head: () => ({ meta: [{ title: "Groups - ChordSync Live" }] }),
  component: GroupsPage,
});

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function GroupsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const local = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState(local.groups);
  const [users, setUsers] = useState(USERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", image: "" });
  const [inviteValue, setInviteValue] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED || !user) return;
      setLoading(true);
      setError("");
      try {
        const groupRes = await api.listGroups();
        if (cancelled) return;
        setGroups((groupRes.groups || []).map(normalizeGroup));
      } catch (error: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(error, "Failed to load groups"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, local.groups]);

  const submit = async () => {
    if (!form.name || creatingGroup) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }

    const payload = {
      name: form.name,
      description: form.description,
      image: form.image || `https://picsum.photos/seed/${encodeURIComponent(form.name)}/800/800`,
    };

    setCreatingGroup(true);
    try {
      if (API_ENABLED) {
        const res = await api.createGroup(payload);
        const createdGroup = normalizeGroup(res.group);
        setGroups((current) => [
          createdGroup,
          ...current.filter((group) => group.id !== createdGroup.id),
        ]);
        setError("");
        setForm({ name: "", description: "", image: "" });
        setShowCreate(false);
        navigate({ to: "/groups/$groupId", params: { groupId: createdGroup.id } });
        return;
      } else {
        const next = local.createGroup({ ...payload, creatorId: user.id });
        setGroups((current) => [next, ...current.filter((group) => group.id !== next.id)]);
      }
      setForm({ name: "", description: "", image: "" });
      setShowCreate(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to create group"));
    } finally {
      setCreatingGroup(false);
    }
  };

  const joinByInvite = async () => {
    if (!inviteValue.trim() || joiningGroup) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    const inviteCode = inviteValue.trim().split("/").filter(Boolean).pop() || inviteValue.trim();
    try {
      setJoiningGroup(true);
      const res = await api.joinGroup(inviteCode);
      const joinedGroup = normalizeGroup(res.group);
      setGroups((current) => [
        joinedGroup,
        ...current.filter((group) => group.id !== joinedGroup.id),
      ]);
      setInviteValue("");
      setShowJoin(false);
      navigate({ to: "/groups/$groupId", params: { groupId: joinedGroup.id } });
    } catch (joinError: unknown) {
      setError(getErrorMessage(joinError, "Failed to join group"));
    } finally {
      setJoiningGroup(false);
    }
  };

  const totalMembers = useMemo(
    () => groups.reduce((count, group) => count + group.members.length, 0),
    [groups],
  );
  const uniqueMemberCount = useMemo(
    () => new Set(groups.flatMap((group) => group.members.map((member) => member.userId))).size,
    [groups],
  );
  const activeGroups = useMemo(
    () => groups.filter((group) => group.members.length > 1).length,
    [groups],
  );

  if (pathname !== "/groups") {
    return <Outlet />;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:py-10">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 sm:p-8">
            <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.12),transparent_70%)] xl:block" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-glow">Groups</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-black leading-none sm:text-5xl xl:text-6xl">
                Build rehearsal spaces that stay organized on desktop and mobile.
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-white/55 sm:text-base">
                Keep bands, worship teams, and event crews in one place with shared playlists,
                members, and live stage coordination.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Groups" value={String(groups.length)} />
                <MetricCard label="Members" value={String(uniqueMemberCount)} />
                <MetricCard label="Active Spaces" value={String(activeGroups)} />
              </div>
            </div>
          </div>

          <aside className="glass-card flex h-full flex-col justify-between rounded-[2rem] border border-white/10 p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/40">
                Quick Actions
              </p>
              <h2 className="mt-3 text-2xl font-black">Start a new team space</h2>
              <p className="mt-2 text-sm text-white/50">
                Create a private group or join an existing one with an invite code.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-glow px-4 py-3 text-sm font-bold text-stage-black glow-amber transition-transform hover:scale-[1.01]"
              >
                <Plus className="size-4" />
                New group
              </button>
              <button
                onClick={() => setShowJoin(true)}
                className="w-full rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm font-bold text-white/85"
              >
                Join by invite
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/35">Overview</p>
              <p className="mt-2 text-sm text-white/65">
                {totalMembers} total memberships across all groups. Use desktop view to manage
                multiple teams faster.
              </p>
            </div>
          </aside>
        </section>

        {error && <p className="text-xs text-amber-glow">{error}</p>}
        {loading && <p className="text-sm text-white/50">Loading groups...</p>}

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Your Groups</h2>
              <p className="text-sm text-white/45">
                Open any group to manage members, songs, and live events.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-bold text-white/55">
              {groups.length} total
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <Link
                key={group.id}
                to="/groups/$groupId"
                params={{ groupId: group.id }}
                className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] transition-all hover:-translate-y-1 hover:border-amber-glow/30"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={group.image}
                    alt={group.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stage-black via-stage-black/45 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xl font-black">{group.name}</p>
                      <p className="mt-1 truncate text-xs text-white/65">
                        {group.members.length} members
                      </p>
                    </div>
                    <span className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                      Open
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <p className="min-h-10 text-sm leading-6 text-white/55">
                    {group.description ||
                      "No description yet. Open this group to start organizing songs and events."}
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <InfoPill label="Members" value={String(group.members.length)} />
                    <InfoPill
                      label="Invite"
                      value={group.inviteLink?.split("/").filter(Boolean).pop() || "Open"}
                    />
                    <InfoPill label="Status" value={group.members.length > 1 ? "Active" : "New"} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex -space-x-2">
                      {group.members.slice(0, 5).map((member) => {
                        const memberUser =
                          users.find((entry) => entry.id === member.userId) ||
                          getUser(member.userId);
                        return memberUser ? (
                          <img
                            key={member.userId}
                            src={memberUser.avatar}
                            alt={memberUser.name}
                            className="size-9 rounded-full border-2 border-stage-card object-cover"
                          />
                        ) : null;
                      })}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                      View Group
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {!groups.length && !loading ? (
            <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
              <h3 className="text-xl font-black">No groups yet</h3>
              <p className="mt-2 text-sm text-white/45">
                Create your first group or join one from an invite link.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      {showCreate && (
        <Modal title="Create group" onClose={() => setShowCreate(false)}>
          <div className="space-y-3">
            <Field label="Name">
              <input
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                className={inputCls}
                placeholder="The Reverbs"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((current) => ({ ...current, description: e.target.value }))
                }
                className={`${inputCls} min-h-20 resize-y`}
                placeholder="Friday rehearsals at the loft."
              />
            </Field>
            <Field label="Image URL (optional)">
              <input
                value={form.image}
                onChange={(e) => setForm((current) => ({ ...current, image: e.target.value }))}
                className={inputCls}
                placeholder="https://..."
              />
            </Field>
            <button
              onClick={submit}
              disabled={!form.name || creatingGroup}
              className="w-full py-3 rounded-xl bg-amber-glow text-stage-black font-bold disabled:opacity-50"
            >
              {creatingGroup ? "Creating group..." : "Create group"}
            </button>
          </div>
        </Modal>
      )}

      {showJoin && (
        <Modal title="Join group" onClose={() => setShowJoin(false)}>
          <div className="space-y-3">
            <Field label="Invite link or code">
              <input
                value={inviteValue}
                onChange={(e) => setInviteValue(e.target.value)}
                className={inputCls}
                placeholder="chordsync.live/invite/abc123 or abc123"
              />
            </Field>
            <button
              onClick={joinByInvite}
              disabled={!inviteValue.trim() || joiningGroup}
              className="w-full py-3 rounded-xl bg-amber-glow text-stage-black font-bold disabled:opacity-50"
            >
              {joiningGroup ? "Joining group..." : "Join group"}
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

export const inputCls =
  "w-full px-3 py-2.5 rounded-lg bg-stage-elevated border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-amber-glow/50 text-sm";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-stage-black/30 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/35">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Modal({
  title,
  children,
  onClose,
  mobileFullscreen = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  mobileFullscreen?: boolean;
}) {
  return (
    <div
      className={`fixed inset-0 z-[60] flex justify-center bg-black/70 backdrop-blur-sm overflow-y-auto ${
        mobileFullscreen
          ? "items-stretch px-0 pt-0 sm:items-start sm:px-4 sm:pt-16"
          : "items-start px-4 pt-16"
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-stage-card border border-white/10 shadow-2xl ${
          mobileFullscreen
            ? "min-h-screen w-full rounded-none p-4 sm:min-h-0 sm:max-w-md sm:rounded-3xl sm:p-6"
            : "w-full max-w-md rounded-3xl p-6"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black">{title}</h3>
          <button
            onClick={onClose}
            className="size-8 rounded-lg hover:bg-white/5 flex items-center justify-center"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
