import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { Hand } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GradientOrbs } from "@/components/layout/GradientOrbs";

export const Route = createFileRoute("/auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { t } = useTranslation();
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10 bg-gradient-page-auth">
      <GradientOrbs />
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-2xl gradient-brand text-white shadow-lg">
            <Hand className="size-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold gradient-text leading-none">{t("app.name")}</p>
            <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
          </div>
        </Link>
        <div className="glass-card rounded-3xl p-6 shadow-2xl md:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}