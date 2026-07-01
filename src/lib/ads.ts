import { useQuery } from "@tanstack/react-query";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import { showPiAd, type PiAdType } from "@/lib/piClient";

/**
 * Ad-Free subscription status. Cached for 5min per session.
 */
export function useAdFreeStatus() {
  const { session } = usePiAuth();
  const accessToken = session?.accessToken ?? null;
  return useQuery({
    queryKey: ["ads-status", accessToken ? "auth" : "anon"],
    queryFn: async () => {
      if (!accessToken) return { adFree: false, expiresAt: null as string | null };
      const res = await fetch("/api/public/ads-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      if (!res.ok) return { adFree: false, expiresAt: null as string | null };
      return (await res.json()) as { adFree: boolean; expiresAt: string | null };
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Returns an async helper that shows an ad UNLESS the user has an active
 * ad-free subscription. Never blocks the caller for long — errors swallowed.
 */
export function useMaybeShowAd() {
  const { data } = useAdFreeStatus();
  return async (type: PiAdType = "interstitial") => {
    if (data?.adFree) return;
    await showPiAd(type);
  };
}