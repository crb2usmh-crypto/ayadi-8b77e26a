import { useTranslation } from "react-i18next";
import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, Search, Plus, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", icon: Home, labelKey: "nav.home" },
  { to: "/tasks", icon: Search, labelKey: "nav.search" },
  { to: "/post-task", icon: Plus, labelKey: "nav.post", primary: true },
  { to: "/messages", icon: MessageCircle, labelKey: "nav.messages" },
  { to: "/profile", icon: User, labelKey: "nav.profile" },
];

export function BottomNavigation() {
  const { t } = useTranslation();
  const location = useLocation();
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <nav className="glass-header fixed bottom-0 inset-x-0 z-40 md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);

          if (item.primary) {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative -mt-6 flex size-14 items-center justify-center rounded-full gradient-brand text-white shadow-xl shadow-primary/40 transition-transform active:scale-95"
              >
                <Plus className="size-6" />
              </Link>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              {active && (
                <motion.span
                  layoutId="bottom-active"
                  className="absolute -top-0.5 inset-x-4 h-0.5 rounded-full gradient-brand"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}