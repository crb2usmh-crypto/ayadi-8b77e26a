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