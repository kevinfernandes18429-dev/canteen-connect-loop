import { useEffect, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function LoadingScreen() {
  const { t } = useI18n();
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const id = window.setInterval(() => setProgress((p) => Math.min(96, p + Math.random() * 22)), 180);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="gradient-brand fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-foreground/15 backdrop-blur-sm ring-1 ring-primary-foreground/25">
        <UtensilsCrossed className="h-9 w-9 animate-pulse text-primary-foreground" />
      </div>
      <div className="text-center">
        <p className="font-display text-2xl font-semibold text-primary-foreground">IPEKA Pluit</p>
        <p className="mt-1 text-sm text-primary-foreground/75">{t("loading.title")}</p>
      </div>
      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-primary-foreground/20">
        <div
          className="h-full rounded-full bg-primary-foreground transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
