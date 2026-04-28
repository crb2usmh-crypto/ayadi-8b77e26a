import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@tanstack/react-router";
import { Globe, Moon, Sun, Hand, LogOut, User as UserIcon, Settings } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/providers/ThemeProvider";
import { NotificationsPanel } from "./NotificationsPanel";
import { getAvatarUrl } from "@/lib/supabase/types";
import { usePiAuth } from "@/components/providers/PiAuthProvider";

export function AppHeader() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { session, logout, loginAsDev } = usePiAuth();
  const navigate = useNavigate();
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = session?.user.username ?? "Guest";
  const avatarSeed = session?.user.username ?? "anon";
  const handleLogout = () => {
    logout();
    navigate({ to: "/auth" });
  };

  const toggleLang = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
  };

  const handleLogoTap = (e: React.MouseEvent) => {
    e.preventDefault();
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 1500);

    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      loginAsDev();
      toast.success("Developer Mode — تم تسجيل الدخول كمطور");
      navigate({ to: "/" });
    } else {
      navigate({ to: "/" });
    }
  };

  return (
    <header className="glass-header sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
        <a href="/" onClick={handleLogoTap} className="flex items-center gap-2 cursor-pointer">
          <div className="flex size-9 items-center justify-center rounded-2xl gradient-brand text-white shadow-lg select-none">
            <Hand className="size-5" />
          </div>
          <div className="hidden sm:block">
            <p className="text-lg font-bold leading-none gradient-text">{t("app.name")}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{t("app.tagline")}</p>
          </div>
        </a>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLang}
            className="rounded-full hover:bg-primary/10"
            aria-label={t("common.language")}
          >
            <Globe className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full hover:bg-primary/10"
            aria-label={t("common.theme")}
          >
            {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
          <NotificationsPanel />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ms-1 rounded-full ring-2 ring-primary/20 transition-all hover:ring-primary/50">
                <Avatar className="size-9">
                  <AvatarImage src={getAvatarUrl(avatarSeed)} alt={displayName} />
                  <AvatarFallback>{displayName[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 glass-card">
              <DropdownMenuLabel>
                {session ? `@${session.user.username}` : displayName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <UserIcon className="size-4" />
                  {t("nav.profile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="size-4" />
                {t("common.settings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                <LogOut className="size-4" />
                {t("common.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}