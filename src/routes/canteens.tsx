import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { canteenImage } from "@/lib/canteen-images";

export const Route = createFileRoute("/canteens")({
  head: () => ({
    meta: [
      { title: "Daftar Kantin — Kantin IPEKA Pluit" },
      { name: "description", content: "Lima kantin IPEKA Pluit: Takoya, Uncle Fong, Fuel Catering, Ichi Gourmet, Ceria." },
      { property: "og:title", content: "Daftar Kantin — Kantin IPEKA Pluit" },
      { property: "og:description", content: "Pilih kantin favoritmu dan lihat menunya." },
    ],
  }),
  component: Canteens,
});

function Canteens() {
  const { t, lang } = useI18n();
  const { data } = useQuery({
    queryKey: ["canteens"],
    queryFn: async () => {
      const { data } = await supabase.from("canteens").select("*").order("name");
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("home.chooseCanteen")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("home.chooseCanteenSub")}</p>
      <div className="stagger mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((c) => (
          <Link
            key={c.id}
            to="/canteen/$slug"
            params={{ slug: c.slug }}
            className="surface-card hover-lift group overflow-hidden"
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
              <h2 className="font-display text-lg font-bold">{c.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {lang === "en" ? c.description_en || c.description : c.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
