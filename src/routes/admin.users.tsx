import { createFileRoute } from "@tanstack/react-router";
import { api, API_ENABLED } from "@/lib/api";
import { normalizeUser } from "@/lib/view-models";
import { useEffect, useState, type InputHTMLAttributes } from "react";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

type ViewUser = ReturnType<typeof normalizeUser>;

function AdminUsers() {
  const [users, setUsers] = useState<ViewUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
  });

  async function loadUsers() {
    if (!API_ENABLED) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const res = await api.listUsers("");
      setUsers((res.users || []).map(normalizeUser));
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const adminCount = users.filter((user) => user.isAdmin).length;

  const submitAdminUser = async () => {
    if (!API_ENABLED) {
      setNotice("API_URL not configured");
      return;
    }

    setSaving(true);
    setNotice("");
    try {
      const res = await api.createAdminUser(form);
      setNotice(res.created ? "New admin user created." : "Existing user promoted to admin.");
      setForm({
        name: "",
        email: "",
        username: "",
        password: "",
      });
      await loadUsers();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to create admin user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black">Users</h1>
          <p className="mt-2 text-sm text-white/45">
            Create a new admin account or promote an existing account by email or username.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-glow/20 bg-amber-glow/10 px-4 py-3 text-right">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-glow">Admins</p>
          <p className="text-2xl font-black text-white">{adminCount}</p>
        </div>
      </div>

      <section className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Create admin user</h2>
            <p className="mt-1 text-sm text-white/45">
              If the email or username already exists, that user will be promoted to admin.
            </p>
          </div>
          <button
            onClick={() => void submitAdminUser()}
            disabled={saving}
            className="rounded-xl bg-amber-glow px-4 py-2 text-sm font-black text-stage-black disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create admin"}
          </button>
        </div>

        {notice && <p className="text-sm text-amber-glow">{notice}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Full name"
            value={form.name}
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            placeholder="Admin user name"
          />
          <FormField
            label="Email"
            value={form.email}
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            placeholder="admin2@chordsync.live"
            inputMode="email"
          />
          <FormField
            label="Username"
            value={form.username}
            onChange={(value) => setForm((current) => ({ ...current, username: value }))}
            placeholder="admin2"
          />
          <FormField
            label="Password"
            value={form.password}
            onChange={(value) => setForm((current) => ({ ...current, password: value }))}
            placeholder="Minimum 6 characters"
            type="password"
          />
        </div>
      </section>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-[10px] uppercase tracking-widest text-white/40 bg-white/[0.02]">
              <tr>
                <th className="text-left p-3">Performer</th>
                <th className="text-left p-3">Handle</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Bio</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <img src={user.avatar} alt={user.name} className="size-9 rounded-full" />
                      <span className="font-bold">{user.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-white/60">{user.handle}</td>
                  <td className="p-3 text-white/60">{user.email || "-"}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        user.isAdmin
                          ? "bg-amber-glow/15 text-amber-glow"
                          : "bg-white/8 text-white/60"
                      }`}
                    >
                      {user.isAdmin ? "Admin" : "User"}
                    </span>
                  </td>
                  <td className="p-3 text-white/50 truncate max-w-xs">{user.bio}</td>
                </tr>
              ))}
              {!loading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-white/40">
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <span className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-3 w-full rounded-xl border border-white/10 bg-stage-black/50 px-3 py-2 text-sm text-white outline-none focus:border-amber-glow/40"
      />
    </label>
  );
}
