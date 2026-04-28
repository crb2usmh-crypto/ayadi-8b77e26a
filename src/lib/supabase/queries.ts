import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type {
  BidWithBidder,
  ConversationWithDetails,
  MessageRow,
  NotificationRow,
  ProfileRow,
  TaskCategory,
  TaskRow,
  TaskWithOwner,
} from "./types";

// ---------- Tasks ----------------------------------------------------

/** Fetch all tasks with their owner profile. Newest first. */
async function fetchTasks(): Promise<TaskWithOwner[]> {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return await attachOwners((tasks ?? []) as TaskRow[]);
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
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const [withOwner] = await attachOwners([data as TaskRow]);
  return withOwner ?? null;
}

/**
 * Attach owner profile to tasks via a separate query.
 * Avoids relying on a PostgREST FK relationship name between
 * tasks.owner_pi_uid and profiles.pi_uid (which may not exist
 * as a declared foreign key in the schema cache).
 */
async function attachOwners(tasks: TaskRow[]): Promise<TaskWithOwner[]> {
  if (tasks.length === 0) return [];
  const uids = Array.from(new Set(tasks.map((t) => t.owner_pi_uid).filter(Boolean)));
  if (uids.length === 0) {
    return tasks.map((t) => ({ ...t, owner: null }));
  }
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .in("pi_uid", uids);
  const map = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.pi_uid, p]),
  );
  return tasks.map((t) => ({ ...t, owner: map.get(t.owner_pi_uid) ?? null }));
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

// ---------- Bids -----------------------------------------------------

async function fetchBidsForTask(
  taskId: string,
  accessToken: string,
): Promise<BidWithBidder[]> {
  const res = await fetch("/api/public/bids-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, taskId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load offers (${res.status})`);
  }
  const json = (await res.json()) as { bids: BidWithBidder[] };
  return json.bids ?? [];
}

export const bidsForTaskQueryOptions = (
  taskId: string,
  accessToken: string | null | undefined,
) =>
  queryOptions({
    queryKey: ["bids", taskId, accessToken ? "auth" : "anon"],
    queryFn: () =>
      accessToken ? fetchBidsForTask(taskId, accessToken) : Promise.resolve([]),
    enabled: !!accessToken,
    staleTime: 10_000,
  });

// ---------- Conversations -------------------------------------------

async function fetchConversations(
  accessToken: string,
): Promise<ConversationWithDetails[]> {
  const res = await fetch("/api/public/conversations-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load conversations (${res.status})`);
  }
  const json = (await res.json()) as { conversations: ConversationWithDetails[] };
  return json.conversations ?? [];
}

export const conversationsQueryOptions = (accessToken: string | null | undefined) =>
  queryOptions({
    queryKey: ["conversations", accessToken ? "auth" : "anon"],
    queryFn: () =>
      accessToken ? fetchConversations(accessToken) : Promise.resolve([]),
    enabled: !!accessToken,
    staleTime: 15_000,
  });

// ---------- Single conversation + messages --------------------------
// Reads go through a server route that verifies the caller is one of the
// two conversation participants (owner or bidder) via their Pi access
// token. The `conversations` and `messages` tables are NOT directly
// readable from the browser anon key.

async function fetchConversationAndMessages(
  id: string,
  accessToken: string,
): Promise<{
  conversation: ConversationWithDetails | null;
  messages: MessageRow[];
}> {
  const res = await fetch("/api/public/messages-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, conversationId: id }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load conversation (${res.status})`);
  }
  const json = (await res.json()) as {
    conversation: ConversationWithDetails | null;
    messages: MessageRow[];
  };
  return {
    conversation: json.conversation ?? null,
    messages: json.messages ?? [],
  };
}

export const conversationBundleQueryOptions = (
  id: string,
  accessToken: string | null | undefined,
) =>
  queryOptions({
    queryKey: ["conversation-bundle", id, accessToken ? "auth" : "anon"],
    queryFn: () =>
      accessToken
        ? fetchConversationAndMessages(id, accessToken)
        : Promise.resolve({ conversation: null, messages: [] }),
    enabled: !!accessToken,
    staleTime: 0,
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