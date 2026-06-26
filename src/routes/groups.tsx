import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { api, API_ENABLED } from "@/lib/api";
import { getUser } from "@/lib/mock-data";
import { useAuth, useData, USERS } from "@/lib/store";
import { normalizeGroup } from "@/lib/view-models";
import { useEffect, useState } from "react";
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

  if (pathname !== "/groups") {
    return <Outlet />;
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black">Jam Groups</h1>
            <p className="text-sm text-white/40">Rehearse, plan events, perform synced.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2.5 rounded-full bg-amber-glow text-stage-black text-sm font-bold flex items-center justify-center gap-2 glow-amber hover:scale-105 transition-transform"
            >
              <Plus className="size-4" /> New group
            </button>
            <button
              onClick={() => setShowJoin(true)}
              className="px-4 py-2.5 rounded-full border border-white/15 text-sm font-bold"
            >
              Join by invite
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-amber-glow">{error}</p>}
        {loading && <p className="text-sm text-white/50">Loading groups...</p>}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Link
              key={group.id}
              to="/groups/$groupId"
              params={{ groupId: group.id }}
              className="glass-card rounded-2xl overflow-hidden group hover:border-amber-glow/30 transition-all hover:-translate-y-0.5"
            >
              <div className="aspect-[16/9] relative overflow-hidden">
                <img
                  src={group.image}
                  alt={group.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stage-black via-stage-black/40 to-transparent" />
              </div>
              <div className="p-4">
                <h3 className="font-black text-lg">{group.name}</h3>
                <p className="text-xs text-white/50 line-clamp-2 mt-1">{group.description}</p>
                <div className="flex -space-x-2 mt-3">
                  {group.members.slice(0, 5).map((member) => {
                    const memberUser =
                      users.find((entry) => entry.id === member.userId) || getUser(member.userId);
                    return memberUser ? (
                      <img
                        key={member.userId}
                        src={memberUser.avatar}
                        alt={memberUser.name}
                        className="size-7 rounded-full ring-2 ring-stage-card"
                      />
                    ) : null;
                  })}
                </div>
              </div>
            </Link>
          ))}
        </div>
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
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-16 px-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-stage-card border border-white/10 rounded-3xl p-6 shadow-2xl"
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
