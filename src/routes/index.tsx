import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/common/TaskCard";
import { PageTransition } from "@/components/layout/PageTransition";
import { AyadiMiner } from "@/components/common/AyadiMiner";
import { tasksQueryOptions, filterTasks } from "@/lib/supabase/queries";
import { CATEGORY_KEYS, type TaskCategory } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "أيادي — الرئيسية" },
      {
        name: "description",
        content: "اكتشف آلاف المهام المتاحة، أو انشر مهمتك واحصل على عروض من المستقلين.",
      },
    ],
  }),
  loader: ({ context: { queryClient } }) => {
    queryClient.ensureQueryData(tasksQueryOptions());
  },
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<TaskCategory | "all">("all");
  const { data: tasks = [], isLoading, error } = useQuery(tasksQueryOptions());

  const filtered = filterTasks(tasks, query, activeCategory);
  const featured = tasks.filter((task) => task.featured);

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12 md:ps-24">
        {/* HERO */}
        <section className="relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full glass-card px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              {t("app.tagline")}
            </div>
            <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">
              <span className="gradient-text">{t("home.heroTitle")}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              {t("home.heroSubtitle")}
            </p>

            {/* Search bar */}
            <div className="mx-auto mt-8 flex max-w-2xl items-center gap-2 rounded-full glass-card p-2 shadow-xl">
              <Search className="ms-3 size-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.search")}
                className="flex-1 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
              />
              <Button asChild className="rounded-full gradient-brand text-white shadow-md">
                <Link to="/tasks">
                  {t("home.browseTasks")}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </Link>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="rounded-full gradient-brand text-white shadow-lg shadow-primary/30">
                <Link to="/post-task">{t("home.postTask")}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full border-primary/30 bg-white/40 backdrop-blur">
                <Link to="/tasks">{t("home.browseTasks")}</Link>
              </Button>
            </div>
          </motion.div>
        </section>

        {/* Ayadi token mining */}
        <section className="mx-auto mt-10 max-w-2xl">
          <AyadiMiner />
        </section>

        {/* Categories */}
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold">{t("home.categories")}</h2>
          <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            <CategoryChip
              active={activeCategory === "all"}
              label={t("categories.all")}
              onClick={() => setActiveCategory("all")}
            />
            {CATEGORY_KEYS.map((cat) => (
              <CategoryChip
                key={cat}
                active={activeCategory === cat}
                label={t(`categories.${cat}`)}
                onClick={() => setActiveCategory(cat)}
              />
            ))}
          </div>
        </section>

        {/* Featured */}
        {activeCategory === "all" && !query && featured.length > 0 && (
          <section className="mt-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{t("home.featured")}</h2>
              <Sparkles className="size-5 text-accent" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((task, i) => (
                <TaskCard key={task.id} task={task} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Latest */}
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold">
            {query || activeCategory !== "all" ? t("nav.tasks") : t("home.latest")}
          </h2>
          {error ? (
            <div className="glass-card rounded-3xl py-16 text-center text-destructive">
              {error.message}
            </div>
          ) : isLoading ? (
            <div className="glass-card flex items-center justify-center gap-2 rounded-3xl py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card rounded-3xl py-16 text-center text-muted-foreground">
              {t("common.noResults")}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((task, i) => (
                <TaskCard key={task.id} task={task} index={i} />
              ))}
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all",
        active
          ? "gradient-brand border-transparent text-white shadow-md"
          : "glass-card text-foreground hover:scale-105 hover:bg-primary/10",
      )}
    >
      {label}
    </button>
  );
}