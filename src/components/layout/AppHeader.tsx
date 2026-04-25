import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Globe, Moon, Sun, Hand, LogOut, User as UserIcon, Settings } from "lucide-react";
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
import { currentUser, getAvatarUrl } from "@/lib/mockData";

export function AppHeader() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const toggleLang = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
  };

  return (
    <header className="glass-header sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-2xl gradient-brand text-white shadow-lg">
            <Hand className="size-5" />
          </div>
          <div className="hidden sm:block">
            <p className="text-lg font-bold leading-none gradient-text">{t("app.name")}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{t("app.tagline")}</p>
          </div>
        </Link>

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
                  <AvatarImage src={getAvatarUrl(currentUser.avatarSeed)} alt={currentUser.name} />
                  <AvatarFallback>YOU</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 glass-card">
              <DropdownMenuLabel>{currentUser.name}</DropdownMenuLabel>
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
              <DropdownMenuItem asChild>
                <Link to="/auth/login" className="cursor-pointer">
                  <LogOut className="size-4" />
                  {t("common.logout")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}