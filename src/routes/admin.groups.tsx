import { createFileRoute, Link } from "@tanstack/react-router";
import { api, API_ENABLED } from "@/lib/api";
import { useAuth, useData } from "@/lib/store";
import { normalizeGroup } from "@/lib/view-models";
import { Field, Modal, inputCls } from "./groups";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/groups")({
  component: AdminGroups,
});

type ViewGroup = ReturnType<typeof normalizeGroup>;

function AdminGroups() {
  const local = useData();
  const { user } = useAuth();
  const [groups, setGroups] = useState<ViewGroup[]>([]);
  const [loading, setLoading] = useState(API_ENABLED);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ViewGroup | null>(null);
  const [form, setForm] = useState({ name: "", description: "", image: "" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) {
        setGroups(local.groups.map(normalizeGroup));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await api.listGroups();
        if (cancelled) return;
        setGroups((res.groups || []).map(normalizeGroup));
      } catch (error) {
        if (cancelled) return;
        setNotice(error instanceof Error ? error.message : "Failed to load groups");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [local.groups]);

  const resetForm = () => setForm({ name: "", description: "", image: "" });

  const createGroup = async () => {
    if (!form.name.trim() || saving || !user) return;
    setSaving(true);
    setNotice("");
    try {
      if (API_ENABLED) {
        const res = await api.createGroup({
          name: form.name,
          description: form.description,
          image:
            form.image || `https://picsum.photos/seed/${encodeURIComponent(form.name)}/800/800`,
        });
        setGroups((current) => [normalizeGroup(res.group), ...current]);
      } else {
        const group = local.createGroup({
          name: form.name,
          description: form.description,
          image:
            form.image || `https://picsum.photos/seed/${encodeURIComponent(form.name)}/800/800`,
          creatorId: user.id,
        });
        setGroups((current) => [normalizeGroup(group), ...current]);
      }
      setCreateOpen(false);
      resetForm();
      setNotice("Group created.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to create group");
    } finally {
      setSaving(false);
    }
  };

  const updateGroup = async () => {
    if (!editingGroup || !form.name.trim() || saving) return;
    setSaving(true);
    setNotice("");
    try {
      if (API_ENABLED) {
        const res = await api.updateGroup(editingGroup.id, form);
        const next = normalizeGroup(res.group);
        setGroups((current) => current.map((entry) => (entry.id === next.id ? next : entry)));
      }
      setEditingGroup(null);
      resetForm();
      setNotice("Group updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to update group");
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (group: ViewGroup) => {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      if (API_ENABLED) {
        await api.deleteGroup(group.id);
        setGroups((current) => current.filter((entry) => entry.id !== group.id));
      }
      setNotice("Group deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to delete group");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black sm:text-4xl">Groups</h1>
          <p className="text-sm text-white/40">
            {groups.length} groups {loading ? "loading..." : ""}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          className="rounded-full bg-amber-glow px-4 py-2 text-sm font-bold text-stage-black"
        >
          <Plus className="mr-1 inline size-4" />
          New group
        </button>
      </div>

      {notice && <p className="text-xs text-amber-glow">{notice}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.id} className="glass-card overflow-hidden rounded-2xl">
            <img src={group.image} alt={group.name} className="aspect-[16/9] w-full object-cover" />
            <div className="space-y-4 p-4">
              <div>
                <h3 className="text-lg font-black">{group.name}</h3>
                <p className="mt-1 text-sm text-white/45">
                  {group.description || "No description"}
                </p>
              </div>
              <div className="text-xs text-white/45">{group.members.length} members</div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/groups/$groupId"
                  params={{ groupId: group.id }}
                  className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold"
                >
                  Open
                </Link>
                <button
                  onClick={() => {
                    setEditingGroup(group);
                    setForm({
                      name: group.name,
                      description: group.description,
                      image: group.image,
                    });
                  }}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70"
                >
                  <Edit3 className="mr-1 inline size-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => void deleteGroup(group)}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200"
                >
                  <Trash2 className="mr-1 inline size-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {createOpen && (
        <Modal title="Create group" onClose={() => setCreateOpen(false)}>
          <div className="space-y-3">
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
                onChange={(e) =>
                  setForm((current) => ({ ...current, description: e.target.value }))
                }
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
            <button
              onClick={() => void createGroup()}
              disabled={!form.name.trim() || saving}
              className="w-full rounded-xl bg-amber-glow py-3 font-bold text-stage-black disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create group"}
            </button>
          </div>
        </Modal>
      )}

      {editingGroup && (
        <Modal title="Edit group" onClose={() => setEditingGroup(null)}>
          <div className="space-y-3">
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
                onChange={(e) =>
                  setForm((current) => ({ ...current, description: e.target.value }))
                }
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
            <button
              onClick={() => void updateGroup()}
              disabled={!form.name.trim() || saving}
              className="w-full rounded-xl bg-amber-glow py-3 font-bold text-stage-black disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save group"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
