import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n, formatRupiah, type TKey } from "@/lib/i18n";
import { BREAK_TIMES, ORDER_STATUSES, STATUS_STYLES } from "@/lib/constants";
import { uploadMedia } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/seller")({
  head: () => ({
    meta: [
      { title: "Dashboard Penjual — Kantin IPEKA Pluit" },
      { name: "description", content: "Kelola menu, harga, foto makanan, dan status pesanan kantinmu." },
      { property: "og:title", content: "Dashboard Penjual — Kantin IPEKA Pluit" },
      { property: "og:description", content: "Kelola menu dan pesanan masuk kantin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SellerPage,
});

function SellerPage() {
  const { t, lang } = useI18n();
  const { user, role } = useAuth();
  const qc = useQueryClient();

  const { data: canteen, isLoading } = useQuery({
    queryKey: ["my-canteen", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("canteens").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: unowned } = useQuery({
    queryKey: ["unowned-canteens"],
    enabled: !!user && !canteen && !isLoading,
    queryFn: async () => {
      const { data } = await supabase.from("canteens").select("id, name, slug").is("owner_id", null).order("name");
      return data ?? [];
    },
  });

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

  if (isLoading) return <p className="px-4 py-20 text-center text-muted-foreground">{t("common.loading")}</p>;

  if (!canteen) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="font-display text-3xl font-bold">{t("seller.title")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("seller.noCanteen")}</p>
        {role === "canteen_owner" && (
          <div className="mt-6 space-y-3">
            {(unowned ?? []).map((c) => (
              <div key={c.id} className="surface-card flex items-center justify-between gap-3 p-4">
                <span className="font-semibold">{c.name}</span>
                <Button
                  size="sm"
                  onClick={async () => {
                    const { error } = await supabase.from("canteens").update({ owner_id: user.id }).eq("id", c.id);
                    if (error) return toast.error(error.message);
                    void qc.invalidateQueries({ queryKey: ["my-canteen"] });
                  }}
                >
                  {t("seller.claim")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <SellerDashboard canteenId={canteen.id} canteenName={canteen.name} lang={lang} />;
}

function SellerDashboard({ canteenId, canteenName, lang }: { canteenId: string; canteenName: string; lang: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState({ name: "", description: "", price: "", image_url: null as string | null, is_available: true });

  const { data: menu } = useQuery({
    queryKey: ["seller-menu", canteenId],
    queryFn: async () => {
      const { data } = await supabase.from("menu_items").select("*").eq("canteen_id", canteenId).order("created_at");
      return data ?? [];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["seller-orders", canteenId],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(id, name, quantity, unit_price, notes)")
        .eq("canteen_id", canteenId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const saveItem = async () => {
    if (!item.name.trim()) return;
    const { error } = await supabase.from("menu_items").insert({
      canteen_id: canteenId,
      name: item.name.trim().slice(0, 80),
      description: item.description.trim().slice(0, 300),
      price: Number(item.price) || 0,
      image_url: item.image_url,
      is_available: item.is_available,
    });
    if (error) return toast.error(error.message);
    setOpen(false);
    setItem({ name: "", description: "", price: "", image_url: null, is_available: true });
    void qc.invalidateQueries({ queryKey: ["seller-menu", canteenId] });
    toast.success(t("settings.saved"));
  };

  const setStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: status as (typeof ORDER_STATUSES)[number] })
      .eq("id", orderId);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["seller-orders", canteenId] });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("seller.title")}</h1>
      <p className="text-sm text-muted-foreground">{canteenName}</p>

      <Tabs defaultValue="orders" className="mt-6">
        <TabsList>
          <TabsTrigger value="orders">{t("seller.orders")}</TabsTrigger>
          <TabsTrigger value="menu">{t("seller.menu")}</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6 space-y-4">
          {(orders ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("orders.empty")}</p>}
          {(orders ?? []).map((o) => {
            const brk = BREAK_TIMES.find((b) => b.value === o.break_time);
            return (
              <article key={o.id} className="surface-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {o.pickup_date} · {lang === "en" ? brk?.labelEn : brk?.labelId}
                  </p>
                  <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (STATUS_STYLES[o.status] ?? "")}>
                    {t(("status." + o.status) as TKey)}
                  </span>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {(o.order_items ?? []).map((i) => (
                    <li key={i.id}>
                      {i.quantity}× {i.name}
                      {i.notes ? <span className="text-muted-foreground"> — {i.notes}</span> : null}
                    </li>
                  ))}
                </ul>
                {o.notes && <p className="mt-2 text-xs text-muted-foreground">{o.notes}</p>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="font-display font-bold">{formatRupiah(o.total)}</span>
                  <div className="flex items-center gap-2">
                    <Select value={o.status} onValueChange={(v) => setStatus(o.id, v)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(("status." + s) as TKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm">{t("seller.markDone")}</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("seller.confirmTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>{t("seller.confirmDone")}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => setStatus(o.id, "completed")}>
                            {t("common.confirm")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </article>
            );
          })}
        </TabsContent>

        <TabsContent value="menu" className="mt-6 space-y-4">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">{t("seller.addItem")}</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("seller.addItem")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("seller.name")}</Label>
                  <Input value={item.name} maxLength={80} onChange={(e) => setItem({ ...item, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("seller.price")}</Label>
                  <Input
                    value={item.price}
                    inputMode="numeric"
                    onChange={(e) => setItem({ ...item, price: e.target.value.replace(/\D/g, "").slice(0, 7) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("seller.desc")}</Label>
                  <Textarea value={item.description} rows={3} maxLength={300} onChange={(e) => setItem({ ...item, description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("seller.photo")}</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !user) return;
                      try {
                        const url = await uploadMedia(user.id, file, "menu");
                        setItem((s) => ({ ...s, image_url: url }));
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="avail">{t("seller.available")}</Label>
                  <Switch id="avail" checked={item.is_available} onCheckedChange={(v) => setItem({ ...item, is_available: v })} />
                </div>
                <Button className="w-full" onClick={saveItem}>
                  {t("seller.save")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {(menu ?? []).map((m) => (
            <div key={m.id} className="surface-card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-40 flex-1">
                <p className="font-semibold">{m.name}</p>
                <p className="text-sm text-accent">{formatRupiah(m.price)}</p>
                {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
              </div>
              <Switch
                checked={m.is_available}
                onCheckedChange={async (v) => {
                  await supabase.from("menu_items").update({ is_available: v }).eq("id", m.id);
                  void qc.invalidateQueries({ queryKey: ["seller-menu", canteenId] });
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await supabase.from("menu_items").delete().eq("id", m.id);
                  void qc.invalidateQueries({ queryKey: ["seller-menu", canteenId] });
                }}
              >
                {t("common.delete")}
              </Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}