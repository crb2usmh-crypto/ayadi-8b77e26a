import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Pickaxe, Clock, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import { cn } from "@/lib/utils";
import ayadiTokenImg from "@/assets/ayadi-token.png";

interface ClaimEntry {
  id: string;
  amount: number;
  claimed_at: string;
}

interface BalanceResponse {
  balance: number;
  lastClaimAt: string | null;
  nextClaimInMs: number;
  cooldownMs: number;
  claims: ClaimEntry[];
}

interface MineResponse {
  claimed: boolean;
  balance: number;
  reward?: number;
  lastClaimAt: string | null;
  nextClaimInMs: number;
  cooldownMs: number;
  error?: string;
}

async function fetchBalance(accessToken: string): Promise<BalanceResponse> {
  const res = await fetch("/api/public/ayadi-balance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Failed (${res.status})`);
  }
  return (await res.json()) as BalanceResponse;
}

async function mine(accessToken: string): Promise<MineResponse> {
  const res = await fetch("/api/public/ayadi-mine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  const json = (await res.json()) as MineResponse;
  if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
  return json;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function AyadiMiner() {
  const { t, i18n } = useTranslation();
  const { session } = usePiAuth();
  const queryClient = useQueryClient();
  const accessToken = session?.accessToken ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["ayadi-balance", accessToken ? "auth" : "anon"],
    queryFn: () => fetchBalance(accessToken!),
    enabled: !!accessToken,
    staleTime: 10_000,
  });

  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    if (!data) return;
    setRemaining(data.nextClaimInMs);
    if (data.nextClaimInMs <= 0) return;
    const id = window.setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1000;
        if (next <= 0) {
          window.clearInterval(id);
          queryClient.invalidateQueries({ queryKey: ["ayadi-balance"] });
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [data, queryClient]);

  const mineMutation = useMutation({
    mutationFn: () => mine(accessToken!),
    onSuccess: (res) => {
      if (res.claimed) {
        toast.success(
          t("ayadi.successToast", {
            reward: (res.reward ?? 0).toFixed(3),
            balance: res.balance.toFixed(3),
          }),
        );
      } else {
        toast.message(t("ayadi.cooldownToast"));
      }
      setRemaining(res.nextClaimInMs);
      queryClient.invalidateQueries({ queryKey: ["ayadi-balance"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const canMine = remaining <= 0 && !mineMutation.isPending;

  const dateLocale = i18n.language === "ar" ? "ar-SA" : "en-US";
  const formattedDate = useMemo(
    () =>
      new Intl.DateTimeFormat(dateLocale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [dateLocale],
  );

  if (!session) {
    return (
      <div className="glass-card relative overflow-hidden rounded-3xl p-6 text-center">
        <img
          src={ayadiTokenImg}
          alt="Ayadi Token"
          className="mx-auto mb-3 size-16 rounded-full object-contain drop-shadow-[0_4px_12px_rgba(217,165,32,0.4)]"
        />
        <h3 className="text-lg font-bold">{t("ayadi.title")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("ayadi.loginRequired")}
        </p>
      </div>
    );
  }

  const balance = data?.balance ?? 0;
  const claims = data?.claims ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card relative overflow-hidden rounded-3xl p-6"
    >
      {/* Decorative gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -end-16 size-48 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, oklch(0.85 0.18 85) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -start-20 size-56 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, oklch(0.72 0.18 65) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex items-center gap-3">
        <img
          src={ayadiTokenImg}
          alt="Ayadi Token"
          className="size-14 rounded-full object-contain drop-shadow-[0_4px_10px_rgba(217,165,32,0.45)]"
        />
        <div className="flex-1">
          <h3 className="text-base font-bold">{t("ayadi.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("ayadi.subtitle")}</p>
        </div>
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("ayadi.currentBalance")}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className="text-4xl font-extrabold"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, oklch(0.78 0.18 80), oklch(0.55 0.18 50))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {isLoading ? "—" : balance.toFixed(3)}
            </span>
            <span className="text-sm font-semibold text-amber-600">AYADI</span>
          </div>
        </div>
        {remaining > 0 && (
          <div className="text-end">
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" /> {t("ayadi.nextIn")}
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-amber-700">
              {formatRemaining(remaining)}
            </p>
          </div>
        )}
      </div>

      <div className="relative mt-5">
        <Button
          onClick={() => mineMutation.mutate()}
          disabled={!canMine}
          className={cn(
            "group relative w-full rounded-2xl py-6 text-base font-bold text-white shadow-lg transition-all",
            canMine
              ? "hover:scale-[1.01] hover:shadow-xl"
              : "cursor-not-allowed opacity-60",
          )}
          style={{
            background: canMine
              ? "linear-gradient(135deg, oklch(0.78 0.18 80), oklch(0.55 0.19 45))"
              : "linear-gradient(135deg, oklch(0.7 0.05 80), oklch(0.5 0.05 60))",
          }}
        >
          {mineMutation.isPending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Pickaxe
              className={cn(
                "size-5 transition-transform",
                canMine && "group-hover:-rotate-12",
              )}
            />
          )}
          {canMine
            ? t("ayadi.mineButton")
            : t("ayadi.mineCooldown", { time: formatRemaining(remaining) })}
          {canMine && <Sparkles className="size-4" />}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {t("ayadi.rewardHint", { amount: "0.002" })}
        </p>
      </div>

      {/* History */}
      <div className="relative mt-6">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <Sparkles className="size-4 text-amber-500" />
          {t("ayadi.historyTitle")}
        </h4>
        {claims.length === 0 ? (
          <p className="rounded-2xl bg-muted/50 p-4 text-center text-xs text-muted-foreground">
            {t("ayadi.historyEmpty")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {claims.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-xs"
              >
                <span className="text-muted-foreground">
                  {formattedDate.format(new Date(c.claimed_at))}
                </span>
                <span className="font-bold text-amber-600">
                  +{c.amount.toFixed(3)} AYADI
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}