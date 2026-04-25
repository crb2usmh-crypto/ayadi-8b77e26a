import { useTranslation } from "react-i18next";
import { Bell, MessageCircle, Briefcase, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockNotifications, type MockNotification } from "@/lib/mockData";
import { isRtl } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const ICONS: Record<MockNotification["type"], React.ElementType> = {
  offer: Briefcase,
  message: MessageCircle,
  task: Sparkles,
  system: Bell,
};

export function NotificationsPanel() {
  const { t, i18n } = useTranslation();
  const rtl = isRtl(i18n.language);
  const unread = mockNotifications.filter((n) => !n.read).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-primary/10">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
              {unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side={rtl ? "left" : "right"} className="glass-card border-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold gradient-text">
            {t("notifications.title")}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-3 overflow-y-auto pb-6">
          {mockNotifications.map((n) => {
            const Icon = ICONS[n.type];
            const title = rtl ? n.title : n.titleEn;
            const body = rtl ? n.body : n.bodyEn;
            return (
              <div
                key={n.id}
                className={cn(
                  "group flex gap-3 rounded-2xl border p-4 transition-all hover:scale-[1.01] hover:shadow-md",
                  n.read ? "border-border/50 bg-card/40" : "border-primary/30 bg-primary/5",
                )}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{title}</p>
                    {!n.read && <Badge className="h-5 px-1.5 text-[10px]">جديد</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">{n.createdAt}</p>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}