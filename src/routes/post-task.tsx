import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageTransition } from "@/components/layout/PageTransition";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import { CATEGORY_KEYS } from "@/lib/supabase/types";
import { fireConfetti } from "@/lib/confetti";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/post-task")({
  head: () => ({
    meta: [
      { title: "أيادي — انشر مهمة" },
      { name: "description", content: "انشر مهمتك واحصل على عروض من المستقلين خلال دقائق." },
    ],
  }),
  component: PostTask,
});

function PostTask() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = usePiAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "design",
    description: "",
    budget: "",
    location: "",
    deadline: "",
  });

  const totalSteps = 3;
  const update = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const next = () => setStep((s) => Math.min(totalSteps, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    if (!session) {
      toast.error(t("auth.piRequiredMessage"));
      navigate({ to: "/auth" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/tasks-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: session.accessToken,
          task: {
            title: form.title,
            description: form.description,
            category: form.category,
            budget: Number(form.budget) || 0,
            location: form.location,
            deadline: form.deadline,
          },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Failed (${res.status})`);
      }
      // Refresh listings so the new task appears immediately.
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      fireConfetti();
      toast.success(t("post.published"));
      setTimeout(() => navigate({ to: "/" }), 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12 md:ps-24">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold gradient-text md:text-4xl">{t("post.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("post.subtitle")}</p>
        </div>

        {/* Progress */}
        <div className="glass-card mb-6 rounded-3xl p-5">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((n, i) => (
              <div key={n} className="flex flex-1 items-center">
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all",
                    n <= step
                      ? "gradient-brand text-white shadow"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {n < step ? <Check className="size-4" /> : n}
                </div>
                {i < 2 && (
                  <div className="relative mx-2 h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={false}
                      animate={{ width: step > n ? "100%" : "0%" }}
                      transition={{ duration: 0.4 }}
                      className="absolute inset-y-0 start-0 gradient-brand"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span className={cn(step >= 1 && "font-semibold text-foreground")}>{t("post.step1")}</span>
            <span className={cn(step >= 2 && "font-semibold text-foreground")}>{t("post.step2")}</span>
            <span className={cn(step >= 3 && "font-semibold text-foreground")}>{t("post.step3")}</span>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {step === 1 && (
                <>
                  <Field label={t("post.taskTitle")}>
                    <Input
                      value={form.title}
                      onChange={(e) => update("title", e.target.value)}
                      placeholder={t("post.taskTitlePh")}
                      className="h-12 rounded-xl"
                    />
                  </Field>
                  <Field label={t("post.category")}>
                    <Select value={form.category} onValueChange={(v) => update("category", v)}>
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                    {CATEGORY_KEYS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {t(`categories.${c}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t("task.description")}>
                    <Textarea
                      value={form.description}
                      onChange={(e) => update("description", e.target.value)}
                      placeholder={t("post.descriptionPh")}
                      rows={5}
                      className="rounded-xl"
                    />
                  </Field>
                </>
              )}
              {step === 2 && (
                <>
                  <Field label={`${t("task.budget")} (${t("common.currency")})`}>
                    <Input
                      type="number"
                      value={form.budget}
                      onChange={(e) => update("budget", e.target.value)}
                      placeholder={t("post.budgetPh")}
                      className="h-12 rounded-xl"
                    />
                  </Field>
                  <Field label={t("task.location")}>
                    <Input
                      value={form.location}
                      onChange={(e) => update("location", e.target.value)}
                      placeholder={t("post.locationPh")}
                      className="h-12 rounded-xl"
                    />
                  </Field>
                  <Field label={t("task.deadline")}>
                    <Input
                      value={form.deadline}
                      onChange={(e) => update("deadline", e.target.value)}
                      placeholder={t("post.deadlinePh")}
                      className="h-12 rounded-xl"
                    />
                  </Field>
                </>
              )}
              {step === 3 && (
                <div className="space-y-3">
                  <Review label={t("post.taskTitle")} value={form.title || "—"} />
                  <Review label={t("post.category")} value={t(`categories.${form.category}`)} />
                  <Review label={t("task.description")} value={form.description || "—"} />
                  <Review label={t("task.budget")} value={`${form.budget || "—"} ${t("common.currency")}`} />
                  <Review label={t("task.location")} value={form.location || "—"} />
                  <Review label={t("task.deadline")} value={form.deadline || "—"} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={back}
              disabled={step === 1}
              className="rounded-full"
            >
              <ArrowLeft className="size-4 rtl:rotate-180" />
              {t("common.back")}
            </Button>
            {step < totalSteps ? (
              <Button onClick={next} className="rounded-full gradient-brand text-white">
                {t("common.next")}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            ) : (
              <Button
                onClick={submit}
                disabled={submitting}
                size="lg"
                className="rounded-full gradient-brand text-white shadow-lg shadow-primary/40"
              >
                {submitting && <Loader2 className="me-2 size-4 animate-spin" />}
                {t("post.publishTask")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
    </div>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-background/40 p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-end">{value}</span>
    </div>
  );
}