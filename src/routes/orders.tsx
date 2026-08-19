import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n, formatRupiah, type TKey } from "@/lib/i18n";
import { BREAK_TIMES, STATUS_STYLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Pesanan Saya — Kantin IPEKA Pluit" },
      { name: "description", content: "Pantau status pre-order kantin, chat dengan penjual, dan beri rating." },
      { property: "og:title", content: "Pesanan Saya — Kantin IPEKA Pluit" },
      { property: "og:description", content: "Pantau status pre-order dan riwayat pesanan kantinmu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

const ACTIVE = ["pending", "preparing", "in_kitchen", "ready"];

function OrderChat({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const { data } = useQuery({
    queryKey: ["messages", orderId],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("*").eq("order_id", orderId).order("created_at");
      return data ?? [];
    },
  });

  const send = async () => {
    if (!user || !body.trim()) return;
    const { error } = await supabase
      .from("messages")
      .insert({ order_id: orderId, sender_id: user.id, body: body.trim().slice(0, 500) });
    if (error) return toast.error(error.message);
    setBody("");
    void qc.invalidateQueries({ queryKey: ["messages", orderId] });
  };

  return (
    <div className="space-y-3">
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl bg-secondary/60 p-3">
        {(data ?? []).length === 0 && <p className="text-center text-sm text-muted-foreground">—</p>}
        {(data ?? []).map((m) => (
          <div
            key={m.id}
            className={
              "max-w-[80%] rounded-2xl px-3 py-2 text-sm " +
              (m.sender_id === user?.id ? "ml-auto bg-primary text-primary-foreground" : "bg-card")
            }
          >
            {m.body}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <Button onClick={send}>{t("common.send")}</Button>
      </div>
    </div>
  );
}

function OrdersPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();

  const { data: orders } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, canteens(name, slug), order_items(id, name, quantity, unit_price, notes)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
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

  const list = orders ?? [];
  const render = (rows: typeof list) =>
    rows.length === 0 ? (
      <p className="mt-6 text-sm text-muted-foreground">{t("orders.empty")}</p>
    ) : (
      <div className="mt-6 space-y-4">
        {rows.map((o) => {
          const brk = BREAK_TIMES.find((b) => b.value === o.break_time);
          return (
            <article key={o.id} className="surface-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{o.canteens?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.pickup_date} · {lang === "en" ? brk?.labelEn : brk?.labelId}
                  </p>
                </div>
                <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (STATUS_STYLES[o.status] ?? "")}>
                  {t(("status." + o.status) as TKey)}
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {(o.order_items ?? []).map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span>
                      {i.quantity}× {i.name}
                      {i.notes ? <span className="text-muted-foreground"> — {i.notes}</span> : null}
                    </span>
                    <span className="text-muted-foreground">{formatRupiah(i.unit_price * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="font-display font-bold">{formatRupiah(o.total)}</span>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        {t("orders.chat")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("orders.chat")}</DialogTitle>
                      </DialogHeader>
                      <OrderChat orderId={o.id} />
                    </DialogContent>
                  </Dialog>
                  {o.canteens?.slug && (
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/canteen/$slug" params={{ slug: o.canteens.slug }}>
                        {t("orders.rate")}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("orders.title")}</h1>
      <Tabs defaultValue="active" className="mt-6">
        <TabsList>
          <TabsTrigger value="active">{t("orders.active")}</TabsTrigger>
          <TabsTrigger value="past">{t("orders.past")}</TabsTrigger>
        </TabsList>
        <TabsContent value="active">{render(list.filter((o) => ACTIVE.includes(o.status)))}</TabsContent>
        <TabsContent value="past">{render(list.filter((o) => !ACTIVE.includes(o.status)))}</TabsContent>
      </Tabs>
    </div>
  );
}