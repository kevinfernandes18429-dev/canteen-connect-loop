import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk atau Daftar — Kantin IPEKA Pluit" },
      { name: "description", content: "Masuk sebagai siswa atau penjual kantin untuk mulai pre-order makanan." },
      { property: "og:title", content: "Masuk atau Daftar — Kantin IPEKA Pluit" },
      { property: "og:description", content: "Akun terverifikasi email untuk siswa dan penjual kantin." },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_.]+$/),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(2).max(80),
  klass: z.string().trim().min(1).max(20),
});

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // sign in
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // sign up
  const [suUsername, setSuUsername] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suFullName, setSuFullName] = useState("");
  const [suClass, setSuClass] = useState("");
  const [suRole, setSuRole] = useState<"student" | "canteen_owner">("student");

  // dialogs
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        const { data: deleted } = await supabase.rpc("was_account_deleted", { _email: email.trim() });
        toast.error(deleted ? t("auth.deleted") : error.message);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("two_factor_enabled")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.two_factor_enabled) {
        await supabase.auth.signOut();
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: false },
        });
        if (otpError) {
          toast.error(otpError.message);
          return;
        }
        setOtpEmail(email.trim());
        setOtpOpen(true);
        return;
      }
      void navigate({ to: "/" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: otpEmail, token: otpCode.trim(), type: "email" });
      if (error) {
        toast.error(error.message);
        return;
      }
      setOtpOpen(false);
      void navigate({ to: "/" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({
      username: suUsername,
      email: suEmail,
      password: suPassword,
      fullName: suFullName,
      klass: suClass,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("common.error"));
      return;
    }
    setLoading(true);
    try {
      const { data: available } = await supabase.rpc("username_available", { _username: parsed.data.username });
      if (available === false) {
        toast.error(t("auth.usernameTaken"));
        return;
      }
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            username: parsed.data.username.toLowerCase(),
            full_name: parsed.data.fullName,
            class: parsed.data.klass,
            role: suRole,
            language: window.localStorage.getItem("kantin-lang") ?? "id",
          },
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("auth.verifySent"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("auth.resetSent"));
      setForgotOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <div className="mb-8 text-center">
        <span className="gradient-brand mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
          <UtensilsCrossed className="h-6 w-6 text-primary-foreground" />
        </span>
        <h1 className="font-display text-2xl font-bold">{t("app.name")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("app.tagline")}</p>
      </div>

      <div className="surface-card p-6">
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">{t("auth.signin")}</TabsTrigger>
            <TabsTrigger value="signup">{t("auth.signup")}</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-5">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="si-email">{t("auth.email")}</Label>
                <Input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="si-pass">{t("auth.password")}</Label>
                <Input id="si-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={72} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {t("auth.signin")}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setForgotOpen(true);
                }}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                {t("auth.forgot")}
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-5">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(["student", "canteen_owner"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSuRole(r)}
                    className={
                      "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors " +
                      (suRole === r
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary")
                    }
                  >
                    {r === "student" ? t("auth.student") : t("auth.owner")}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-username">{t("auth.username")}</Label>
                <Input id="su-username" value={suUsername} onChange={(e) => setSuUsername(e.target.value)} required maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-name">{t("auth.fullName")}</Label>
                <Input id="su-name" value={suFullName} onChange={(e) => setSuFullName(e.target.value)} required maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-class">{t("auth.class")}</Label>
                <Input id="su-class" value={suClass} onChange={(e) => setSuClass(e.target.value)} placeholder="10 IPA 1" required maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-email">{t("auth.email")}</Label>
                <Input id="su-email" type="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} required maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-pass">{t("auth.password")}</Label>
                <Input id="su-pass" type="password" value={suPassword} onChange={(e) => setSuPassword(e.target.value)} required minLength={8} maxLength={72} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {t("auth.signup")}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>

      <Link to="/" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">
        {t("common.back")}
      </Link>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("auth.forgotTitle")}</DialogTitle>
            <DialogDescription>{t("auth.forgotDesc")}</DialogDescription>
          </DialogHeader>
          <Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@email.com" maxLength={255} />
          <Button onClick={handleForgot} disabled={loading || !forgotEmail}>
            {t("auth.sendReset")}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("auth.2faTitle")}</DialogTitle>
            <DialogDescription>{t("auth.2faDesc")}</DialogDescription>
          </DialogHeader>
          <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="123456" inputMode="numeric" maxLength={6} />
          <Button onClick={handleVerifyOtp} disabled={loading || otpCode.length < 6}>
            {t("auth.verify")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
