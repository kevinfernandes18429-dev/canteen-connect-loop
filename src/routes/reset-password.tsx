import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Atur Ulang Kata Sandi — Kantin IPEKA Pluit" },
      { name: "description", content: "Buat kata sandi baru untuk akun kantin IPEKA Pluit kamu." },
      { property: "og:title", content: "Atur Ulang Kata Sandi — Kantin IPEKA Pluit" },
      { property: "og:description", content: "Buat kata sandi baru untuk akunmu." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("min 8");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("settings.saved"));
    void navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="surface-card p-6">
        <h1 className="font-display text-xl font-bold">{t("auth.forgotTitle")}</h1>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="np">{t("auth.newPassword")}</Label>
            <Input id="np" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={72} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {t("auth.updatePassword")}
          </Button>
        </form>
      </div>
    </div>
  );
}
