import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSuspenseQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Users, Wallet, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageTransition } from "@/components/layout/PageTransition";
import { taskQueryOptions } from "@/lib/supabase/queries";
import { getAvatarUrl, getTaskImage } from "@/lib/supabase/types";
import { isRtl } from "@/lib/i18n/config";
import { fireConfetti } from "@/lib/confetti";

export const Route = createFileRoute("/tasks/$taskId")({
  loader: async ({ params, context: { queryClient } }) => {
    const task = await queryClient.ensureQueryData(taskQueryOptions(params.taskId));
    if (!task) throw notFound();
  },
  notFoundComponent: () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold">المهمة غير موجودة</h2>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          العودة للرئيسية
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => {
    const router = useRouter();
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center">
        <div>
          <p className="text-destructive">{error.message}</p>
          <button
            onClick={() => router.invalidate()}
            className="mt-4 rounded-full gradient-brand px-4 py-2 text-sm text-white"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  },
  component: TaskDetail,
});

function TaskDetail() {
  const { taskId } = Route.useParams();
  const { data: task } = useSuspenseQuery(taskQueryOptions(taskId));
  const { t, i18n } = useTranslation();
  const rtl = isRtl(i18n.language);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, 80]);
  const heroScale = useTransform(scrollY, [0, 400], [1, 1.15]);

  if (!task) return null; // satisfied by loader notFound, but keeps TS happy

  const title = rtl ? task.title : task.title_en ?? task.title;
  const description = rtl ? task.description : task.description_en ?? task.description;
  const location = rtl ? task.location ?? "—" : task.location_en ?? task.location ?? "—";
  const deadline = rtl ? task.deadline ?? "—" : task.deadline_en ?? task.deadline ?? "—";
  const ownerName = task.owner?.display_name || task.owner?.username || "—";
  const ownerSeed = task.owner?.avatar_seed || task.owner?.username || "anon";
  const ownerRating = task.owner?.rating ?? 0;
  const ownerCompleted = task.owner?.completed_tasks ?? 0;

  const handleSubmitOffer = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    setTimeout(() => {
      fireConfetti();
      toast.success(t("task.offerSent"));
    }, 200);
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 pb-16 md:px-8 md:ps-24">
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t("common.back")}
        </Link>

        {/* Hero with parallax */}
        <div className="relative mt-4 h-64 overflow-hidden rounded-3xl shadow-2xl md:h-80">
          <motion.img
            src={getTaskImage(task.image_seed, 1600, 800)}
            alt={title}
            style={{ y: heroY, scale: heroScale }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 p-6 text-white">
            <Badge className="mb-2 rounded-full bg-white/20 backdrop-blur">
              {t(`categories.${task.category}`)}
            </Badge>
            <h1 className="text-2xl font-extrabold leading-tight md:text-4xl">{title}</h1>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Stat icon={Wallet} label={t("task.budget")} value={`${task.budget} ${t("common.currency")}`} />
              <Stat icon={MapPin} label={t("task.location")} value={location} />
              <Stat icon={Clock} label={t("task.deadline")} value={deadline} />
            </div>

            {/* Description */}
            <div className="glass-card rounded-3xl p-6">
              <h2 className="mb-3 text-lg font-bold">{t("task.description")}</h2>
              <p className="leading-relaxed text-muted-foreground">{description}</p>
            </div>

            {/* Stats line */}
            <div className="glass-card flex items-center justify-between rounded-3xl p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" />
                {task.offers_count} {t("task.offers")}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(task.created_at).toLocaleDateString(rtl ? "ar" : "en")}
              </div>
            </div>
          </div>

          {/* Sidebar — publisher + apply */}
          <aside className="space-y-4">
            <div className="glass-card rounded-3xl p-6 text-center">
              <p className="text-xs uppercase text-muted-foreground">{t("task.publisher")}</p>
              <Avatar className="mx-auto mt-3 size-20 ring-4 ring-primary/20">
                <AvatarImage src={getAvatarUrl(ownerSeed, 120)} />
                <AvatarFallback>{ownerName[0]}</AvatarFallback>
              </Avatar>
              <p className="mt-3 font-semibold">{ownerName}</p>
              <div className="mt-1 flex items-center justify-center gap-1 text-sm">
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{Number(ownerRating).toFixed(1)}</span>
                <span className="text-muted-foreground">
                  · {ownerCompleted} {t("profile.completedTasks")}
                </span>
              </div>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  className="w-full rounded-full gradient-brand text-white shadow-lg shadow-primary/40 hover:scale-[1.02]"
                >
                  {t("task.applyNow")}
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-0 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl gradient-text">{t("task.applyTitle")}</DialogTitle>
                  <DialogDescription>{title}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitOffer} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{t("task.yourPrice")}</label>
                    <div className="relative">
                      <Input
                        type="number"
                        required
                        defaultValue={task.budget}
                        className="rounded-xl pe-14"
                      />
                      <span className="absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {t("common.currency")}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{t("task.yourMessage")}</label>
                    <Textarea
                      required
                      placeholder={t("task.messagePlaceholder")}
                      rows={4}
                      className="rounded-xl"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full rounded-full gradient-brand text-white">
                      {t("task.submitOffer")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </aside>
        </div>
      </div>
    </PageTransition>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-card flex flex-col items-center gap-1 rounded-2xl p-4 text-center">
      <Icon className="size-5 text-primary" />
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}