import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Rocket, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import type { TaskWithOwner } from "@/lib/supabase/types";

const COST = 1;

export function BoostTaskButton({ task }: { task: TaskWithOwner }) {
  const { t } = useTranslation();
  const { session } = usePiAuth();
  const qc = useQueryClient();

  const boosted =
    task.boosted_until && new Date(task.boosted_until).getTime() > Date.now();

  const boost = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("login");
      const res = await fetch("/api/public/task-boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.accessToken, taskId: task.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Boost failed");
      return body;
    },
    onSuccess: () => {
      toast.success(t("boost.success"));
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["ayadi-balance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (boosted) {
    return (
      <div className="flex items-center justify-center gap-1 text-xs text-amber-600">
        <CheckCircle2 className="size-3" />
        {t("boost.active")}
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => boost.mutate()}
      disabled={boost.isPending}
      className="rounded-full text-xs"
    >
      {boost.isPending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Rocket className="size-3" />
      )}
      {t("boost.button", { cost: COST.toString() })}
    </Button>
  );
}