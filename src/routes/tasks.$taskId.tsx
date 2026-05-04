import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Users, Wallet, Star, CheckCircle2, Inbox, Loader2, MessageCircle, Flag } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageTransition } from "@/components/layout/PageTransition";
import { bidsForTaskQueryOptions, conversationsQueryOptions, reviewsForTaskQueryOptions, taskQueryOptions } from "@/lib/supabase/queries";
import { getAvatarUrl, getTaskImage } from "@/lib/supabase/types";
import type { BidWithBidder, ConversationWithDetails } from "@/lib/supabase/types";
import { isRtl } from "@/lib/i18n/config";
import { fireConfetti } from "@/lib/confetti";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import { ReviewForm } from "@/components/common/ReviewForm";
import { ReviewsList } from "@/components/common/ReviewsList";

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
  const { session } = usePiAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [amount, setAmount] = useState<string>("");
  const [message, setMessage] = useState<string>("");
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

  const isLoggedIn = !!session;
  const isOwner = !!session && session.user.uid === task.owner_pi_uid;
  const isOpen = task.status === "open";
  const canBid = isLoggedIn && !isOwner && isOpen;
  const isAssignee =
    !!session && task.assignee_pi_uid === session.user.uid;
  const canChat =
    isLoggedIn &&
    task.status === "in_progress" &&
    (isOwner || isAssignee);
  const isCompleted = task.status === "completed";
  const canReview = isLoggedIn && isCompleted && (isOwner || isAssignee);
  const otherPartyUid = isOwner
    ? task.assignee_pi_uid
    : isAssignee
      ? task.owner_pi_uid
      : null;

  // Find the conversation tied to this task (only loaded when relevant).
  const { data: conversations = [] } = useQuery({
    ...conversationsQueryOptions(session?.accessToken),
    enabled: !!session && canChat,
  });
  const taskConversation = conversations.find(
    (c: ConversationWithDetails) => c.task_id === task.id,
  );

  const createBid = useMutation({
  mutationFn: async () => {
    if (!session) throw new Error(t("task.loginToBid"));
    const res = await fetch("/api/public/bids-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  accessToken: session.accessToken,
  taskId: String(task.id),
  bidderPiUid: session.user.uid,   // ← تأكد من وجود هذا السطر
  amount: Number(amount),
  message: message.trim() || undefined,
}),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed (${res.status})`);
    }
    return res.json();
  },
  onSuccess: () => {
    setOpen(false);
    setMessage("");
    fireConfetti();
    toast.success(t("task.offerSent"));
    queryClient.invalidateQueries({ queryKey: ["bids", task.id] });
    router.invalidate();
  },
  onError: (err: Error) => {
    toast.error(err.message);
  },
});

  const handleSubmitOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      toast.error(t("task.loginToBid"));
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error(t("task.yourPrice"));
      return;
    }
    createBid.mutate();
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

            {/* Owner-only: bids list */}
            {isOwner && (
              <BidsSection taskId={task.id} taskStatus={task.status} accessToken={session!.accessToken} />
            )}

            {/* Reviews section — visible to participants of completed tasks */}
            {canReview && otherPartyUid && (
              <ReviewSection
                taskId={task.id}
                accessToken={session!.accessToken}
                revieweePiUid={otherPartyUid}
              />
            )}
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

            {/* Status badge */}
            <div className="glass-card rounded-3xl p-3 text-center text-sm">
              <span className="text-muted-foreground">{t("task.taskStatus." + task.status)}</span>
            </div>

            {/* Complete-task button — owner-only, in_progress only */}
            {isLoggedIn && isOwner && task.status === "in_progress" && (
              <CompleteTaskButton taskId={task.id} accessToken={session!.accessToken} />
            )}

            {/* Chat button (in_progress only, owner or assignee) */}
            {canChat && (
              taskConversation ? (
                <Link
                  to="/messages/$conversationId"
                  params={{ conversationId: taskConversation.id }}
                >
                  <Button
                    size="lg"
                    className="w-full rounded-full gradient-brand text-white shadow-lg shadow-primary/40"
                  >
                    <MessageCircle className="me-2 size-5" />
                    {t("task.openChat")}
                  </Button>
                </Link>
              ) : (
                <div className="glass-card rounded-3xl p-3 text-center text-xs text-muted-foreground">
                  {t("task.chatNotReady")}
                </div>
              )
            )}

            {/* CTA area */}
            {canBid && (
              <Dialog
                open={open}
                onOpenChange={(next) => {
                  setOpen(next);
                  if (next && !amount) setAmount(String(task.budget));
                }}
              >
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
                          min={1}
                          required
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
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
                        placeholder={t("task.messagePlaceholder")}
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={createBid.isPending}
                        className="w-full rounded-full gradient-brand text-white"
                      >
                        {createBid.isPending ? (
                          <>
                            <Loader2 className="me-2 size-4 animate-spin" />
                            {t("task.submitting")}
                          </>
                        ) : (
                          t("task.submitOffer")
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}

            {!isLoggedIn && (
              <div className="glass-card rounded-3xl p-4 text-center text-sm">
                <p className="mb-3 text-muted-foreground">{t("task.loginToBid")}</p>
                <Link to="/auth">
                  <Button size="sm" className="rounded-full gradient-brand text-white">
                    {t("task.loginNow")}
                  </Button>
                </Link>
              </div>
            )}

            {isLoggedIn && isOwner && (
              <div className="glass-card rounded-3xl p-4 text-center text-xs text-muted-foreground">
                {t("task.ownTaskHint")}
              </div>
            )}

            {isLoggedIn && !isOwner && !isOpen && (
              <div className="glass-card rounded-3xl p-4 text-center text-xs text-muted-foreground">
                {t("task.taskClosed")}
              </div>
            )}
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

// ---------- Complete-task button (owner-only) ----------

function CompleteTaskButton({
  taskId,
  accessToken,
}: {
  taskId: string;
  accessToken: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();

  const complete = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/public/tasks-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, taskId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      fireConfetti();
      toast.success(t("task.completeSuccess"));
      queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
      router.invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="lg"
          variant="outline"
          disabled={complete.isPending}
          className="w-full rounded-full"
        >
          {complete.isPending ? (
            <>
              <Loader2 className="me-2 size-4 animate-spin" />
              {t("task.completing")}
            </>
          ) : (
            <>
              <Flag className="me-2 size-4" />
              {t("task.completeTask")}
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="glass-card border-0">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("task.completeConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("task.completeConfirmDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => complete.mutate()}
            className="rounded-full gradient-brand text-white"
          >
            {t("task.completeTask")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------- Review section ----------

function ReviewSection({
  taskId,
  accessToken,
  revieweePiUid,
}: {
  taskId: string;
  accessToken: string;
  revieweePiUid: string;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery(
    reviewsForTaskQueryOptions(taskId, accessToken),
  );

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold gradient-text">{t("review.sectionTitle")}</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 className="me-2 size-4 animate-spin" />
        </div>
      ) : data?.myReviewSubmitted ? (
        <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {t("review.alreadyReviewed")}
        </p>
      ) : (
        <ReviewForm
          taskId={taskId}
          accessToken={accessToken}
          revieweePiUid={revieweePiUid}
        />
      )}

      {data && data.reviews.length > 0 && (
        <div className="mt-6 border-t border-border/50 pt-4">
          <ReviewsList reviews={data.reviews} />
        </div>
      )}
    </div>
  );
}

// ---------- Bids section (owner-only) ----------

function BidsSection({
  taskId,
  taskStatus,
  accessToken,
}: {
  taskId: string;
  taskStatus: string;
  accessToken: string;
}) {
  const { t } = useTranslation();
  const { data: bids, isLoading } = useQuery(bidsForTaskQueryOptions(taskId, accessToken));

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{t("task.offersSection")}</h2>
          <p className="text-xs text-muted-foreground">{t("task.offersSectionHint")}</p>
        </div>
        <Badge variant="secondary" className="rounded-full">
          {bids?.length ?? 0}
        </Badge>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="me-2 size-4 animate-spin" />
          {t("task.loadingOffers")}
        </div>
      )}

      {!isLoading && (!bids || bids.length === 0) && (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
          <Inbox className="size-10 opacity-50" />
          <p className="text-sm">{t("task.noOffers")}</p>
        </div>
      )}

      {!isLoading && bids && bids.length > 0 && (
        <ul className="space-y-3">
          {bids.map((bid) => (
            <BidCard key={bid.id} bid={bid} taskId={taskId} taskStatus={taskStatus} accessToken={accessToken} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BidCard({
  bid,
  taskId,
  taskStatus,
  accessToken,
}: {
  bid: BidWithBidder;
  taskId: string;
  taskStatus: string;
  accessToken: string;
}) {
  const { t, i18n } = useTranslation();
  const rtl = isRtl(i18n.language);
  const queryClient = useQueryClient();
  const router = useRouter();
  const bidderName = bid.bidder?.display_name || bid.bidder?.username || "—";
  const bidderSeed = bid.bidder?.avatar_seed || bid.bidder?.username || "anon";
  const bidderRating = bid.bidder?.rating ?? 0;

  const accept = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/public/bids-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, bidId: bid.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      fireConfetti();
      toast.success(t("task.acceptSuccess"));
      queryClient.invalidateQueries({ queryKey: ["bids", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
      router.invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusVariant: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    withdrawn: "bg-muted text-muted-foreground",
  };

  const showAccept = bid.status === "pending" && taskStatus === "open";

  return (
    <li className="rounded-2xl border border-border/50 bg-background/60 p-4 transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start gap-3">
        <Avatar className="size-12 ring-2 ring-primary/10">
          <AvatarImage src={getAvatarUrl(bidderSeed, 80)} />
          <AvatarFallback>{bidderName[0]}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{bidderName}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="size-3 fill-yellow-400 text-yellow-400" />
                {Number(bidderRating).toFixed(1)}
                <span>·</span>
                <span>
                  {new Date(bid.created_at).toLocaleDateString(rtl ? "ar" : "en")}
                </span>
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusVariant[bid.status] ?? ""}`}>
              {t(`task.bidStatus.${bid.status}`)}
              {bid.status === "accepted" && <CheckCircle2 className="ms-1 inline size-3" />}
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-extrabold gradient-text">{bid.amount}</span>
            <span className="text-xs text-muted-foreground">{t("common.currency")}</span>
          </div>

          {bid.message && (
            <p className="mt-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
              {bid.message}
            </p>
          )}

          {showAccept && (
            <div className="mt-3 flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={accept.isPending}
                    className="rounded-full gradient-brand text-white"
                  >
                    {accept.isPending ? (
                      <>
                        <Loader2 className="me-2 size-3 animate-spin" />
                        {t("task.accepting")}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="me-1 size-4" />
                        {t("task.acceptOffer")}
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-card border-0">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("task.acceptConfirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("task.acceptConfirmDesc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full">{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => accept.mutate()}
                      className="rounded-full gradient-brand text-white"
                    >
                      {t("task.acceptOffer")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
