import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n, formatRupiah, type TKey } from "@/lib/i18n";
import { formatClass } from "@/lib/classes";
import { ACTIVE_STATUSES, BREAK_TIMES, ORDER_STATUSES, STATUS_STYLES } from "@/lib/constants";
import { uploadMedia } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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

  const { data: canteen, isLoading } = useQuery({
    queryKey: ["my-canteen", user?.id],
    enabled: !!user,
    refetchInterval: (q) => (q.state.data ? false : 15000),
    queryFn: async () => {
      const { data } = await supabase.from("canteens").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
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
        <div className="surface-card mt-6 flex items-start gap-3 border-accent/30 bg-accent/5 p-5">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <p className="text-sm">{role === "canteen_owner" ? t("seller.pending") : t("seller.noCanteen")}</p>
        </div>
      </div>
    );
  }

  return <SellerDashboard canteenId={canteen.id} canteenName={canteen.name} lang={lang} />;
}

type ItemForm = { name: string; description: string; price: string; image_url: string | null; is_available: boolean };
const EMPTY_ITEM: ItemForm = { name: "", description: "", price: "", image_url: null, is_available: true };

function SellerDashboard({ canteenId, canteenName, lang }: { canteenId: string; canteenName: string; lang: "id" | "en" }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [item, setItem] = useState<ItemForm>(EMPTY_ITEM);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const customerIds = Array.from(new Set((orders ?? []).map((o) => o.user_id)));
  const { data: customers } = useQuery({
    queryKey: ["seller-customers", customerIds.join(",")],
    enabled: customerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, username, full_name, class").in("id", customerIds);
      return new Map((data ?? []).map((p) => [p.id, p]));
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setItem(EMPTY_ITEM);
    setOpen(true);
  };

  const openEdit = (m: NonNullable<typeof menu>[number]) => {
    setEditingId(m.id);
    setItem({ name: m.name, description: m.description, price: String(m.price), image_url: m.image_url, is_available: m.is_available });
    setOpen(true);
  };

  const saveItem = async () => {
    if (!item.name.trim()) return;
    const payload = {
      name: item.name.trim().slice(0, 80),
      description: item.description.trim().slice(0, 300),
      price: Number(item.price) || 0,
      image_url: item.image_url,
      is_available: item.is_available,
    };
    const { error } = editingId
      ? await supabase.from("menu_items").update(payload).eq("id", editingId)
      : await supabase.from("menu_items").insert({ canteen_id: canteenId, ...payload });
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    setEditingId(null);
    setItem(EMPTY_ITEM);
    void qc.invalidateQueries({ queryKey: ["seller-menu", canteenId] });
    toast.success(t("settings.saved"));
  };

  const toggleSelect = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });

  const allSelected = (menu ?? []).length > 0 && selected.size === (menu ?? []).length;
  const ids = Array.from(selected);

  const bulkAvailability = async (v: boolean) => {
    const { error } = await supabase.from("menu_items").update({ is_available: v }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    setSelected(new Set());
    void qc.invalidateQueries({ queryKey: ["seller-menu", canteenId] });
  };

  const bulkDelete = async () => {
    const { error } = await supabase.from("menu_items").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    setSelected(new Set());
    void qc.invalidateQueries({ queryKey: ["seller-menu", canteenId] });
    toast.success(t("settings.saved"));
  };

  const setStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: status as (typeof ORDER_STATUSES)[number] })
      .eq("id", orderId);
    if (error) { toast.error(error.message); return; }
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

        <TabsContent value="orders" className="mt-6">
          <Tabs defaultValue="active">
            <TabsList className="h-8">
              <TabsTrigger value="active" className="text-xs">
                {t("seller.active")} ({(orders ?? []).filter((o) => ACTIVE_STATUSES.includes(o.status)).length})
              </TabsTrigger>
              <TabsTrigger value="done" className="text-xs">
                {t("seller.done")}
              </TabsTrigger>
            </TabsList>
            {(["active", "done"] as const).map((tab) => {
              const rows = (orders ?? []).filter((o) => (tab === "active" ? ACTIVE_STATUSES.includes(o.status) : !ACTIVE_STATUSES.includes(o.status)));
              return (
                <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
                  {rows.length === 0 && <p className="text-sm text-muted-foreground">{t("orders.empty")}</p>}
                  {rows.map((o) => {
                    const brk = BREAK_TIMES.find((b) => b.value === o.break_time);
                    const cust = customers?.get(o.user_id);
                    const done = !ACTIVE_STATUSES.includes(o.status);
                    return (
                      <article key={o.id} className={"surface-card p-5 " + (done ? "opacity-80" : "")}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {cust ? (
                                <Link to="/u/$username" params={{ username: cust.username }} className="hover:underline">
                                  {cust.full_name || cust.username}
                                </Link>
                              ) : (
                                t("seller.customer")
                              )}
                              {cust?.class ? <span className="ml-2 text-xs font-normal text-muted-foreground">{formatClass(cust.class, lang)}</span> : null}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {cust ? "@" + cust.username + " · " : ""}
                              {o.pickup_date} · {lang === "en" ? brk?.labelEn : brk?.labelId}
                            </p>
                          </div>
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
                            {cust && (
                              <Button asChild size="sm" variant="ghost">
                                <Link to="/chat" search={{ canteen: undefined, c: undefined }}>
                                  {t("nav.chat")}
                                </Link>
                              </Button>
                            )}
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
                            {!done && (
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
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </TabsContent>
              );
            })}
          </Tabs>
        </TabsContent>

        <TabsContent value="menu" className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={openCreate}>{t("seller.addItem")}</Button>
            {(menu ?? []).length > 0 && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => setSelected(v ? new Set((menu ?? []).map((m) => m.id)) : new Set())}
                />
                {t("seller.selectAll")}
              </label>
            )}
          </div>

          {selected.size > 0 && (
            <div className="surface-card flex flex-wrap items-center gap-2 border-primary/30 bg-primary/5 p-3">
              <span className="mr-auto text-sm font-semibold">
                {selected.size} {t("seller.selected")}
              </span>
              {selected.size === 1 && (
                <Button size="sm" variant="outline" onClick={() => {
                  const m = (menu ?? []).find((x) => x.id === ids[0]);
                  if (m) openEdit(m);
                }}>
                  {t("common.edit")}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => bulkAvailability(true)}>{t("seller.setAvailable")}</Button>
              <Button size="sm" variant="outline" onClick={() => bulkAvailability(false)}>{t("seller.setUnavailable")}</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">{t("seller.deleteSelected")}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("seller.confirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("seller.confirmDelete")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={bulkDelete}>{t("common.confirm")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? t("seller.editItem") : t("seller.addItem")}</DialogTitle>
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
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="h-24 w-24 rounded-xl object-cover" />
                  )}
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
            <div
              key={m.id}
              className={
                "surface-card flex flex-wrap items-center gap-3 p-4 transition-colors " +
                (selected.has(m.id) ? "ring-2 ring-primary/40" : "")
              }
            >
              <Checkbox checked={selected.has(m.id)} onCheckedChange={(v) => toggleSelect(m.id, !!v)} aria-label={m.name} />
              {m.image_url && <img src={m.image_url} alt={m.name} className="h-14 w-14 rounded-lg object-cover" />}
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
              <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                {t("common.edit")}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">{t("common.delete")}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("seller.confirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("seller.confirmDelete")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        const { error } = await supabase.from("menu_items").delete().eq("id", m.id);
                        if (error) { toast.error(error.message); return; }
                        void qc.invalidateQueries({ queryKey: ["seller-menu", canteenId] });
                      }}
                    >
                      {t("common.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}