import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, formatRupiah } from "@/lib/i18n";
import { useCart, MAX_QTY } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { canteenImage } from "@/lib/canteen-images";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CanteenReviews } from "@/components/app/CanteenReviews";

export const Route = createFileRoute("/canteen/$slug")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      meta: [
        { title: `${name} — Menu & Pre-Order | Kantin IPEKA Pluit` },
        { name: "description", content: `Lihat menu kantin ${name} di Sekolah IPEKA Pluit dan pre-order makananmu.` },
        { property: "og:title", content: `${name} — Menu & Pre-Order` },
        { property: "og:description", content: `Menu, harga, dan ulasan kantin ${name}.` },
      ],
    };
  },
  component: CanteenPage,
});

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: string;
  is_available: boolean;
};

function CanteenPage() {
  const { slug } = Route.useParams();
  const { t, lang } = useI18n();
  const { add } = useCart();
  const { user } = useAuth();
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");

  const { data: canteen, isLoading } = useQuery({
    queryKey: ["canteen", slug],
    queryFn: async () => {
      const { data } = await supabase.from("canteens").select("*").eq("slug", slug).maybeSingle();
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["menu", canteen?.id],
    enabled: !!canteen?.id,
    queryFn: async () => {
      const { data } = await supabase.from("menu_items").select("*").eq("canteen_id", canteen!.id).order("name");
      return (data ?? []) as MenuItem[];
    },
  });

  if (isLoading || !canteen) {
    return <p className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  const openItem = (item: MenuItem) => {
    if (!user) {
      toast.error(t("nav.signin"));
      return;
    }
    setSelected(item);
    setQty(1);
    setNotes("");
  };

  const confirmAdd = () => {
    if (!selected) return;
    add(canteen.id, canteen.name, {
      menuItemId: selected.id,
      name: selected.name,
      price: selected.price,
      quantity: qty,
      notes: notes.trim().slice(0, 200),
    });
    toast.success(t("menu.added"));
    setSelected(null);
  };

  return (
    <div>
      <div className="relative h-52 w-full overflow-hidden md:h-72">
        <img src={canteenImage(canteen.slug, canteen.image_url)} alt={canteen.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute bottom-5 left-1/2 w-full max-w-6xl -translate-x-1/2 px-4">
          <h1 className="font-display text-3xl font-bold md:text-4xl">{canteen.name}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {lang === "en" ? canteen.description_en || canteen.description : canteen.description}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(items ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("menu.empty")}</p>}
          {(items ?? []).map((item) => (
            <div key={item.id} className="surface-card flex flex-col overflow-hidden">
              <div className="aspect-[4/3] overflow-hidden bg-secondary">
                <img
                  src={item.image_url || canteenImage(canteen.slug)}
                  alt={item.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{item.name}</h3>
                  {!item.is_available && <Badge variant="secondary">{t("menu.unavailable")}</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{item.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-display font-bold text-accent">{formatRupiah(item.price)}</span>
                  <Button size="sm" disabled={!item.is_available} onClick={() => openItem(item)}>
                    <ShoppingCart className="mr-1 h-4 w-4" />
                    {t("menu.addToCart")}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <CanteenReviews canteenId={canteen.id} />
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("cart.qty")}</Label>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center font-display text-lg font-bold">{qty}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (qty >= MAX_QTY) {
                      toast.error(t("cart.maxQty"));
                      return;
                    }
                    setQty((q) => Math.min(MAX_QTY, q + 1));
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">max {MAX_QTY}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("cart.notes")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} rows={3} />
            </div>
            <Button className="w-full" onClick={confirmAdd}>
              {t("menu.addToCart")} · {formatRupiah((selected?.price ?? 0) * qty)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
