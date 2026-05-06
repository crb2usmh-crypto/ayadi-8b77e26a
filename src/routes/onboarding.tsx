import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageTransition } from "@/components/layout/PageTransition";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import { profileQueryOptions } from "@/lib/supabase/queries";
import { COUNTRIES } from "@/lib/data/countries";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "أيادي — أكمل ملفك الشخصي" },
      { name: "description", content: "أكمل بياناتك للوصول الكامل إلى أيادي." },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = usePiAuth();
  const piUid = session?.user.uid ?? null;

  const { data: profile, isLoading } = useQuery(profileQueryOptions(piUid));

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    street: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from existing profile (for "edit" mode after onboarding).
  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        email: profile.email ?? "",
        // Old profiles stored a single string; surface it in `street` so the
        // user can split it across the new fields.
        street: profile.address ?? "",
        city: "",
        state: "",
        postal_code: "",
        country: profile.country ?? "",
      });
    }
  }, [profile]);

  const isAr = i18n.language === "ar";

  if (!session) {
    return null; // AppShell will redirect to /auth.
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.full_name.trim() ||
      !form.email.trim() ||
      !form.street.trim() ||
      !form.city.trim() ||
      !form.country
    ) {
      toast.error(t("onboarding.fieldRequired"));
      return;
    }
    const address = [form.street, form.city, form.state, form.postal_code]
      .map((s) => s.trim())
      .filter(Boolean)
      .join("، ");
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/profile-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: session.accessToken,
          profile: {
            full_name: form.full_name,
            email: form.email,
            address,
            country: form.country,
          },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        const base = body.error || t("onboarding.saveFailed");
        throw new Error(body.details ? `${base} — ${body.details}` : base);
      }
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("onboarding.success"));
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-xl px-4 py-10 md:py-16">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl gradient-brand text-white shadow-lg">
            <UserCircle2 className="size-7" />
          </div>
          <h1 className="text-2xl font-extrabold gradient-text md:text-3xl">
            {t("onboarding.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("onboarding.subtitle")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-card space-y-5 rounded-3xl p-6 md:p-8"
        >
          {isLoading && (
            <div className="flex justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          )}

          <Field label={t("onboarding.fullName")}>
            <Input
              value={form.full_name}
              onChange={(e) =>
                setForm((p) => ({ ...p, full_name: e.target.value }))
              }
              required
              maxLength={120}
              className="h-12 rounded-xl"
            />
          </Field>

          <Field label={t("onboarding.email")}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
              maxLength={254}
              className="h-12 rounded-xl"
              dir="ltr"
            />
          </Field>

          <Field label={t("onboarding.address")}>
            <div className="space-y-3">
              <Input
                placeholder={t("onboarding.street")}
                value={form.street}
                onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))}
                required
                maxLength={150}
                className="h-12 rounded-xl"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder={t("onboarding.city")}
                  value={form.city}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                  required
                  maxLength={80}
                  className="h-12 rounded-xl"
                />
                <Input
                  placeholder={t("onboarding.state")}
                  value={form.state}
                  onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                  maxLength={80}
                  className="h-12 rounded-xl"
                />
              </div>
              <Input
                placeholder={t("onboarding.postalCode")}
                value={form.postal_code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, postal_code: e.target.value }))
                }
                maxLength={20}
                dir="ltr"
                className="h-12 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                {t("onboarding.addressHint")}
              </p>
            </div>
          </Field>

          <Field label={t("onboarding.country")}>
            <Select
              value={form.country}
              onValueChange={(v) => setForm((p) => ({ ...p, country: v }))}
            >
              <SelectTrigger className="h-12 rounded-xl">
                <SelectValue placeholder={t("onboarding.country")} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {isAr ? c.ar : c.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Button
            type="submit"
            disabled={submitting}
            size="lg"
            className="w-full rounded-full gradient-brand text-white shadow-lg shadow-primary/40"
          >
            {submitting && <Loader2 className="me-2 size-4 animate-spin" />}
            {t("onboarding.save")}
          </Button>
        </form>
      </div>
    </PageTransition>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
    </div>
  );
}