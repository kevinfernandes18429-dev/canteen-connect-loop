import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowBigDown, ArrowBigUp, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n, formatRupiah, type TKey } from "@/lib/i18n";
import { formatClass } from "@/lib/classes";
import { ORDER_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? "transition-transform hover:scale-110" : "cursor-default"}
        >
          <Star className={"h-4 w-4 " + (n <= value ? "fill-accent text-accent" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}

export function orderTypeLabel(v: string, t: (k: TKey) => string) {
  return (ORDER_TYPES as readonly string[]).includes(v) ? t(("orderType." + v) as TKey) : v;
}

type ReviewForm = {
  food: number;
  service: number;
  body: string;
  orderType: string;
  foods: string[];
  price: number;
  quantity: number;
};

const EMPTY_FORM: ReviewForm = { food: 5, service: 5, body: "", orderType: "", foods: [], price: 0, quantity: 1 };
const QTY_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Shared review editor used by students (create/edit own) and admins (edit any). */
export function ReviewEditor({
  canteenId,
  open,
  onOpenChange,
  initial,
  onSave,
  saving,
}: {
  canteenId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: ReviewForm;
  onSave: (f: ReviewForm) => void;
  saving?: boolean;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<ReviewForm>(initial);

  // reset when re-opened with different initial values
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setForm(initial);
  }

  const { data: menu } = useQuery({
    queryKey: ["menu-names", canteenId],
    enabled: open,
    queryFn: async () => (await supabase.from("menu_items").select("name, price").eq("canteen_id", canteenId).order("name")).data ?? [],
  });

  const toggleFood = (name: string, on: boolean) => {
    const foods = on ? [...new Set([...form.foods, name])] : form.foods.filter((f) => f !== name);
    const price = (menu ?? []).filter((m) => foods.includes(m.name)).reduce((s, m) => s + m.price, 0);
    setForm({ ...form, foods, price });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("review.write")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t("review.food")}</Label>
            <Stars value={form.food} onChange={(v) => setForm({ ...form, food: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("review.service")}</Label>
            <Stars value={form.service} onChange={(v) => setForm({ ...form, service: v })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("review.orderType")}</Label>
            <Select value={form.orderType} onValueChange={(v) => setForm({ ...form, orderType: v })}>
              <SelectTrigger>
                <SelectValue placeholder={t("review.orderTypePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {ORDER_TYPES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {t(("orderType." + o) as TKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("review.foodType")}</Label>
            <p className="text-xs text-muted-foreground">{t("review.foodTypeHint")}</p>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
              {(menu ?? []).length === 0 && <p className="p-2 text-xs text-muted-foreground">{t("menu.empty")}</p>}
              {(menu ?? []).map((m) => (
                <label key={m.name} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary">
                  <Checkbox checked={form.foods.includes(m.name)} onCheckedChange={(v) => toggleFood(m.name, !!v)} />
                  <span className="flex-1">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{formatRupiah(m.price)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("review.quantity")}</Label>
              <Select value={String(form.quantity)} onValueChange={(v) => setForm({ ...form, quantity: Number(v) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {QTY_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("review.pricePerPerson")}</Label>
              <Input value={formatRupiah(form.price)} readOnly className="bg-secondary/60" />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t("review.priceAuto")}</p>
          <div className="space-y-1.5">
            <Label>{t("review.body")}</Label>
            <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={1000} rows={4} />
          </div>
          <Button className="w-full" onClick={() => onSave(form)} disabled={saving || !form.orderType}>
            {t("review.submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CanteenReviews({ canteenId }: { canteenId: string }) {
  const { t, lang } = useI18n();
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initial, setInitial] = useState<ReviewForm>(EMPTY_FORM);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const { data: reviews } = useQuery({
    queryKey: ["reviews", canteenId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*, review_votes(user_id, value), review_replies(id, body, user_id, created_at)")
        .eq("canteen_id", canteenId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: people } = useQuery({
    queryKey: ["review-people", canteenId, (reviews ?? []).length],
    enabled: !!reviews,
    queryFn: async () => {
      const ids = new Set<string>();
      for (const r of reviews ?? []) {
        ids.add(r.user_id);
        for (const rep of (r.review_replies ?? []) as { user_id: string }[]) ids.add(rep.user_id);
      }
      if (ids.size === 0) return {} as Record<string, { username: string; avatar_url: string | null; class: string }>;
      const { data } = await supabase.from("profiles").select("id, username, avatar_url, class").in("id", [...ids]);
      const map: Record<string, { username: string; avatar_url: string | null; class: string }> = {};
      for (const p of data ?? []) map[p.id] = { username: p.username, avatar_url: p.avatar_url, class: p.class };
      return map;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["reviews", canteenId] });
  const onErr = (e: Error) => toast.error(e.message.includes("BANNED_WORD") ? t("filter.blocked") : e.message);

  const save = useMutation({
    mutationFn: async (f: ReviewForm) => {
      const payload = {
        body: f.body.trim().slice(0, 1000),
        order_type: f.orderType.slice(0, 60),
        food_type: f.foods.join(", ").slice(0, 200),
        price_per_person: f.price,
        quantity: Math.min(20, Math.max(1, Math.round(f.quantity))),
        food_rating: f.food,
        service_rating: f.service,
      };
      const { error } = editingId
        ? await supabase.from("reviews").update(payload).eq("id", editingId)
        : await supabase.from("reviews").insert({ canteen_id: canteenId, user_id: user!.id, ...payload });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false);
      setEditingId(null);
      void invalidate();
      toast.success(t("settings.saved"));
    },
    onError: onErr,
  });

  const openCreate = () => {
    setEditingId(null);
    setInitial({ ...EMPTY_FORM });
    setOpen(true);
  };

  const openEdit = (r: NonNullable<typeof reviews>[number]) => {
    setEditingId(r.id);
    setInitial({
      food: Number(r.food_rating),
      service: Number(r.service_rating),
      body: r.body,
      orderType: r.order_type,
      foods: r.food_type ? r.food_type.split(", ").filter(Boolean) : [],
      price: r.price_per_person,
      quantity: r.quantity ?? 1,
    });
    setOpen(true);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void invalidate();
  };

  const removeReply = async (id: string) => {
    const { error } = await supabase.from("review_replies").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void invalidate();
  };

  const vote = async (reviewId: string, value: number) => {
    if (!user) return;
    await supabase.from("review_votes").upsert({ review_id: reviewId, user_id: user.id, value }, { onConflict: "review_id,user_id" });
    void invalidate();
  };

  const sendReply = async (reviewId: string) => {
    if (!user || !replyBody.trim()) return;
    const { error } = await supabase
      .from("review_replies")
      .insert({ review_id: reviewId, user_id: user.id, body: replyBody.trim().slice(0, 500) });
    if (error) { onErr(error); return; }
    setReplyBody("");
    setReplyFor(null);
    void invalidate();
  };

  return (
    <section className="mt-14">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">{t("review.title")}</h2>
        {user && (
          <Button variant="outline" size="sm" onClick={openCreate}>
            {t("review.write")}
          </Button>
        )}
      </div>

      <ReviewEditor canteenId={canteenId} open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }} initial={initial} onSave={(f) => save.mutate(f)} saving={save.isPending} />

      <div className="stagger mt-5 space-y-4">
        {(reviews ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("review.empty")}</p>}
        {(reviews ?? []).map((r) => {
          const author = people?.[r.user_id] ?? null;
          const votes = (r.review_votes ?? []) as { user_id: string; value: number }[];
          const score = votes.reduce((s, v) => s + v.value, 0);
          const mine = votes.find((v) => v.user_id === user?.id)?.value ?? 0;
          const replies = (r.review_replies ?? []) as { id: string; body: string; user_id: string }[];
          const canManage = isAdmin || r.user_id === user?.id;
          return (
            <article key={r.id} className="surface-card p-5">
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={author?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{(author?.username ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to="/u/$username" params={{ username: author?.username ?? "" }} className="text-sm font-semibold hover:underline">
                      @{author?.username}
                    </Link>
                    <span className="text-xs text-muted-foreground">{author?.class ? formatClass(author.class, lang) : ""}</span>
                    {canManage && (
                      <span className="ml-auto flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("review.edit")} onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label={t("common.delete")}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("review.deleteConfirm")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {t("common.delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {t("review.food")} <Stars value={Number(r.food_rating)} />
                    </span>
                    <span className="flex items-center gap-1">
                      {t("review.service")} <Stars value={Number(r.service_rating)} />
                    </span>
                  </div>
                  {r.body && <p className="mt-3 whitespace-pre-wrap text-sm">{r.body}</p>}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {r.order_type && <span>{t("review.orderType")}: {orderTypeLabel(r.order_type, t)}</span>}
                    {r.food_type && <span>{t("review.foodType")}: {r.food_type}</span>}
                    <span>{t("review.quantity")}: {r.quantity ?? 1} {t("review.portion")}</span>
                    {r.price_per_person > 0 && <span>{t("review.pricePerPerson")}: {formatRupiah(r.price_per_person)}</span>}
                  </div>

                  <div className="mt-3 flex items-center gap-1">
                    <Button variant="ghost" size="sm" className={mine === 1 ? "text-accent" : ""} onClick={() => vote(r.id, 1)}>
                      <ArrowBigUp className="h-4 w-4" />
                    </Button>
                    <span className="min-w-6 text-center text-sm font-semibold">{score}</span>
                    <Button variant="ghost" size="sm" className={mine === -1 ? "text-primary" : ""} onClick={() => vote(r.id, -1)}>
                      <ArrowBigDown className="h-4 w-4" />
                    </Button>
                    {user && (
                      <Button variant="ghost" size="sm" onClick={() => setReplyFor(replyFor === r.id ? null : r.id)}>
                        {t("review.reply")}
                      </Button>
                    )}
                  </div>

                  {replies.length > 0 && (
                    <div className="mt-3 space-y-2 border-l-2 border-border pl-3">
                      {replies.map((rep) => (
                        <p key={rep.id} className="flex items-start gap-2 text-sm">
                          <span className="flex-1">
                            <span className="font-semibold">@{people?.[rep.user_id]?.username ?? "user"}</span>{" "}
                            <span className="text-muted-foreground">{rep.body}</span>
                          </span>
                          {(isAdmin || rep.user_id === user?.id) && (
                            <button aria-label={t("common.delete")} className="text-muted-foreground hover:text-destructive" onClick={() => removeReply(rep.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </p>
                      ))}
                    </div>
                  )}

                  {replyFor === r.id && (
                    <div className="mt-3 flex gap-2">
                      <Input value={replyBody} onChange={(e) => setReplyBody(e.target.value)} maxLength={500} placeholder={t("review.reply")} />
                      <Button size="sm" onClick={() => sendReply(r.id)}>
                        {t("common.send")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
