import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type {
  NotificationRow,
  ProfileRow,
  TaskCategory,
  TaskRow,
  TaskWithOwner,
} from "./types";

// ---------- Tasks ----------------------------------------------------

/** Fetch all tasks with their owner profile. Newest first. */
async function fetchTasks(): Promise<TaskWithOwner[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(`*, owner:profiles!tasks_owner_pi_uid_fkey(*)`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  // Supabase types the joined column as ProfileRow|null already.
  return (data ?? []) as TaskWithOwner[];
}

export const tasksQueryOptions = () =>
  queryOptions({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    staleTime: 30_000,
  });

/** Fetch a single task by id (with owner). Returns null if not found. */
async function fetchTaskById(id: string): Promise<TaskWithOwner | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select(`*, owner:profiles!tasks_owner_pi_uid_fkey(*)`)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as TaskWithOwner | null) ?? null;
}

export const taskQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["tasks", id],
    queryFn: () => fetchTaskById(id),
    staleTime: 30_000,
  });

// ---------- Profiles -------------------------------------------------

async function fetchProfileByPiUid(piUid: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("pi_uid", piUid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ProfileRow | null) ?? null;
}

export const profileQueryOptions = (piUid: string | null | undefined) =>
  queryOptions({
    queryKey: ["profile", piUid ?? "anon"],
    queryFn: () => (piUid ? fetchProfileByPiUid(piUid) : Promise.resolve(null)),
    enabled: !!piUid,
    staleTime: 60_000,
  });

/** Fetch tasks owned by a given pi_uid (for the profile page). */
async function fetchTasksByOwner(piUid: string): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("owner_pi_uid", piUid)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as TaskRow[];
}

export const tasksByOwnerQueryOptions = (piUid: string | null | undefined) =>
  queryOptions({
    queryKey: ["tasks", "byOwner", piUid ?? "anon"],
    queryFn: () => (piUid ? fetchTasksByOwner(piUid) : Promise.resolve([])),
    enabled: !!piUid,
    staleTime: 30_000,
  });

// ---------- Notifications -------------------------------------------
// Direct SELECT on `notifications` is denied by RLS. We fetch through
// a server route that verifies the caller's Pi access token.

async function fetchNotifications(accessToken: string): Promise<NotificationRow[]> {
  const res = await fetch("/api/public/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load notifications (${res.status})`);
  }
  const json = (await res.json()) as { notifications: NotificationRow[] };
  return json.notifications ?? [];
}

export const notificationsQueryOptions = (accessToken: string | null | undefined) =>
  queryOptions({
    queryKey: ["notifications", accessToken ? "auth" : "anon"],
    queryFn: () => (accessToken ? fetchNotifications(accessToken) : Promise.resolve([])),
    enabled: !!accessToken,
    staleTime: 15_000,
  });

// ---------- Helpers --------------------------------------------------

export type CategoryFilter = TaskCategory | "all";

export function filterTasks(
  tasks: TaskWithOwner[],
  query: string,
  category: CategoryFilter,
): TaskWithOwner[] {
  const q = query.trim().toLowerCase();
  return tasks.filter((task) => {
    const inCategory = category === "all" || task.category === category;
    if (!inCategory) return false;
    if (!q) return true;
    return (
      task.title.toLowerCase().includes(q) ||
      (task.title_en?.toLowerCase().includes(q) ?? false)
    );
  });
}