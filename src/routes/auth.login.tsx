import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(form);
    setLoading(false);
    if (error) {
      toast.error(error.message || t("auth.error"));
      return;
    }
    toast.success(t("auth.loginSuccess"));
    navigate({ to: "/" });
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("auth.loginTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.loginSubtitle")}</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("auth.email")}</label>
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="h-12 rounded-xl"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("auth.password")}</label>
          <Input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="h-12 rounded-xl"
          />
          <Link
            to="/auth/forgot-password"
            className="mt-2 inline-block text-xs text-primary hover:underline"
          >
            {t("auth.forgot")}
          </Link>
        </div>
        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="w-full rounded-full gradient-brand text-white shadow-lg shadow-primary/40"
        >
          {loading ? t("common.loading") : t("auth.signIn")}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link to="/auth/signup" className="font-semibold text-primary hover:underline">
          {t("auth.createAccount")}
        </Link>
      </p>
    </div>
  );
}