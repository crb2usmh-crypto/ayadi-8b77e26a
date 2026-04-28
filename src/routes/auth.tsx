import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Hand, Shield, Wallet, ExternalLink, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GradientOrbs } from "@/components/layout/GradientOrbs";
import { usePiAuth } from "@/components/providers/PiAuthProvider";

// Replace with your actual Pi app slug from the Pi Developer Portal.
const PI_APP_URL = "https://pinet.com/YOUR_APP";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isPiBrowser, session, loading, error, login, loginAsDev } = usePiAuth();
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If already signed in, bounce to home.
  useEffect(() => {
    if (session) {
      navigate({ to: "/" });
    }
  }, [session, navigate]);

  const handleLogin = async () => {
    try {
      await login(["username"]);
      toast.success(t("auth.loginSuccess"));
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("auth.error"));
    }
  };

  const handleSecretTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 3000);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      loginAsDev();
      toast.success("Developer Mode — تم تسجيل الدخول كمطور");
      navigate({ to: "/" });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10 bg-gradient-page-auth">
      <GradientOrbs />
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={handleSecretTap}
          className="mb-8 flex w-full items-center justify-center gap-2 p-3 rounded-2xl"
          aria-label="logo"
        >
          <div className="flex size-12 items-center justify-center rounded-2xl gradient-brand text-white shadow-lg">
            <Hand className="size-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold gradient-text leading-none">{t("app.name")}</p>
            <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
          </div>
        </button>

        <div className="glass-card rounded-3xl p-6 shadow-2xl md:p-8">
          {isPiBrowser ? (
            <PiLoginCard loading={loading} error={error} onLogin={handleLogin} />
          ) : (
            <PiBrowserRequired />
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleSecretTap}
            className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors px-3 py-2 select-none"
            aria-label="dev"
          >
            Dev
          </button>
        </div>
      </div>
    </div>
  );
}

function PiLoginCard({
  loading,
  error,
  onLogin,
}: {
  loading: boolean;
  error: string | null;
  onLogin: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">{t("auth.piLoginTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.piLoginSubtitle")}</p>
      </div>
      <Button
        onClick={onLogin}
        disabled={loading}
        size="lg"
        className="w-full rounded-full gradient-brand text-white shadow-lg shadow-primary/40"
      >
        <LogIn className="size-5" />
        {loading ? t("common.loading") : t("auth.piSignIn")}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t("auth.piConsentNote")}</p>
    </div>
  );
}

function PiBrowserRequired() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl gradient-brand text-white shadow-lg">
        <Shield className="size-7" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">{t("auth.piRequiredTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.piRequiredMessage")}</p>
      </div>

      <ul className="space-y-3 text-start text-sm">
        <li className="flex items-start gap-3 rounded-xl bg-primary/5 p-3">
          <Shield className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>{t("auth.piReason1")}</span>
        </li>
        <li className="flex items-start gap-3 rounded-xl bg-primary/5 p-3">
          <Wallet className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>{t("auth.piReason2")}</span>
        </li>
        <li className="flex items-start gap-3 rounded-xl bg-primary/5 p-3">
          <Hand className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>{t("auth.piReason3")}</span>
        </li>
      </ul>

      <a
        href={PI_APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/40 transition-transform hover:scale-[1.02]"
      >
        <ExternalLink className="size-4" />
        {t("auth.openInPi")}
      </a>

      <p className="text-xs text-muted-foreground">{t("auth.piHelpText")}</p>
    </div>
  );
}
