import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageTransition } from "@/components/layout/PageTransition";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import { taskQueryOptions } from "@/lib/supabase/queries";
import { CATEGORY_KEYS } from "@/lib/supabase/types";
import { COUNTRIES } from "@/lib/data/countries";

export const Route = createFileRoute("/tasks/$taskId/edit")({
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(taskQueryOptions(params.taskId));
  },
  component: EditTaskPage,
});

function EditTaskPage() {
  const { taskId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = usePiAuth();
  const { data: task } = useSuspenseQuery(taskQueryOptions(taskId));

  const [form, setForm] = useState({
    title: "",
    category: "design",
    description: "",
    budget: "",
    location: "",
    deadline: "",
    country: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [guarded, setGuarded] = useState(false);

  // Hydrate form from current task data.
  useEffect(() => {
    if (!task) return;
    setForm({
      title: task.title ?? "",
      category: task.category ?? "design",
      description: task.description ?? "",
      budget: task.budget != null ? String(task.budget) : "",
      location: task.location ?? "",
      deadline: task.deadline ?? "",
      country: task.country ?? "",
    });
  }, [task]);

  // Guard: only owner + open status may access.
  useEffect(() => {
    if (guarded || !task) return;
    const isOwner = !!session && session.user.uid === task.owner_pi_uid;
    if (!isOwner) {
      toast.error(t("task.cannotEditOrDelete"));
      router.navigate({ to: "/tasks/$taskId", params: { taskId } });
      setGuarded(true);
      return;
    }
    if (task.status !== "open") {
      toast.error(t("task.cannotEditOrDelete"));
      router.navigate({ to: "/tasks/$taskId", params: { taskId } });
      setGuarded(true);
    }
  }, [task, session, guarded, taskId, router, t]);

  if (!task) return null;

  const update = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!session) {
      toast.error(t("auth.piRequiredMessage"));
      router.navigate({ to: "/auth" });
      return;
    }
    if (!form.title.trim() || !form.description.trim()) {
      toast.error(t("post.taskTitle") + " / " + t("task.description"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/tasks-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: session.accessToken,
          taskId,
          task: {
            title: form.title,
            description: form.description,
            category: form.category,
            budget: Number(form.budget) || 0,
            location: form.location,
            deadline: form.deadline,
            country: form.country || null,
          },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        const base = body.error || "تعذّر تحديث المهمة";
        const msg = body.details ? `${base} — ${body.details}` : base;
        throw new Error(msg);
      }
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
      toast.success(t("task.updateSuccess"));
      router.navigate({ to: "/tasks/$taskId", params: { taskId } });
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
        <Link
          to="/tasks/$taskId"
          params={{ taskId }}
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t("common.back")}
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-extrabold gradient-text md:text-4xl">
            {t("task.editPageTitle")}
          </h1>
        </div>

        <div className="glass-card space-y-4 rounded-3xl p-6 md:p-8">
          <Field label={t("post.taskTitle")}>
            <Input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder={t("post.taskTitlePh")}
              className="h-12 rounded-xl"
            />
          </Field>
          <Field label={t("post.category")}>
            <Select
              value={form.category}
              onValueChange={(v) => update("category", v)}
            >
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
          <Field label={t("post.country")}>
            <Select
              value={form.country}
              onValueChange={(v) => update("country", v)}
            >
              <SelectTrigger className="h-12 rounded-xl">
                <SelectValue placeholder={t("post.country")} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {isAr ? c.ar : c.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("task.deadline")}>
            <Input
              value={form.deadline}
              onChange={(e) => update("deadline", e.target.value)}
              placeholder={t("post.deadlinePh")}
              className="h-12 rounded-xl"
            />
          </Field>

          <div className="flex justify-end gap-3 pt-4">
            <Link to="/tasks/$taskId" params={{ taskId }}>
              <Button variant="ghost" className="rounded-full">
                {t("common.cancel")}
              </Button>
            </Link>
            <Button
              onClick={submit}
              disabled={submitting}
              size="lg"
              className="rounded-full gradient-brand text-white shadow-lg shadow-primary/40"
            >
              {submitting ? (
                <Loader2 className="me-2 size-4 animate-spin" />
              ) : (
                <Save className="me-2 size-4" />
              )}
              {submitting ? t("task.saving") : t("task.saveChanges")}
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
    </div>
  );
}
