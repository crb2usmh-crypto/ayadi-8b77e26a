import { useLocation, useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "./AppHeader";
import { FloatingSidebar } from "./FloatingSidebar";
import { BottomNavigation } from "./BottomNavigation";
import { GradientOrbs } from "./GradientOrbs";
import { DevFooter } from "./DevFooter";
import { cn } from "@/lib/utils";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import { profileQueryOptions } from "@/lib/supabase/queries";
import { useTranslation } from "react-i18next";

function getPageBgClass(pathname: string) {
  if (pathname.startsWith("/tasks")) return "bg-gradient-page-tasks";
  if (pathname.startsWith("/post-task")) return "bg-gradient-page-tasks";
  if (pathname.startsWith("/profile")) return "bg-gradient-page-profile";
  if (pathname.startsWith("/auth")) return "bg-gradient-page-auth";
  if (pathname.startsWith("/messages")) return "bg-gradient-page-detail";
  return "bg-gradient-page-home";
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = usePiAuth();
  const { i18n } = useTranslation();
  const isAuth = location.pathname.startsWith("/auth");
  const isOnboarding = location.pathname.startsWith("/onboarding");
  const bgClass = getPageBgClass(location.pathname);

  const piUid = session?.user.uid ?? null;
  const { data: profile, isLoading: profileLoading } = useQuery(
    profileQueryOptions(piUid),
  );

  // Gate the entire app behind Pi authentication.
  useEffect(() => {
    if (!session && !isAuth) {
      navigate({ to: "/auth", replace: true });
    }
  }, [session, isAuth, navigate]);

  // Onboarding gate: signed-in users must complete their profile.
  useEffect(() => {
    if (!session || profileLoading) return;
    const onboarded = !!profile?.onboarded_at;
    if (!onboarded && !isOnboarding && !isAuth) {
      navigate({ to: "/onboarding", replace: true });
    } else if (onboarded && isOnboarding) {
      navigate({ to: "/", replace: true });
    }
  }, [session, profile, profileLoading, isOnboarding, isAuth, navigate]);

  // Apply persisted language preference once.
  useEffect(() => {
    const pref = profile?.preferred_lang;
    if (pref && (pref === "ar" || pref === "en") && pref !== i18n.language) {
      i18n.changeLanguage(pref);
      try {
        window.localStorage.setItem("ayadi-lang", pref);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.preferred_lang]);

  if (!session && !isAuth) return null;

  return (
    <div className={cn("relative min-h-screen", bgClass)}>
      <GradientOrbs />
      {!isAuth && !isOnboarding && <AppHeader />}
      {!isAuth && !isOnboarding && <FloatingSidebar />}
      <AnimatePresence mode="wait">
        <main
          key={location.pathname}
          className={cn("relative", !isAuth && !isOnboarding && "pb-24 md:pb-8")}
        >
          {children}
        </main>
      </AnimatePresence>
      {!isAuth && !isOnboarding && <BottomNavigation />}
      <DevFooter />
    </div>
  );
}