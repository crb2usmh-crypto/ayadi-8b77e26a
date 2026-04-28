import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, LogIn } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageTransition } from "@/components/layout/PageTransition";
import { conversationsQueryOptions } from "@/lib/supabase/queries";
import { getAvatarUrl } from "@/lib/supabase/types";
import type { ConversationWithDetails } from "@/lib/supabase/types";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import { isRtl } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [{ title: "أيادي — الرسائل" }],
  }),
  component: MessagesLayout,
});

function MessagesLayout() {
  const { t, i18n } = useTranslation();
  const rtl = isRtl(i18n.language);
  const location = useLocation();
  const hasActiveChat = /^\/messages\/.+/.test(location.pathname);
  const { session } = usePiAuth();
  const accessToken = session?.accessToken;
  const myUid = session?.user.uid;

  const { data: conversations = [], isLoading } = useQuery(
    conversationsQueryOptions(accessToken),
  );

  return (
    <PageTransition>
      <div className="mx-auto h-[calc(100vh-8rem)] max-w-7xl px-4 py-6 md:px-8 md:ps-24">
        <div className="glass-card flex h-full overflow-hidden rounded-3xl">
          {/* Conversations list */}
          <aside
            className={cn(
              "w-full md:w-80 md:border-e",
              hasActiveChat && "hidden md:block",
            )}
          >
            <div className="border-b p-4">
              <h2 className="text-xl font-bold gradient-text">{t("messages.title")}</h2>
            </div>
            <div className="overflow-y-auto">
              {!session && (
                <div className="flex flex-col items-center gap-3 p-8 text-center text-muted-foreground">
                  <LogIn className="size-10 opacity-50" />
                  <p className="text-sm">{t("messages.loginRequired")}</p>
                  <Link
                    to="/auth"
                    className="rounded-full gradient-brand px-4 py-2 text-xs font-medium text-white"
                  >
                    {t("auth.login")}
                  </Link>
                </div>
              )}
              {session && isLoading && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {t("common.loading")}
                </div>
              )}
              {session && !isLoading && conversations.length === 0 && (
                <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
                  <MessageCircle className="size-10 opacity-50" />
                  <p className="text-sm">{t("messages.empty")}</p>
                </div>
              )}
              {session &&
                conversations.map((c: ConversationWithDetails) => {
                  const isOwnerSide = c.owner_pi_uid === myUid;
                  const other = isOwnerSide ? c.bidder : c.owner;
                  const otherName =
                    other?.display_name || other?.username || "—";
                  const taskTitle = rtl
                    ? c.task?.title ?? ""
                    : c.task?.title_en ?? c.task?.title ?? "";
                  const isActive = location.pathname === `/messages/${c.id}`;
                  const lastAt = c.last_message_at
                    ? new Date(c.last_message_at).toLocaleDateString(
                        rtl ? "ar" : "en",
                        { month: "short", day: "numeric" },
                      )
                    : "";
                  return (
                    <Link
                      key={c.id}
                      to="/messages/$conversationId"
                      params={{ conversationId: c.id }}
                      className={cn(
                        "flex items-center gap-3 border-b px-4 py-3 transition-colors hover:bg-primary/5",
                        isActive && "bg-primary/10",
                      )}
                    >
                      <Avatar className="size-11">
                        <AvatarImage
                          src={getAvatarUrl(other?.avatar_seed || other?.username)}
                        />
                        <AvatarFallback>{otherName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-semibold">{otherName}</p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {lastAt}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {taskTitle}
                        </p>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </aside>

          {/* Chat area */}
          <div
            className={cn(
              "flex-1 flex-col",
              hasActiveChat ? "flex" : "hidden md:flex",
            )}
          >
            <Outlet />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}