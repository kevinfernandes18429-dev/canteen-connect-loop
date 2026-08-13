import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, formatRupiah } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { canteenImage } from "@/lib/canteen-images";
import heroImg from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kantin IPEKA Pluit — Pre-Order Makanan Kantin Sekolah" },
      {
        name: "description",
        content:
          "Pre-order makanan dari 5 kantin Sekolah IPEKA Pluit: Takoya, Uncle Fong, Fuel Catering, Ichi Gourmet, dan Ceria.",
      },
      { property: "og:title", content: "Kantin IPEKA Pluit — Pre-Order Makanan Kantin Sekolah" },
      { property: "og:description", content: "Pesan makanan kantin sebelum bel istirahat, tanpa antre." },
    ],
  }),
  component: Home,
});

function Home() {
  const { t, lang } = useI18n();
  const { user } = useAuth();

  const { data: canteens } = useQuery({
    queryKey: ["canteens"],
    queryFn: async () => {
      const { data } = await supabase.from("canteens").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: featured } = useQuery({
    queryKey: ["featured-menu"],
    queryFn: async () => {
      const { data } = await supabase
        .from("menu_items")
        .select("*, canteens(name, slug)")
        .eq("is_available", true)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <Badge className="mb-4 rounded-full bg-accent/12 text-accent hover:bg-accent/12">
              <Sparkles className="mr-1 h-3 w-3" /> {t("app.tagline")}
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-[1.08] md:text-5xl">{t("home.heroTitle")}</h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground">{t("home.heroSub")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/canteens">
                  {t("home.browse")} <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              {!user && (
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth">{t("auth.signup")}</Link>
                </Button>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" /> {lang === "id" ? "Maks. 7 hari ke depan" : "Up to 7 days ahead"}
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> {lang === "id" ? "Akun terverifikasi email" : "Email-verified accounts"}
              </span>
            </div>
          </div>
          <div className="relative">
            <div className="gradient-brand absolute -inset-3 rounded-[2rem] opacity-15 blur-2xl" />
            <img
              src={heroImg}
              alt="Kantin Sekolah IPEKA Pluit"
              width={1600}
              height={900}
              className="relative aspect-[16/10] w-full rounded-3xl border border-border object-cover shadow-[var(--shadow-lift)]"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-display text-2xl font-bold">{t("home.offers")}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(featured ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">{t("menu.empty")}</p>
          )}
          {(featured ?? []).map((item) => {
            const canteen = item.canteens as { name: string; slug: string } | null;
            return (
              <Link
                key={item.id}
                to="/canteen/$slug"
                params={{ slug: canteen?.slug ?? "" }}
                className="surface-card group overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <div className="aspect-[4/3] overflow-hidden bg-secondary">
                  <img
                    src={item.image_url || canteenImage(canteen?.slug ?? "")}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">{canteen?.name}</p>
                  <p className="mt-0.5 font-semibold">{item.name}</p>
                  <p className="mt-1 font-display text-sm font-bold text-accent">{formatRupiah(item.price)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="font-display text-2xl font-bold">{t("home.chooseCanteen")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("home.chooseCanteenSub")}</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(canteens ?? []).map((c) => (
            <Link
              key={c.id}
              to="/canteen/$slug"
              params={{ slug: c.slug }}
              className="surface-card group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
            >
              <div className="aspect-[16/10] overflow-hidden bg-secondary">
                <img
                  src={canteenImage(c.slug, c.image_url)}
                  alt={c.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                <h3 className="font-display text-lg font-bold">{c.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {lang === "en" ? c.description_en || c.description : c.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
