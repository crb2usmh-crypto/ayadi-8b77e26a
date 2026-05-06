import { createFileRoute, useParams, useRouter, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2, Save, ArrowLeft } from "lucide-react";
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
  const { taskId } = useParams({ from: "/tasks/$taskId/edit" });
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = usePiAuth();
  const { data: task } = useSuspenseQuery(taskQueryOptions(taskId));

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [budget, setBudget] = useState(String(task?.budget ?? ""));
  const [location, setLocation] = useState(task?.location ?? "");
  const [deadline, setDeadline] = useState(task?.deadline ?? "");
  const [category, setCategory] = useState(task?.category ?? "");
  const [country, setCountry] = useState(task?.country ?? "DZ");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/public/tasks-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: session!.accessToken,
          taskId: String(taskId),
          task: {
            title: title.trim(),
            description: description.trim(),
            budget: Number(budget),
            location: location.trim(),
            deadline: deadline.trim(),
            category: category.trim(),
            country: country.trim(),
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `حدث خطأ`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("task.updateSuccess"));
      queryClient.invalidateQueries({ queryKey: ["tasks", String(taskId)] });
      router.navigate({ to: `/tasks/$taskId`, params: { taskId: String(taskId) } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      toast.error(t("task.loginToBid"));
      return;
    }
    updateMutation.mutate();
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 pb-16 md:px-8 md:ps-24">
        <Link
          to="/tasks/$taskId"
          params={{ taskId: String(taskId) }}
          className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" /> العودة
        </Link>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <h1 className="text-2xl font-black gradient-text">تعديل المهمة</h1>

          <div>
            <label className="mb-1.5 block text-sm font-medium">العنوان</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="rounded-xl" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">الوصف</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} required className="rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">الميزانية (Pi)</label>
              <Input type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} required className="rounded-xl" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">الموعد النهائي</label>
              <Input type="text" placeholder="مثلاً: 2026/05/10" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="rounded-xl" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">الفئة</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر فئة" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_KEYS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`categories.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">الموقع</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} className="rounded-xl" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">الدولة</label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر الدولة" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={updateMutation.isPending} className="rounded-full gradient-brand text-white">
              {updateMutation.isPending ? (
                <><Loader2 className="me-2 size-4 animate-spin" /> جارٍ الحفظ</>
              ) : (
                <><Save className="me-2 size-4" /> حفظ التعديلات</>
              )}
            </Button>
            <Link to="/tasks/$taskId" params={{ taskId: String(taskId) }}>
              <Button variant="outline" type="button" className="rounded-full">إلغاء</Button>
            </Link>
          </div>
        </form>
      </div>
    </PageTransition>
  );
}
