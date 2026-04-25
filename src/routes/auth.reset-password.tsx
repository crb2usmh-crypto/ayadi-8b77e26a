import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message || t("auth.error"));
      return;
    }
    toast.success(t("auth.passwordUpdated"));
    navigate({ to: "/auth/login" });
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("auth.resetTitle")}</h1>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("auth.newPassword")}</label>
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="w-full rounded-full gradient-brand text-white shadow-lg shadow-primary/40"
        >
          {loading ? t("common.loading") : t("auth.updatePassword")}
        </Button>
      </form>
    </div>
  );
}