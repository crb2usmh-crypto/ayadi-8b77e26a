import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TaskCard } from "@/components/common/TaskCard";
import { PageTransition } from "@/components/layout/PageTransition";
import { tasksQueryOptions, filterTasks } from "@/lib/supabase/queries";
import { CATEGORY_KEYS, type TaskCategory } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tasks/")({
  head: () => ({
    meta: [
      { title: "أيادي — تصفح المهام" },
      { name: "description", content: "تصفح أحدث المهام المتاحة في منصة أيادي." },
    ],
  }),
  loader: ({ context: { queryClient } }) => {
    queryClient.ensureQueryData(tasksQueryOptions());
  },
  component: TasksList,
});

function TasksList() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<TaskCategory | "all">("all");
  const [sortBy, setSortBy] = useState<"recent" | "budget">("recent");
  const { data: tasks = [], isLoading, error } = useQuery(tasksQueryOptions());

  let filtered = filterTasks(tasks, query, activeCategory);
  if (sortBy === "budget") {
    filtered = [...filtered].sort((a, b) => b.budget - a.budget);
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12 md:ps-24">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold gradient-text md:text-4xl">{t("nav.tasks")}</h1>
          <p className="mt-2 text-muted-foreground">{t("home.heroSubtitle")}</p>
        </div>

        <div className="glass-card mb-6 rounded-3xl p-4">
          <div className="flex items-center gap-2 rounded-full bg-background/40 p-2">
            <Search className="ms-2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("common.search")}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="scrollbar-hide -mx-2 mt-3 flex gap-2 overflow-x-auto px-2">
            <Chip active={activeCategory === "all"} onClick={() => setActiveCategory("all")}>
              {t("categories.all")}
            </Chip>
            {CATEGORY_KEYS.map((c) => (
              <Chip key={c} active={activeCategory === c} onClick={() => setActiveCategory(c)}>
                {t(`categories.${c}`)}
              </Chip>
            ))}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Chip active={sortBy === "recent"} onClick={() => setSortBy("recent")}>
              الأحدث
            </Chip>
            <Chip active={sortBy === "budget"} onClick={() => setSortBy("budget")}>
              الأعلى أجراً
            </Chip>
          </div>
        </div>

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
      </div>
    </PageTransition>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
        active
          ? "gradient-brand border-transparent text-white shadow"
          : "border-border bg-background/30 text-foreground hover:bg-primary/10",
      )}
    >
      {children}
    </button>
  );
}