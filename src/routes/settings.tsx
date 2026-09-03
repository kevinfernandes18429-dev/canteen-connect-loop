import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n, type Lang, type TKey } from "@/lib/i18n";
import { uploadMedia } from "@/lib/upload";
import { useTheme, type Theme } from "@/lib/theme";
import { ClassPicker } from "@/components/app/ClassPicker";
import { EMPTY_CLASS, isClassComplete, parseClass, serializeClass, type ClassValue } from "@/lib/classes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Pengaturan Profil — Kantin IPEKA Pluit" },
      { name: "description", content: "Atur foto profil, banner, bio, status kehadiran, bahasa, dan verifikasi 2 langkah." },
      { property: "og:title", content: "Pengaturan Profil — Kantin IPEKA Pluit" },
      { property: "og:description", content: "Personalisasi profil kantinmu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const PRESENCES = ["online", "idle", "dnd", "invisible"] as const;

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user, profile, role, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState("");
  const [klass, setKlass] = useState<ClassValue>(EMPTY_CLASS);
  const [form, setForm] = useState({
    full_name: "",
    bio: "",
    status_text: "",
    status_emoji: "",
    presence: "online" as (typeof PRESENCES)[number],
    avatar_url: null as string | null,
    banner_url: null as string | null,
    two_factor_enabled: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username);
    setKlass(parseClass(profile.class));
    setForm({
      full_name: profile.full_name,
      bio: profile.bio,
      status_text: profile.status_text,
      status_emoji: profile.status_emoji,
      presence: profile.presence,
      avatar_url: profile.avatar_url,
      banner_url: profile.banner_url,
      two_factor_enabled: profile.two_factor_enabled,
    });
  }, [profile]);

  const pick = async (kind: "avatar" | "banner", file: File | undefined) => {
    if (!file || !user) return;
    try {
      const url = await uploadMedia(user.id, file, kind);
      setForm((f) => ({ ...f, [kind === "avatar" ? "avatar_url" : "banner_url"]: url }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const save = async () => {
    if (!user) return;
    const uname = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(uname)) { toast.error(t("settings.usernameHint")); return; }
    if (role === "student" && !isClassComplete(klass)) { toast.error(t("auth.class")); return; }
    setSaving(true);
    if (uname !== profile?.username) {
      const { data: available } = await supabase.rpc("username_available", { _username: uname });
      if (available === false) { setSaving(false); toast.error(t("auth.usernameTaken")); return; }
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        username: uname,
        full_name: form.full_name.slice(0, 80),
        class: role === "student" ? serializeClass(klass) : profile?.class ?? "",
        bio: form.bio.slice(0, 300),
        status_text: form.status_text.slice(0, 80),
        status_emoji: form.status_emoji.slice(0, 8),
        presence: form.presence,
        avatar_url: form.avatar_url,
        banner_url: form.banner_url,
        two_factor_enabled: form.two_factor_enabled,
        language: lang,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message.includes("unique") ? t("auth.usernameTaken") : error.message); return; }
    await refreshProfile();
    toast.success(t("settings.saved"));
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-muted-foreground">{t("nav.signin")}</p>
        <Button asChild className="mt-4">
          <Link to="/auth">{t("auth.signin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("settings.title")}</h1>
      <Tabs defaultValue="profile" className="mt-6">
        <TabsList>
          <TabsTrigger value="profile">{t("settings.profile")}</TabsTrigger>
          <TabsTrigger value="security">{t("settings.security")}</TabsTrigger>
          <TabsTrigger value="lang">{t("settings.appearance")} · {t("settings.theme")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-5">
          <div
            className="h-32 rounded-2xl bg-primary/15 bg-cover bg-center"
            style={form.banner_url ? { backgroundImage: `url(${form.banner_url})` } : undefined}
          />
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={form.avatar_url ?? undefined} alt={profile?.username ?? ""} />
              <AvatarFallback>{(profile?.username ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="grid gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("settings.avatar")}</Label>
                <Input type="file" accept="image/*" onChange={(e) => pick("avatar", e.target.files?.[0])} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("settings.banner")}</Label>
                <Input type="file" accept="image/*" onChange={(e) => pick("banner", e.target.files?.[0])} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("settings.username")}</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
              <Input value={username} maxLength={20} className="pl-7" onChange={(e) => setUsername(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">{t("settings.usernameHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("auth.fullName")}</Label>
            <Input value={form.full_name} maxLength={80} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          {role === "student" && (
            <div className="space-y-1.5">
              <Label>{t("auth.class")}</Label>
              <ClassPicker value={klass} onChange={setKlass} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{t("settings.bio")}</Label>
            <Textarea value={form.bio} maxLength={300} rows={3} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("settings.presence")}</Label>
              <Select value={form.presence} onValueChange={(v) => setForm({ ...form, presence: v as typeof form.presence })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESENCES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(("presence." + p) as TKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.statusText")}</Label>
              <div className="flex gap-2">
                <Input
                  value={form.status_emoji}
                  maxLength={8}
                  placeholder="🍜"
                  className="w-16"
                  onChange={(e) => setForm({ ...form, status_emoji: e.target.value })}
                />
                <Input value={form.status_text} maxLength={80} onChange={(e) => setForm({ ...form, status_text: e.target.value })} />
              </div>
            </div>
          </div>
          <Button onClick={save} disabled={saving}>
            {t("settings.save")}
          </Button>
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-5">
          <div className="surface-card flex items-center justify-between gap-4 p-5">
            <Label htmlFor="twofa">{t("settings.2fa")}</Label>
            <Switch
              id="twofa"
              checked={form.two_factor_enabled}
              onCheckedChange={(v) => setForm({ ...form, two_factor_enabled: v })}
            />
          </div>
          <Button onClick={save} disabled={saving}>
            {t("settings.save")}
          </Button>
        </TabsContent>

        <TabsContent value="lang" className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label>{t("settings.language")}</Label>
            <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="id">Bahasa Indonesia</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings.theme")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["light", "dark", "system"] as Theme[]).map((th) => (
                <button
                  key={th}
                  type="button"
                  onClick={() => setTheme(th)}
                  className={
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors " +
                    (theme === th ? "border-primary bg-primary/8 text-primary" : "border-border text-muted-foreground hover:bg-secondary")
                  }
                >
                  {t(("theme." + th) as TKey)}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={save} disabled={saving}>
            {t("settings.save")}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}