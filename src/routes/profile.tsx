import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Star, Edit3, Award, ListChecks, MessageSquare, Loader2, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskCard } from "@/components/common/TaskCard";
import { PageTransition } from "@/components/layout/PageTransition";
import { AyadiMiner } from "@/components/common/AyadiMiner";
import { AdFreeCard } from "@/components/common/AdFreeCard";
import { BoostTaskButton } from "@/components/common/BoostTaskButton";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import { supabase } from "@/lib/supabaseClientNew";
import { compressImage } from "@/lib/image-compress";
import {
  profileQueryOptions,
  reviewsForUserQueryOptions,
  tasksByOwnerQueryOptions,
} from "@/lib/supabase/queries";
import { resolveAvatar, type TaskWithOwner } from "@/lib/supabase/types";
import { ReviewsList } from "@/components/common/ReviewsList";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "أيادي — الملف الشخصي" },
      { name: "description", content: "ملفك الشخصي على منصة أيادي." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const { session } = usePiAuth();
  const piUid = session?.user.uid ?? null;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery(
    profileQueryOptions(piUid),
  );
  const { data: ownTasks = [], isLoading: tasksLoading } = useQuery(
    tasksByOwnerQueryOptions(piUid),
  );
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery(
    reviewsForUserQueryOptions(piUid),
  );

  // Promote bare TaskRow → TaskWithOwner shape for TaskCard.
  const myTasks: TaskWithOwner[] = ownTasks.map((task) => ({
    ...task,
    owner: profile ?? null,
  }));

  if (!session) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-md px-4 py-16 text-center md:ps-24">
          <h1 className="text-2xl font-bold gradient-text">{t("profile.title")}</h1>
          <p className="mt-3 text-muted-foreground">
            {t("auth.piRequiredMessage")}
          </p>
          <Button asChild className="mt-6 rounded-full gradient-brand text-white">
            <Link to="/auth">{t("auth.piSignIn")}</Link>
          </Button>
        </div>
      </PageTransition>
    );
  }

  if (profileLoading) {
    return (
      <PageTransition>
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </PageTransition>
    );
  }

  // Fallback display values when the profile row hasn't been created yet
  // (the server upserts it on first sign-in / first task creation).
  const displayName =
    profile?.display_name || profile?.username || session.user.username;
  const avatarSrc = resolveAvatar(profile, session.user.username, 160);
  const reviewsCount = reviewsData?.count ?? 0;
  const reviewAverage = reviewsData?.average ?? Number(profile?.rating ?? 0);
  const rating = Number(reviewAverage).toFixed(1);
  const completed = profile?.completed_tasks ?? 0;
  const published = profile?.published_tasks ?? ownTasks.length;

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !session) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("onboarding.avatarUploadFailed"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("onboarding.avatarUploadFailed"));
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxSize: 512, quality: 0.82 });
      const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      const path = `${session.user.uid}-${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true, contentType: compressed.type });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const res = await fetch("/api/public/profile-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: session.accessToken,
          profile: { avatar_url: publicUrl },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || t("onboarding.avatarUploadFailed"));
      }
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("onboarding.avatarUploaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboarding.avatarUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12 md:ps-24">
        {/* Profile header */}
        <div className="glass-card relative overflow-hidden rounded-3xl">
          <div className="h-32 gradient-brand md:h-40" />
          <div className="px-6 pb-6">
            <div className="-mt-12 flex flex-col items-center gap-4 md:-mt-14 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col items-center gap-3 md:flex-row md:items-end">
                <div className="relative">
                  <Avatar className="size-24 ring-4 ring-background shadow-xl md:size-28">
                    <AvatarImage src={avatarSrc} />
                    <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={handleAvatarPick}
                    disabled={uploading}
                    className="absolute bottom-0 end-0 inline-flex size-9 items-center justify-center rounded-full gradient-brand text-white shadow-lg ring-2 ring-background transition hover:scale-105 disabled:opacity-60"
                    aria-label={t("onboarding.uploadAvatar")}
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div className="text-center md:text-start md:pb-2">
                  <h1 className="text-2xl font-bold">{displayName}</h1>
                  <div className="mt-1 flex items-center justify-center gap-1 text-sm md:justify-start">
                    <Star className="size-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{rating}</span>
                    <span className="text-muted-foreground">
                      ({reviewsCount} {t("profile.reviewsCount")})
                    </span>
                    <Badge variant="secondary" className="ms-2 rounded-full">
                      <Award className="me-1 size-3" /> Pro
                    </Badge>
                  </div>
                </div>
              </div>
              <Button asChild variant="outline" className="rounded-full bg-background/60 backdrop-blur">
                <Link to="/profile/edit">
                  <Edit3 className="size-4" />
                  {t("profile.edit")}
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatCard icon={ListChecks} label={t("profile.completedTasks")} value={String(completed)} />
          <StatCard icon={Award} label={t("profile.publishedTasks")} value={String(published)} />
          <StatCard icon={Star} label={t("profile.rating")} value={rating} />
        </div>

        {/* Ayadi token mining */}
        <div className="mt-6">
          <AyadiMiner />
        </div>

        {/* Ad-Free subscription */}
        <div className="mt-6">
          <AdFreeCard />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tasks" className="mt-8">
          <TabsList className="glass-card grid w-full grid-cols-3 rounded-full p-1">
            <TabsTrigger value="tasks" className="rounded-full data-[state=active]:gradient-brand data-[state=active]:text-white">
              {t("profile.tabs.tasks")}
            </TabsTrigger>
            <TabsTrigger value="offers" className="rounded-full data-[state=active]:gradient-brand data-[state=active]:text-white">
              {t("profile.tabs.offers")}
            </TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-full data-[state=active]:gradient-brand data-[state=active]:text-white">
              {t("profile.tabs.reviews")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-6">
            {tasksLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : myTasks.length === 0 ? (
              <EmptyMsg icon={ListChecks} text={t("profile.emptyTasks")} />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {myTasks.map((task, i) => (
                  <div key={task.id} className="flex flex-col gap-2">
                    <TaskCard task={task} index={i} />
                    <BoostTaskButton task={task} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="offers" className="mt-6">
            <EmptyMsg icon={MessageSquare} text={t("profile.emptyOffers")} />
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            {reviewsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : !reviewsData || reviewsData.reviews.length === 0 ? (
              <EmptyMsg icon={Star} text={t("profile.emptyReviews")} />
            ) : (
              <ReviewsList reviews={reviewsData.reviews} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}

function StatCard({
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
      <p className="text-2xl font-extrabold gradient-text">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyMsg({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-3xl py-16 text-center text-muted-foreground">
      <Icon className="size-10 opacity-50" />
      <p>{text}</p>
    </div>
  );
}