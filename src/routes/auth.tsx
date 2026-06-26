import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { API_ENABLED } from "@/lib/api";
import { GOOGLE_CLIENT_ID, loadGoogleIdentityScript, useAuth } from "@/lib/store";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in - ChordSync Live" }] }),
  component: AuthPage,
});

type AuthMode = "login" | "register" | "forgot";
type BusyState = "google" | "guest" | "login" | "register" | "forgot" | null;

function AuthPage() {
  const {
    user,
    loginGoogle,
    loginGoogleWithCredential,
    loginLocal,
    registerLocal,
    forgotPassword,
    loginGuest,
  } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("register");
  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    identifier: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [googleButtonReady, setGoogleButtonReady] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function setupGoogleButton() {
      if (!API_ENABLED || !GOOGLE_CLIENT_ID || !googleButtonRef.current) return;

      try {
        await loadGoogleIdentityScript();
        if (cancelled || !googleButtonRef.current) return;

        const google = window.google?.accounts?.id;
        if (!google) throw new Error("Google Identity Services is unavailable");

        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            if (!response.credential) {
              setError("Google did not return a credential");
              return;
            }

            setBusy("google");
            setError("");
            try {
              await loginGoogleWithCredential(response.credential);
            } catch (authError: unknown) {
              setError(authError instanceof Error ? authError.message : "Sign-in failed");
            } finally {
              setBusy(null);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        googleButtonRef.current.innerHTML = "";
        google.renderButton(googleButtonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "left",
          width: Math.max(280, googleButtonRef.current.clientWidth || 320),
        });
        setGoogleButtonReady(true);
      } catch (setupError: unknown) {
        if (cancelled) return;
        setGoogleButtonReady(false);
        setError(
          setupError instanceof Error
            ? setupError.message
            : "Google sign-in is unavailable on this device",
        );
      }
    }

    setupGoogleButton();
    return () => {
      cancelled = true;
    };
  }, [loginGoogleWithCredential]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
  };

  const runAuth = async (kind: "google" | "guest") => {
    setBusy(kind);
    setError("");
    setMessage("");
    try {
      if (kind === "google") await loginGoogle();
      else await loginGuest();
    } catch (authError: unknown) {
      setError(authError instanceof Error ? authError.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  };

  const submitRegister = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      setError("Name, username, and password are required");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setBusy("register");
    setError("");
    setMessage("");
    try {
      await registerLocal({
        name: form.name,
        username: form.username,
        password: form.password,
        email: form.email || undefined,
      });
    } catch (authError: unknown) {
      setError(authError instanceof Error ? authError.message : "Registration failed");
    } finally {
      setBusy(null);
    }
  };

  const submitLogin = async () => {
    if (!form.identifier.trim() || !form.password.trim()) {
      setError("Username or email and password are required");
      return;
    }

    setBusy("login");
    setError("");
    setMessage("");
    try {
      await loginLocal(form.identifier, form.password);
    } catch (authError: unknown) {
      setError(authError instanceof Error ? authError.message : "Login failed");
    } finally {
      setBusy(null);
    }
  };

  const submitForgot = async () => {
    if (!form.identifier.trim() || !form.newPassword.trim()) {
      setError("Username or email and new password are required");
      return;
    }
    if (form.newPassword !== form.confirmNewPassword) {
      setError("New passwords do not match");
      return;
    }

    setBusy("forgot");
    setError("");
    setMessage("");
    try {
      await forgotPassword(form.identifier, form.newPassword);
      setMessage("Password updated. You can log in now.");
      setForm((current) => ({
        ...current,
        password: "",
        newPassword: "",
        confirmNewPassword: "",
      }));
      setMode("login");
    } catch (authError: unknown) {
      setError(authError instanceof Error ? authError.message : "Password reset failed");
    } finally {
      setBusy(null);
    }
  };

  const primaryAction =
    mode === "register"
      ? { label: busy === "register" ? "Creating account..." : "Create account", onClick: submitRegister }
      : mode === "login"
        ? { label: busy === "login" ? "Signing in..." : "Sign in", onClick: submitLogin }
        : { label: busy === "forgot" ? "Updating password..." : "Update password", onClick: submitForgot };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-stage-black p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(34,211,238,0.1),transparent_50%)]" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[rgba(12,14,20,0.86)] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-10">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex size-10 items-center justify-center gap-0.5 rounded-lg bg-amber-glow">
            <div className="h-5 w-1 animate-eq rounded-full bg-stage-black" />
            <div
              className="h-7 w-1 animate-eq rounded-full bg-stage-black"
              style={{ animationDelay: "100ms" }}
            />
            <div
              className="h-4 w-1 animate-eq rounded-full bg-stage-black"
              style={{ animationDelay: "200ms" }}
            />
          </div>
          <span className="text-xl font-extrabold">
            ChordSync <span className="text-amber-glow">Live</span>
          </span>
        </div>

        <h1 className="mb-2 text-3xl font-black sm:text-4xl">Join the session.</h1>
        <p className="mb-6 text-sm text-white/50">
          Create a guest-style account with name, username, and password, then sign in any time.
        </p>

        <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {(["register", "login", "forgot"] as AuthMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => switchMode(item)}
              className={`rounded-xl px-3 py-2 text-xs font-bold capitalize transition-colors ${
                mode === item ? "bg-amber-glow text-stage-black" : "text-white/65 hover:text-white"
              }`}
            >
              {item === "forgot" ? "Reset" : item}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {mode === "register" && (
            <>
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Full name"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-glow/40"
              />
              <input
                value={form.username}
                onChange={(e) => updateField("username", e.target.value)}
                placeholder="Username"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-glow/40"
              />
              <input
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="Email (optional)"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-glow/40"
              />
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-glow/40"
              />
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
                placeholder="Confirm password"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-glow/40"
              />
            </>
          )}

          {mode === "login" && (
            <>
              <input
                value={form.identifier}
                onChange={(e) => updateField("identifier", e.target.value)}
                placeholder="Username or email"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-glow/40"
              />
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-glow/40"
              />
            </>
          )}

          {mode === "forgot" && (
            <>
              <input
                value={form.identifier}
                onChange={(e) => updateField("identifier", e.target.value)}
                placeholder="Username or email"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-glow/40"
              />
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => updateField("newPassword", e.target.value)}
                placeholder="New password"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-glow/40"
              />
              <input
                type="password"
                value={form.confirmNewPassword}
                onChange={(e) => updateField("confirmNewPassword", e.target.value)}
                placeholder="Confirm new password"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-amber-glow/40"
              />
            </>
          )}

          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={busy !== null}
            className="w-full rounded-xl bg-amber-glow px-4 py-3 text-sm font-black text-stage-black transition-transform hover:scale-[1.01] disabled:opacity-60"
          >
            {primaryAction.label}
          </button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] uppercase tracking-widest text-white/30">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="space-y-3">
          <div ref={googleButtonRef} className="flex min-h-11 w-full items-center justify-center" />
          {!googleButtonReady && (
            <button
              onClick={() => runAuth("google")}
              disabled={busy !== null}
              className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-stage-black transition-colors hover:bg-white/90 disabled:opacity-60"
            >
              {busy === "google" ? "Connecting..." : "Try Google prompt"}
            </button>
          )}

          <button
            onClick={() => switchMode("register")}
            disabled={busy !== null}
            className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/5 disabled:opacity-60"
          >
            Create guest account
          </button>

          <button
            onClick={() => runAuth("guest")}
            disabled={busy !== null}
            className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-white/65 transition-colors hover:bg-white/[0.03] disabled:opacity-60"
          >
            {busy === "guest" ? "Connecting..." : "Quick guest session"}
          </button>
        </div>

        {error && <p className="mt-4 text-center text-xs text-rose-300">{error}</p>}
        {message && <p className="mt-4 text-center text-xs text-emerald-300">{message}</p>}

        <p className="mt-8 text-center text-[10px] text-white/30">
          {API_ENABLED
            ? "Secure mode - Google, local register/login, and password reset use the backend session API."
            : "Demo mode - Credentials are stored locally in this browser for testing."}
        </p>
      </div>
    </div>
  );
}
