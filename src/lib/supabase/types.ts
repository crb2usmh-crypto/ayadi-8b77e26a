/**
 * Database row types matching the schema in
 * supabase/migrations/.../init_ayadi_schema.sql (delivered to the user
 * as /mnt/documents/ayadi_init_schema.sql for one-time execution).
 */

export type TaskCategory =
  | "design"
  | "development"
  | "writing"
  | "delivery"
  | "cleaning"
  | "tutoring"
  | "marketing"
  | "other";

export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";

export type NotificationType = "offer" | "message" | "task" | "system";

export type BidStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface ProfileRow {
  id: string;
  pi_uid: string;
  username: string;
  display_name: string | null;
  avatar_seed: string | null;
  rating: number;
  completed_tasks: number;
  published_tasks: number;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  owner_pi_uid: string;
  title: string;
  title_en: string | null;
  description: string;
  description_en: string | null;
  category: TaskCategory;
  budget: number;
  location: string | null;
  location_en: string | null;
  deadline: string | null;
  deadline_en: string | null;
  image_seed: string | null;
  status: TaskStatus;
  offers_count: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
  /** Set when an offer is accepted. */
  accepted_bid_id: string | null;
  /** pi_uid of the freelancer who got the task. */
  assignee_pi_uid: string | null;
}

/** Task joined with its owner profile (returned by list/detail queries). */
export interface TaskWithOwner extends TaskRow {
  owner: ProfileRow | null;
}

export interface NotificationRow {
  id: string;
  recipient_pi_uid: string;
  type: NotificationType;
  title: string;
  title_en: string | null;
  body: string;
  body_en: string | null;
  read: boolean;
  created_at: string;
}

// ---------- Marketplace ---------------------------------------------

export interface BidRow {
  id: string;
  task_id: string;
  bidder_pi_uid: string;
  amount: number;
  message: string | null;
  status: BidStatus;
  created_at: string;
  updated_at: string;
}

/** A bid joined with its bidder's profile (returned by bids-list). */
export interface BidWithBidder extends BidRow {
  bidder: ProfileRow | null;
}

export interface ConversationRow {
  id: string;
  task_id: string;
  bid_id: string;
  owner_pi_uid: string;
  bidder_pi_uid: string;
  last_message_at: string | null;
  created_at: string;
}

/** Conversation with both participants and the related task title. */
export interface ConversationWithDetails extends ConversationRow {
  task: Pick<TaskRow, "id" | "title" | "title_en" | "image_seed"> | null;
  owner: ProfileRow | null;
  bidder: ProfileRow | null;
  last_message: string | null;
  last_sender_pi_uid: string | null;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_pi_uid: string;
  body: string;
  created_at: string;
}

export const CATEGORY_KEYS: TaskCategory[] = [
  "design",
  "development",
  "writing",
  "delivery",
  "cleaning",
  "tutoring",
  "marketing",
  "other",
];

/** Public helpers for avatar/image URLs (no DB call required). */
export function getAvatarUrl(seed: string | null | undefined, size = 96): string {
  const safe = seed && seed.length > 0 ? seed : "anon";
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(safe)}&size=${size}`;
}

export function getTaskImage(seed: string | null | undefined, w = 800, h = 500): string {
  const safe = seed && seed.length > 0 ? seed : "task";
  return `https://picsum.photos/seed/${encodeURIComponent(safe)}/${w}/${h}`;
}