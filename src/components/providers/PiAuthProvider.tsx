import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  initPi,
  detectPiBrowser,
  authenticateUser,
  type PiScope,
} from "@/lib/piClient";

const STORAGE_KEY = "ayadi.pi.session";

export interface PiSessionUser {
  uid: string;
  username: string;
}

export interface PiSession {
  accessToken: string;
  user: PiSessionUser;
}

interface PiAuthContextValue {
  isPiBrowser: boolean;
  isDevModeAllowed: boolean;
  session: PiSession | null;
  loading: boolean;
  error: string | null;
  login: (scopes?: PiScope[]) => Promise<void>;
  loginAsDev: () => void;
  logout: () => void;
}

const PiAuthContext = createContext<PiAuthContextValue | undefined>(undefined);

function loadSession(): PiSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PiSession;
  } catch {
    return null;
  }
}

function saveSession(session: PiSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}

export function PiAuthProvider({ children }: { children: ReactNode }) {
  const [isPiBrowser, setIsPiBrowser] = useState(false);
  const [session, setSession] = useState<PiSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dev mode is only allowed when an explicit build-time flag is set OR
  // when running on a non-production hostname (lovable preview / localhost).
  const isDevModeAllowed = (() => {
    if (import.meta.env.VITE_ALLOW_DEV_MODE === "true") return true;
    if (import.meta.env.DEV) return true;
    if (typeof window !== "undefined") {
      const h = window.location.hostname;
      if (h === "localhost" || h === "127.0.0.1") return true;
      if (h.includes("id-preview--") || h.endsWith(".lovableproject.com")) return true;
    }
    return false;
  })();

  // Detect Pi Browser & init SDK on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsPiBrowser(detectPiBrowser());
    // sandbox=true only outside production; sandbox=false in published prod app.
    initPi(isDevModeAllowed);
    setSession(loadSession());
  }, [isDevModeAllowed]);

  const login = useCallback(async (scopes: PiScope[] = ["username"]) => {
    setLoading(true);
    setError(null);
    try {
      initPi(isDevModeAllowed);
      const auth = await authenticateUser(scopes, (payment) => {
        console.warn("[PiAuth] incomplete payment:", payment);
      });

      // Server-side verification of the access token.
      const verifyRes = await fetch("/api/public/pi-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: auth.accessToken }),
      });

      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to verify Pi access token");
      }

      const next: PiSession = {
        accessToken: auth.accessToken,
        user: { uid: auth.user.uid, username: auth.user.username },
      };
      saveSession(next);
      setSession(next);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Authentication failed";
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [isDevModeAllowed]);

  const logout = useCallback(() => {
    saveSession(null);
    setSession(null);
  }, []);

  const loginAsDev = useCallback(() => {
    if (!isDevModeAllowed) {
      console.warn("[PiAuth] Developer mode is disabled in production.");
      return;
    }
    const devSession: PiSession = {
      accessToken: "dev-mode-token",
      user: { uid: "dev-user-uid", username: "مطور" },
    };
    saveSession(devSession);
    setSession(devSession);
  }, [isDevModeAllowed]);

  const value = useMemo<PiAuthContextValue>(
    () => ({ isPiBrowser, isDevModeAllowed, session, loading, error, login, loginAsDev, logout }),
    [isPiBrowser, isDevModeAllowed, session, loading, error, login, loginAsDev, logout],
  );

  return <PiAuthContext.Provider value={value}>{children}</PiAuthContext.Provider>;
}

export function usePiAuth() {
  const ctx = useContext(PiAuthContext);
  if (!ctx) throw new Error("usePiAuth must be used within PiAuthProvider");
  return ctx;
}