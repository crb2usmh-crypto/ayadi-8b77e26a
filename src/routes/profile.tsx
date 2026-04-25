import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Star, Edit3, Award, ListChecks, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskCard } from "@/components/common/TaskCard";
import { PageTransition } from "@/components/layout/PageTransition";
import { currentUser, getAvatarUrl, mockTasks } from "@/lib/mockData";

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
  const myTasks = mockTasks.slice(0, 3);

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12 md:ps-24">
        {/* Profile header */}
        <div className="glass-card relative overflow-hidden rounded-3xl">
          <div className="h-32 gradient-brand md:h-40" />
          <div className="px-6 pb-6">
            <div className="-mt-12 flex flex-col items-center gap-4 md:-mt-14 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col items-center gap-3 md:flex-row md:items-end">
                <Avatar className="size-24 ring-4 ring-background shadow-xl md:size-28">
                  <AvatarImage src={getAvatarUrl(currentUser.avatarSeed, 160)} />
                  <AvatarFallback>YOU</AvatarFallback>
                </Avatar>
                <div className="text-center md:text-start md:pb-2">
                  <h1 className="text-2xl font-bold">{currentUser.name}</h1>
                  <div className="mt-1 flex items-center justify-center gap-1 text-sm md:justify-start">
                    <Star className="size-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{currentUser.rating}</span>
                    <Badge variant="secondary" className="ms-2 rounded-full">
                      <Award className="me-1 size-3" /> Pro
                    </Badge>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="rounded-full bg-background/60 backdrop-blur">
                <Edit3 className="size-4" />
                {t("profile.edit")}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatCard icon={ListChecks} label={t("profile.completedTasks")} value={String(currentUser.completedTasks)} />
          <StatCard icon={Award} label={t("profile.publishedTasks")} value="14" />
          <StatCard icon={Star} label={t("profile.rating")} value={currentUser.rating.toFixed(1)} />
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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {myTasks.map((task, i) => (
                <TaskCard key={task.id} task={task} index={i} />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="offers" className="mt-6">
            <EmptyMsg icon={MessageSquare} text={t("profile.emptyOffers")} />
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            <EmptyMsg icon={Star} text={t("profile.emptyReviews")} />
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