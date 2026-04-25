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
  session: PiSession | null;
  loading: boolean;
  error: string | null;
  login: (scopes?: PiScope[]) => Promise<void>;
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

  // Detect Pi Browser & init SDK on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsPiBrowser(detectPiBrowser());
    initPi(true); // sandbox mode
    setSession(loadSession());
  }, []);

  const login = useCallback(async (scopes: PiScope[] = ["username"]) => {
    setLoading(true);
    setError(null);
    try {
      initPi(true);
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
  }, []);

  const logout = useCallback(() => {
    saveSession(null);
    setSession(null);
  }, []);

  const value = useMemo<PiAuthContextValue>(
    () => ({ isPiBrowser, session, loading, error, login, logout }),
    [isPiBrowser, session, loading, error, login, logout],
  );

  return <PiAuthContext.Provider value={value}>{children}</PiAuthContext.Provider>;
}

export function usePiAuth() {
  const ctx = useContext(PiAuthContext);
  if (!ctx) throw new Error("usePiAuth must be used within PiAuthProvider");
  return ctx;
}