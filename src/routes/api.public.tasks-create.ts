import { createFileRoute } from "@tanstack/react-router";

/**
 * Creates a new task on behalf of the authenticated Pi user.
 * The caller must include their Pi access token; we verify it with the
 * Pi Platform and use the returned uid as `owner_pi_uid`.
 *
 * Body: {
 *   accessToken: string,
 *   task: {
 *     title: string, description: string, category: string,
 *     budget: number, location?: string, deadline?: string
 *   }
 * }
 */

const VALID_CATEGORIES = [
  "design",
  "development",
  "writing",
  "delivery",
  "cleaning",
  "tutoring",
  "marketing",
  "other",
] as const;

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export const Route = createFileRoute("/api/public/tasks-create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ---- 1. Parse + validate input ----
        let body: { accessToken?: unknown; task?: Record<string, unknown> };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const accessToken =
          typeof body.accessToken === "string" ? body.accessToken.trim() : "";
        if (!accessToken || accessToken.length > 4096) {
          return Response.json({ error: "Missing accessToken" }, { status: 400 });
        }

        const t = body.task ?? {};
        const title = clampStr(t.title, 200);
        const description = clampStr(t.description, 4000);
        const categoryRaw = typeof t.category === "string" ? t.category : "other";
        const category = (VALID_CATEGORIES as readonly string[]).includes(categoryRaw)
          ? categoryRaw
          : "other";
        const budgetNum = Number(t.budget);
        const budget = Number.isFinite(budgetNum) && budgetNum >= 0 ? budgetNum : 0;
        const location = clampStr(t.location, 200);
        const deadline = clampStr(t.deadline, 200);

        if (!title || !description) {
          return Response.json(
            { error: "Title and description are required" },
            { status: 400 },
          );
        }

        // ---- 2. Verify Pi token ----
        let piUid: string;
        let username: string;
        try {
          const piRes = await fetch("https://api.minepi.com/v2/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (piRes.status === 401) {
            return Response.json({ error: "Pi authentication failed" }, { status: 401 });
          }
          if (!piRes.ok) {
            return Response.json(
              { error: "Authentication service unavailable" },
              { status: 502 },
            );
          }
          const json = (await piRes.json()) as { uid?: string; username?: string };
          if (!json?.uid || !json?.username) {
            return Response.json({ error: "Invalid Pi user payload" }, { status: 502 });
          }
          piUid = json.uid;
          username = json.username;
        } catch (err) {
          console.error("[pi-verify] error:", err); const message = "Authentication failed";
          return Response.json({ error: message }, { status: 500 });
        }

        // ---- 3. Insert via service-role ----
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json(
            { error: "Service temporarily unavailable" },
            { status: 500 },
          );
        }

        try {
          // Ensure profile exists (so the FK on tasks.owner_pi_uid resolves).
          await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=pi_uid`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              Prefer: "resolution=merge-duplicates,return=minimal",
            },
            body: JSON.stringify([
              {
                pi_uid: piUid,
                username,
                avatar_seed: username,
                updated_at: new Date().toISOString(),
              },
            ]),
          });

          // Insert the task.
          const insertRes = await fetch(`${supabaseUrl}/rest/v1/tasks`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              Prefer: "return=representation",
            },
            body: JSON.stringify([
              {
                owner_pi_uid: piUid,
                title,
                description,
                category,
                budget,
                location,
                deadline,
                image_seed: title.slice(0, 32),
              },
            ]),
          });

          if (!insertRes.ok) {
            const detail = await insertRes.text();
            console.error("[tasks-create] insert failed:", insertRes.status, detail);
            return Response.json(
              { error: "Failed to create task" },
              { status: 500 },
            );
          }

          const rows = (await insertRes.json()) as unknown[];
          return Response.json({ task: Array.isArray(rows) ? rows[0] : null });
        } catch (err) {
          console.error("[tasks-create] error:", err);
          const message = "Server error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});