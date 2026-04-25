import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || t("auth.error"));
      return;
    }
    toast.success(t("auth.resetSent"));
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("auth.forgotTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.forgotSubtitle")}</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("auth.email")}</label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="w-full rounded-full gradient-brand text-white shadow-lg shadow-primary/40"
        >
          {loading ? t("common.loading") : t("auth.sendResetLink")}
        </Button>
      </form>
      <Link
        to="/auth/login"
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("auth.backToLogin")}
      </Link>
    </div>
  );
}