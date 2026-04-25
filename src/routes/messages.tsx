import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/layout/PageTransition";
import { mockConversations, getAvatarUrl } from "@/lib/mockData";
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
              {mockConversations.map((c) => {
                const text = rtl ? c.lastMessage : c.lastMessageEn;
                const isActive = location.pathname === `/messages/${c.id}`;
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
                      <AvatarImage src={getAvatarUrl(c.participant.avatarSeed)} />
                      <AvatarFallback>{c.participant.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold">{c.participant.name}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{c.lastAt}</span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{text}</p>
                    </div>
                    {c.unread > 0 && (
                      <Badge className="size-5 shrink-0 justify-center rounded-full p-0 text-[10px]">
                        {c.unread}
                      </Badge>
                    )}
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