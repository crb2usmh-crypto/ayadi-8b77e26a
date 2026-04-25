import { useLocation, useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { FloatingSidebar } from "./FloatingSidebar";
import { BottomNavigation } from "./BottomNavigation";
import { GradientOrbs } from "./GradientOrbs";
import { cn } from "@/lib/utils";
import { usePiAuth } from "@/components/providers/PiAuthProvider";

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
  const isAuth = location.pathname.startsWith("/auth");
  const bgClass = getPageBgClass(location.pathname);

  // Gate the entire app behind Pi authentication.
  useEffect(() => {
    if (!session && !isAuth) {
      navigate({ to: "/auth", replace: true });
    }
  }, [session, isAuth, navigate]);

  if (!session && !isAuth) return null;

  return (
    <div className={cn("relative min-h-screen", bgClass)}>
      <GradientOrbs />
      {!isAuth && <AppHeader />}
      {!isAuth && <FloatingSidebar />}
      <AnimatePresence mode="wait">
        <main key={location.pathname} className={cn("relative", !isAuth && "pb-24 md:pb-8")}>
          {children}
        </main>
      </AnimatePresence>
      {!isAuth && <BottomNavigation />}
    </div>
  );
}