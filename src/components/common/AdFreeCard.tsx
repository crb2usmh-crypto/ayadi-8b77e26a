import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ShieldOff, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import { useAdFreeStatus } from "@/lib/ads";
import { createPiPayment } from "@/lib/piClient";

const PRICE = 0.01;

export function AdFreeCard() {
  const { t, i18n } = useTranslation();
  const { session } = usePiAuth();
  const qc = useQueryClient();
  const { data } = useAdFreeStatus();

  const subscribe = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("login required");
      await createPiPayment(
        {
          amount: PRICE,
          memo: "Ayadi Ad-Free (30 days)",
          metadata: { purpose: "ads_subscription" },
        },
        {
          onApprove: async (paymentId) => {
            const r = await fetch("/api/public/payment-approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accessToken: session.accessToken,
                paymentId,
                purpose: "ads_subscription",
              }),
            });
            if (!r.ok) {
              const b = await r.json().catch(() => ({}));
              throw new Error(b.error || "Approve failed");
            }
          },
          onComplete: async (paymentId, txid) => {
            const r = await fetch("/api/public/payment-complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accessToken: session.accessToken,
                paymentId,
                txid,
                purpose: "ads_subscription",
              }),
            });
            if (!r.ok) {
              const b = await r.json().catch(() => ({}));
              throw new Error(b.error || "Complete failed");
            }
          },
        },
      );
    },
    onSuccess: () => {
      toast.success(t("adFree.success"));
      qc.invalidateQueries({ queryKey: ["ads-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!session) return null;
  const active = data?.adFree;
  const expires = data?.expiresAt ? new Date(data.expiresAt) : null;
  const dateFmt = new Intl.DateTimeFormat(i18n.language === "ar" ? "ar-SA" : "en-US", {
    dateStyle: "medium",
  });

  return (
    <div className="glass-card rounded-3xl p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          {active ? <CheckCircle2 className="size-5" /> : <ShieldOff className="size-5" />}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold">{t("adFree.title")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {active && expires
              ? t("adFree.activeUntil", { date: dateFmt.format(expires) })
              : t("adFree.subtitle", { price: PRICE.toString() })}
          </p>
        </div>
      </div>
      {!active && (
        <Button
          onClick={() => subscribe.mutate()}
          disabled={subscribe.isPending}
          className="mt-4 w-full rounded-full gradient-brand text-white"
        >
          {subscribe.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldOff className="size-4" />
          )}
          {t("adFree.subscribeButton", { price: PRICE.toString() })}
        </Button>
      )}
    </div>
  );
}