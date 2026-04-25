import { useTranslation } from "react-i18next";
import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, Search, PlusCircle, MessageCircle, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { isRtl } from "@/lib/i18n/config";

type NavItem = {
  to: string;
  icon: React.ElementType;
  labelKey: string;
  highlight?: boolean;
};

const items: NavItem[] = [
  { to: "/", icon: Home, labelKey: "nav.home" },
  { to: "/tasks", icon: Search, labelKey: "nav.search" },
  { to: "/post-task", icon: PlusCircle, labelKey: "nav.post", highlight: true },
  { to: "/messages", icon: MessageCircle, labelKey: "nav.messages" },
  { to: "/profile", icon: User, labelKey: "nav.profile" },
];

export function FloatingSidebar() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const rtl = isRtl(i18n.language);
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <aside
      className={cn(
        "fixed top-1/2 z-30 hidden -translate-y-1/2 md:flex",
        rtl ? "right-4" : "left-4",
      )}
    >
      <motion.nav
        initial={{ opacity: 0, x: rtl ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="glass-card flex flex-col items-center gap-2 rounded-full p-2"
      >
        {items.map((item, idx) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + idx * 0.05, duration: 0.3 }}
              className="group relative"
            >
              <Link
                to={item.to}
                className={cn(
                  "relative flex size-12 items-center justify-center rounded-full transition-all duration-300",
                  item.highlight && !active && "gradient-brand text-white shadow-lg hover:scale-110",
                  active && "gradient-brand text-white shadow-lg",
                  !item.highlight && !active && "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                )}
              >
                <Icon className="size-5" />
                {active && (
                  <motion.span
                    layoutId="floating-active-glow"
                    className="absolute inset-0 -z-10 rounded-full bg-primary/30 blur-md"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
              {/* Tooltip */}
              <span
                className={cn(
                  "pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100",
                  rtl ? "right-full me-3 group-hover:-translate-x-1" : "left-full ms-3 group-hover:translate-x-1",
                )}
              >
                {t(item.labelKey)}
              </span>
            </motion.div>
          );
        })}
      </motion.nav>
    </aside>
  );
}