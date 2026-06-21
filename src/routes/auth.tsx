import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { API_ENABLED } from "@/lib/api";
import { GOOGLE_CLIENT_ID, loadGoogleIdentityScript, useAuth } from "@/lib/store";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in - ChordSync Live" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loginGoogle, loginGoogleWithCredential, loginGuest } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"google" | "guest" | null>(null);
  const [error, setError] = useState("");
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

  const runAuth = async (mode: "google" | "guest") => {
    setBusy(mode);
    setError("");
    try {
      if (mode === "google") await loginGoogle();
      else await loginGuest();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-stage-black flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(34,211,238,0.1),transparent_50%)]" />
      <div className="relative w-full max-w-md glass-card rounded-3xl p-6 sm:p-10 animate-fade-in-up">
        <div className="flex items-center gap-2 mb-8">
          <div className="size-10 bg-amber-glow rounded-lg flex items-center justify-center gap-0.5">
            <div className="w-1 h-5 bg-stage-black rounded-full animate-eq" />
            <div
              className="w-1 h-7 bg-stage-black rounded-full animate-eq"
              style={{ animationDelay: "100ms" }}
            />
            <div
              className="w-1 h-4 bg-stage-black rounded-full animate-eq"
              style={{ animationDelay: "200ms" }}
            />
          </div>
          <span className="text-xl font-extrabold">
            ChordSync <span className="text-amber-glow">Live</span>
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black mb-2">Step on stage.</h1>
        <p className="text-white/50 mb-8 text-sm">
          Sign in to sync setlists with your group, or browse as a guest.
        </p>

        <div className="space-y-3">
          <div ref={googleButtonRef} className="w-full min-h-11 flex items-center justify-center" />
          {!googleButtonReady && (
            <button
              onClick={() => runAuth("google")}
              disabled={busy !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-stage-black font-bold text-sm hover:bg-white/90 transition-colors disabled:opacity-60"
            >
              {busy === "google" ? "Connecting..." : "Try Google prompt"}
            </button>
          )}
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] uppercase tracking-widest text-white/30">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          onClick={() => runAuth("guest")}
          disabled={busy !== null}
          className="w-full px-4 py-3 rounded-xl border border-white/15 text-white font-bold text-sm hover:bg-white/5 transition-colors disabled:opacity-60"
        >
          {busy === "guest" ? "Connecting..." : "Continue as guest"}
        </button>

        {error && <p className="mt-4 text-xs text-rose-300 text-center">{error}</p>}

        <p className="mt-8 text-[10px] text-white/30 text-center">
          {API_ENABLED
            ? "Secure mode - Google and guest sign-in use the backend session API."
            : "Demo mode - No real authentication is performed."}
        </p>
      </div>
    </div>
  );
}
