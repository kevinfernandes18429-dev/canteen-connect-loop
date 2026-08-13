import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCart, MAX_QTY } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useI18n, formatRupiah } from "@/lib/i18n";
import { BREAK_TIMES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Keranjang Pre-Order — Kantin IPEKA Pluit" },
      { name: "description", content: "Atur jumlah, tanggal, dan waktu istirahat untuk pre-order kantinmu." },
      { property: "og:title", content: "Keranjang Pre-Order — Kantin IPEKA Pluit" },
      { property: "og:description", content: "Selesaikan pre-order makanan kantinmu." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, canteenId, canteenName, total, update, remove, clear } = useCart();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [breakTime, setBreakTime] = useState(BREAK_TIMES[0]!.value);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const max = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const checkout = async () => {
    if (!user || !canteenId || items.length === 0) return;
    setLoading(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          canteen_id: canteenId,
          pickup_date: date,
          break_time: breakTime,
          notes: notes.trim().slice(0, 300),
          total,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: itemsError } = await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          menu_item_id: i.menuItemId,
          name: i.name,
          unit_price: i.price,
          quantity: i.quantity,
          notes: i.notes,
        })),
      );
      if (itemsError) throw itemsError;
      clear();
      toast.success(t("cart.success"));
      void navigate({ to: "/orders" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("cart.title")}</h1>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("cart.empty")}</p>
      ) : (
        <div className="mt-6 space-y-6">
          <p className="text-sm text-muted-foreground">{canteenName}</p>
          <div className="space-y-3">
            {items.map((i) => (
              <div key={i.menuItemId} className="surface-card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-40 flex-1">
                  <p className="font-semibold">{i.name}</p>
                  <p className="text-sm text-accent">{formatRupiah(i.price)}</p>
                  {i.notes && <p className="mt-1 text-xs text-muted-foreground">{i.notes}</p>}
                </div>
                <Input
                  type="number"
                  min={1}
                  max={MAX_QTY}
                  value={i.quantity}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v > MAX_QTY) toast.error(t("cart.maxQty"));
                    update(i.menuItemId, { quantity: v });
                  }}
                  className="w-20"
                />
                <Button variant="ghost" size="icon" onClick={() => remove(i.menuItemId)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="surface-card space-y-4 p-5">
            <div className="space-y-1.5">
              <Label>{t("cart.date")}</Label>
              <Input type="date" value={date} min={today} max={max} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("cart.break")}</Label>
              <Select value={breakTime} onValueChange={setBreakTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BREAK_TIMES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {lang === "en" ? b.labelEn : b.labelId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("cart.notes")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={3} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-display text-xl font-bold">
              {t("cart.total")}: {formatRupiah(total)}
            </span>
            <Button size="lg" onClick={checkout} disabled={loading}>
              {t("cart.checkout")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
