import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  EVENTS,
  GROUPS,
  USERS,
  type Event,
  type Group,
  type Playlist,
  type PlaylistItem,
} from "./mock-data";
import { API_ENABLED, api, getToken, setToken } from "./api";
import { normalizeUser } from "./view-models";

// ---------- AUTH ----------
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  username?: string;
  isAdmin?: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  loginGoogle: () => Promise<void>;
  loginGoogleWithCredential: (credential: string) => Promise<void>;
  registerLocal: (input: {
    name: string;
    username: string;
    password: string;
    email?: string;
  }) => Promise<void>;
  loginLocal: (identifier: string, password: string) => Promise<void>;
  forgotPassword: (identifier: string, newPassword: string) => Promise<void>;
  loginGuest: () => Promise<void>;
  logout: () => void;
}
const AuthContext = createContext<AuthCtx | null>(null);

const AUTH_KEY = "csl_auth_v1";
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

type BackendAuthUser = {
  email?: string;
  handle?: string;
  isAdmin?: boolean;
} & Record<string, unknown>;

type GooglePromptNotification = {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: string;
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              logo_alignment?: string;
              width?: number;
            },
          ) => void;
          prompt: (listener?: (notification: GooglePromptNotification) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function toAuthUser(user: BackendAuthUser): AuthUser {
  const base = normalizeUser(user);
  return {
    id: base.id,
    name: base.name,
    email: user?.email || "",
    avatar: base.avatar,
    username: typeof user?.handle === "string" ? String(user.handle).replace(/^@/, "") : undefined,
    isAdmin: !!user?.isAdmin,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser required"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!GOOGLE_CLIENT_ID) {
    return Promise.reject(new Error("VITE_GOOGLE_CLIENT_ID is missing"));
  }
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("google-identity-services");
    if (existing) {
      const checkLoaded = () => {
        if (window.google?.accounts?.id) resolve();
        else reject(new Error("Google Identity Services failed to initialize"));
      };
      window.setTimeout(checkLoaded, 100);
      return;
    }

    const script = document.createElement("script");
    script.id = "google-identity-services";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

async function requestGoogleCredential(): Promise<string> {
  await loadGoogleIdentityScript();

  return new Promise((resolve, reject) => {
    const google = window.google?.accounts?.id;
    if (!google) {
      reject(new Error("Google Identity Services is unavailable"));
      return;
    }

    let settled = false;
    const finish = (error?: Error, credential?: string) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else if (credential) resolve(credential);
      else reject(new Error("Google did not return a credential"));
    };

    google.cancel();
    google.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => finish(undefined, response?.credential),
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    google.prompt((notification) => {
      if (notification.isNotDisplayed?.()) {
        finish(new Error("Google sign-in could not be displayed"));
      } else if (notification.isSkippedMoment?.()) {
        finish(new Error("Google sign-in was skipped"));
      } else if (notification.isDismissedMoment?.()) {
        finish(new Error("Google sign-in was dismissed"));
      }
    });

    window.setTimeout(() => {
      finish(new Error("Timed out waiting for Google sign-in"));
    }, 30000);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(AUTH_KEY) : null;

        if (!API_ENABLED) {
          if (raw) setUser(JSON.parse(raw));
          if (!cancelled) setLoading(false);
          return;
        }

        const token = getToken();
        if (!token) {
          if (raw) localStorage.removeItem(AUTH_KEY);
          if (!cancelled) setLoading(false);
          return;
        }

        const res = await api.me();
        if (cancelled) return;
        const nextUser = toAuthUser(res.user);
        setUser(nextUser);
        localStorage.setItem(AUTH_KEY, JSON.stringify(nextUser));
      } catch {
        if (cancelled) return;
        setUser(null);
        setToken(null);
        if (typeof window !== "undefined") localStorage.removeItem(AUTH_KEY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = (u: AuthUser | null, token?: string | null) => {
    setUser(u);
    if (typeof window !== "undefined") {
      if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
      else localStorage.removeItem(AUTH_KEY);
    }
    if (token !== undefined) setToken(token);
  };

  const loginGoogleWithCredential = async (credential: string) => {
    const res = await api.google(credential);
    persist(toAuthUser(res.user as BackendAuthUser), res.token);
  };

  const demoUsersKey = "csl_demo_users_v1";

  const readDemoUsers = () => {
    if (typeof window === "undefined") return [] as Array<Record<string, string>>;
    try {
      const raw = localStorage.getItem(demoUsersKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const writeDemoUsers = (users: Array<Record<string, string>>) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(demoUsersKey, JSON.stringify(users));
  };

  const registerLocal = async ({
    name,
    username,
    password,
    email,
  }: {
    name: string;
    username: string;
    password: string;
    email?: string;
  }) => {
    if (!API_ENABLED) {
      const handle = username.replace(/^@+/, "").trim().toLowerCase();
      const demoUsers = readDemoUsers();
      if (demoUsers.some((entry) => entry.username === handle)) {
        throw new Error("username already in use");
      }
      demoUsers.push({
        id: `demo-${Date.now()}`,
        name: name.trim(),
        username: handle,
        password,
        email: email?.trim() || `${handle}@chordsync.demo`,
      });
      writeDemoUsers(demoUsers);
      persist({
        id: `demo-${Date.now()}`,
        name: name.trim(),
        username: handle,
        email: email?.trim() || `${handle}@chordsync.demo`,
        avatar: `https://i.pravatar.cc/200?u=${encodeURIComponent(handle)}`,
      });
      return;
    }

    const res = await api.register({ name, username, password, email });
    persist(toAuthUser(res.user as BackendAuthUser), res.token);
  };

  const loginLocal = async (identifier: string, password: string) => {
    if (!API_ENABLED) {
      const key = identifier.trim().toLowerCase().replace(/^@+/, "");
      const demoUser = readDemoUsers().find(
        (entry) => entry.username === key || entry.email?.toLowerCase() === key,
      );
      if (!demoUser || demoUser.password !== password) {
        throw new Error("invalid username or password");
      }
      persist({
        id: demoUser.id,
        name: demoUser.name,
        username: demoUser.username,
        email: demoUser.email,
        avatar: `https://i.pravatar.cc/200?u=${encodeURIComponent(demoUser.username)}`,
      });
      return;
    }

    const res = await api.login(identifier, password);
    persist(toAuthUser(res.user as BackendAuthUser), res.token);
  };

  const forgotPassword = async (identifier: string, newPassword: string) => {
    if (!API_ENABLED) {
      const key = identifier.trim().toLowerCase().replace(/^@+/, "");
      const users = readDemoUsers();
      const nextUsers = users.map((entry) =>
        entry.username === key || entry.email?.toLowerCase() === key
          ? { ...entry, password: newPassword }
          : entry,
      );
      const changed = nextUsers.some((entry, idx) => entry.password !== users[idx]?.password);
      if (!changed) throw new Error("account not found");
      writeDemoUsers(nextUsers);
      return;
    }

    await api.forgotPassword(identifier, newPassword);
  };

  const loginGoogle = async () => {
    if (!API_ENABLED) {
      persist({
        id: "me",
        name: "Leo Strat",
        email: "leo.strat@chordsync.live",
        avatar: "https://i.pravatar.cc/200?u=me",
        isAdmin: true,
      });
      return;
    }

    const credential = await requestGoogleCredential();
    await loginGoogleWithCredential(credential);
  };
  const loginGuest = async () => {
    if (!API_ENABLED) {
      persist({
        id: "guest",
        name: "Guest Performer",
        email: "guest@chordsync.live",
        avatar: "https://i.pravatar.cc/200?u=guest",
      });
      return;
    }

    const res = await api.guest();
    persist(toAuthUser(res.user as BackendAuthUser), res.token);
  };
  const logout = () => persist(null, null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginGoogle,
        loginGoogleWithCredential,
        registerLocal,
        loginLocal,
        forgotPassword,
        loginGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// ---------- DATA STORE (groups / events) ----------
interface DataCtx {
  groups: Group[];
  events: Event[];
  // groups
  createGroup: (g: Omit<Group, "id" | "inviteLink" | "members"> & { creatorId: string }) => Group;
  addGroupMember: (groupId: string, userId: string, role?: "Sync" | "Self" | "Scroller") => void;
  setMemberRole: (groupId: string, userId: string, role: "Sync" | "Self" | "Scroller") => void;
  // events
  createEvent: (e: Omit<Event, "id" | "playlists">) => Event;
  // playlists
  addPlaylist: (eventId: string, name: string, description: string) => void;
  updatePlaylist: (eventId: string, playlistId: string, patch: Partial<Playlist>) => void;
  deletePlaylist: (eventId: string, playlistId: string) => void;
  addPlaylistItem: (eventId: string, playlistId: string, item: Omit<PlaylistItem, "id">) => void;
  removePlaylistItem: (eventId: string, playlistId: string, itemId: string) => void;
  reorderPlaylist: (eventId: string, playlistId: string, fromIdx: number, toIdx: number) => void;
  // live sync (in-tab via custom events, cross-tab via storage)
  liveIndex: number;
  setLiveIndex: (idx: number) => void;
  liveScrollerId: string | null;
  requestScroller: (userId: string) => void;
}
const DataContext = createContext<DataCtx | null>(null);

const DATA_KEY = "csl_data_v1";
const LIVE_KEY = "csl_live_v1";

interface PersistShape {
  groups: Group[];
  events: Event[];
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistShape>({ groups: GROUPS, events: EVENTS });
  const [liveIndex, setLiveIndexState] = useState(0);
  const [liveScrollerId, setLiveScrollerId] = useState<string | null>("u1");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === LIVE_KEY && e.newValue) {
        try {
          const v = JSON.parse(e.newValue);
          if (typeof v.index === "number") setLiveIndexState(v.index);
          if (v.scrollerId !== undefined) setLiveScrollerId(v.scrollerId);
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = (next: PersistShape) => {
    setState(next);
    if (typeof window !== "undefined") localStorage.setItem(DATA_KEY, JSON.stringify(next));
  };

  const broadcastLive = (index: number, scrollerId: string | null) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LIVE_KEY, JSON.stringify({ index, scrollerId, t: Date.now() }));
    }
  };

  const setLiveIndex = (idx: number) => {
    setLiveIndexState(idx);
    broadcastLive(idx, liveScrollerId);
  };
  const requestScroller = (userId: string) => {
    setLiveScrollerId(userId);
    broadcastLive(liveIndex, userId);
  };

  const createGroup: DataCtx["createGroup"] = (g) => {
    const newGroup: Group = {
      id: `g-${Date.now()}`,
      name: g.name,
      description: g.description,
      image: g.image,
      members: [{ userId: g.creatorId, role: "Scroller" }],
      inviteLink: `chordsync.live/invite/${Math.random().toString(36).slice(2, 9)}`,
    };
    save({ ...state, groups: [newGroup, ...state.groups] });
    return newGroup;
  };
  const addGroupMember: DataCtx["addGroupMember"] = (groupId, userId, role = "Sync") => {
    save({
      ...state,
      groups: state.groups.map((g) =>
        g.id === groupId && !g.members.some((m) => m.userId === userId)
          ? { ...g, members: [...g.members, { userId, role }] }
          : g,
      ),
    });
  };
  const setMemberRole: DataCtx["setMemberRole"] = (groupId, userId, role) => {
    save({
      ...state,
      groups: state.groups.map((g) =>
        g.id === groupId
          ? { ...g, members: g.members.map((m) => (m.userId === userId ? { ...m, role } : m)) }
          : g,
      ),
    });
  };
  const createEvent: DataCtx["createEvent"] = (e) => {
    const ev: Event = { ...e, id: `e-${Date.now()}`, playlists: [] };
    save({ ...state, events: [ev, ...state.events] });
    return ev;
  };
  const updateEvent = (eventId: string, fn: (e: Event) => Event) => {
    save({ ...state, events: state.events.map((e) => (e.id === eventId ? fn(e) : e)) });
  };
  const addPlaylist: DataCtx["addPlaylist"] = (eventId, name, description) => {
    updateEvent(eventId, (e) => ({
      ...e,
      playlists: [...e.playlists, { id: `pl-${Date.now()}`, name, description, items: [] }],
    }));
  };
  const updatePlaylist: DataCtx["updatePlaylist"] = (eventId, playlistId, patch) => {
    updateEvent(eventId, (e) => ({
      ...e,
      playlists: e.playlists.map((p) => (p.id === playlistId ? { ...p, ...patch } : p)),
    }));
  };
  const deletePlaylist: DataCtx["deletePlaylist"] = (eventId, playlistId) => {
    updateEvent(eventId, (e) => ({
      ...e,
      playlists: e.playlists.filter((p) => p.id !== playlistId),
    }));
  };
  const addPlaylistItem: DataCtx["addPlaylistItem"] = (eventId, playlistId, item) => {
    updateEvent(eventId, (e) => ({
      ...e,
      playlists: e.playlists.map((p) =>
        p.id === playlistId
          ? {
              ...p,
              items: [
                ...p.items,
                { ...item, id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
              ],
            }
          : p,
      ),
    }));
  };
  const removePlaylistItem: DataCtx["removePlaylistItem"] = (eventId, playlistId, itemId) => {
    updateEvent(eventId, (e) => ({
      ...e,
      playlists: e.playlists.map((p) =>
        p.id === playlistId ? { ...p, items: p.items.filter((i) => i.id !== itemId) } : p,
      ),
    }));
  };
  const reorderPlaylist: DataCtx["reorderPlaylist"] = (eventId, playlistId, from, to) => {
    updateEvent(eventId, (e) => ({
      ...e,
      playlists: e.playlists.map((p) => {
        if (p.id !== playlistId) return p;
        const items = [...p.items];
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
        return { ...p, items };
      }),
    }));
  };

  return (
    <DataContext.Provider
      value={{
        groups: state.groups,
        events: state.events,
        createGroup,
        addGroupMember,
        setMemberRole,
        createEvent,
        addPlaylist,
        updatePlaylist,
        deletePlaylist,
        addPlaylistItem,
        removePlaylistItem,
        reorderPlaylist,
        liveIndex,
        setLiveIndex,
        liveScrollerId,
        requestScroller,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}

export { USERS };
