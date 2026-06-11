import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageTransition } from "@/components/layout/PageTransition";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import { profileQueryOptions } from "@/lib/supabase/queries";
import { resolveAvatar } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabaseClientNew";
import { compressImage } from "@/lib/image-compress";
import { COUNTRIES } from "@/lib/data/countries";

export const Route = createFileRoute("/profile/edit")({
  head: () => ({
    meta: [
      { title: "أيادي — تعديل الملف الشخصي" },
      { name: "description", content: "حدّث اسمك وصورتك ودولتك وعنوانك." },
    ],
  }),
  component: ProfileEditPage,
});

function ProfileEditPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = usePiAuth();
  const piUid = session?.user.uid ?? null;
  const { data: profile, isLoading } = useQuery(profileQueryOptions(piUid));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || profile.display_name || profile.username || "");
    setAddress(profile.address || "");
    setCountry(profile.country || "");
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  if (!session) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-md px-4 py-16 text-center md:ps-24">
          <p className="text-muted-foreground">{t("auth.piRequiredMessage")}</p>
          <Button asChild className="mt-6 rounded-full gradient-brand text-white">
            <Link to="/auth">{t("auth.piSignIn")}</Link>
          </Button>
        </div>
      </PageTransition>
    );
  }

  if (isLoading) {
    return (
      <PageTransition>
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </PageTransition>
    );
  }

  const displayName = fullName || session.user.username;
  const avatarSrc =
    avatarUrl ||
    resolveAvatar(
      { avatar_url: avatarUrl, avatar_seed: profile?.avatar_seed ?? null, username: session.user.username },
      session.user.username,
      160,
    );

  const handlePickAvatar = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      toast.error(t("onboarding.avatarUploadFailed"));
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxSize: 512, quality: 0.82 });
      const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      const path = `${session.user.uid}-${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true, contentType: compressed.type });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);
      toast.success(t("onboarding.avatarUploaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboarding.avatarUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      toast.error(t("onboarding.nameInvalid", "الاسم الكامل غير صالح"));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { full_name: fullName.trim() };
      if (address.trim()) payload.address = address.trim();
      if (country) payload.country = country;
      if (avatarUrl) payload.avatar_url = avatarUrl;

      const res = await fetch("/api/public/profile-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.accessToken, profile: payload }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "فشل الحفظ");
      }
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("common.save"));
      navigate({ to: "/profile" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl px-4 py-8 md:px-8 md:py-12 md:ps-24">
        <div className="mb-6 flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link to="/profile" aria-label={t("common.back", "رجوع")}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold gradient-text">{t("profile.edit")}</h1>
        </div>

        <div className="glass-card space-y-6 rounded-3xl p-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="size-24 ring-4 ring-background shadow-xl">
                <AvatarImage src={avatarSrc} />
                <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={handlePickAvatar}
                disabled={uploading}
                className="absolute bottom-0 end-0 inline-flex size-9 items-center justify-center rounded-full gradient-brand text-white shadow-lg ring-2 ring-background transition hover:scale-105 disabled:opacity-60"
                aria-label={t("onboarding.uploadAvatar")}
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>

          {/* Full name */}
          <div className="space-y-2">
            <Label>{t("onboarding.fullName", "الاسم الكامل")}</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label>{t("onboarding.country", "الدولة")}</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="h-12 rounded-xl">
                <SelectValue placeholder={t("onboarding.countryPh", "اختر دولتك")} />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {isAr ? c.ar : c.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label>{t("onboarding.address", "العنوان")}</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="rounded-xl"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || uploading}
              className="flex-1 h-12 rounded-full gradient-brand text-white"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : t("common.save")}
            </Button>
            <Button asChild variant="outline" className="rounded-full h-12">
              <Link to="/profile">{t("common.cancel", "إلغاء")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}