import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowBigDown, ArrowBigUp, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n, formatRupiah } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
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

export function CanteenReviews({ canteenId }: { canteenId: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [food, setFood] = useState(5);
  const [service, setService] = useState(5);
  const [body, setBody] = useState("");
  const [orderType, setOrderType] = useState("");
  const [foodType, setFoodType] = useState("");
  const [price, setPrice] = useState("");
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

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reviews").insert({
        canteen_id: canteenId,
        user_id: user!.id,
        body: body.trim().slice(0, 1000),
        order_type: orderType.slice(0, 60),
        food_type: foodType.slice(0, 60),
        price_per_person: Number(price) || 0,
        food_rating: food,
        service_rating: service,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false);
      setBody("");
      void qc.invalidateQueries({ queryKey: ["reviews", canteenId] });
      toast.success(t("settings.saved"));
    },
    onError: (e: Error) => toast.error(e.message.includes("BANNED_WORD") ? t("filter.blocked") : e.message),
  });

  const vote = async (reviewId: string, value: number) => {
    if (!user) return;
    await supabase.from("review_votes").upsert({ review_id: reviewId, user_id: user.id, value }, { onConflict: "review_id,user_id" });
    void qc.invalidateQueries({ queryKey: ["reviews", canteenId] });
  };

  const sendReply = async (reviewId: string) => {
    if (!user || !replyBody.trim()) return;
    const { error } = await supabase
      .from("review_replies")
      .insert({ review_id: reviewId, user_id: user.id, body: replyBody.trim().slice(0, 500) });
    if (error) {
      toast.error(error.message.includes("BANNED_WORD") ? t("filter.blocked") : error.message);
      return;
    }
    setReplyBody("");
    setReplyFor(null);
    void qc.invalidateQueries({ queryKey: ["reviews", canteenId] });
  };

  return (
    <section className="mt-14">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">{t("review.title")}</h2>
        {user && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                {t("review.write")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("review.write")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>{t("review.food")}</Label>
                  <Stars value={food} onChange={setFood} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t("review.service")}</Label>
                  <Stars value={service} onChange={setService} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("review.orderType")}</Label>
                  <Input value={orderType} onChange={(e) => setOrderType(e.target.value)} maxLength={60} placeholder="Pre-order / Dine in" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("review.foodType")}</Label>
                  <Input value={foodType} onChange={(e) => setFoodType(e.target.value)} maxLength={60} placeholder="Ricebowl, snack..." />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("review.pricePerPerson")}</Label>
                  <Input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 7))} inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("review.body")}</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={4} />
                </div>
                <Button className="w-full" onClick={() => submit.mutate()} disabled={submit.isPending}>
                  {t("review.submit")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mt-5 space-y-4">
        {(reviews ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("review.empty")}</p>}
        {(reviews ?? []).map((r) => {
          const author = people?.[r.user_id] ?? null;
          const votes = (r.review_votes ?? []) as { user_id: string; value: number }[];
          const score = votes.reduce((s, v) => s + v.value, 0);
          const mine = votes.find((v) => v.user_id === user?.id)?.value ?? 0;
          const replies = (r.review_replies ?? []) as { id: string; body: string; user_id: string }[];
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
                    <span className="text-xs text-muted-foreground">{author?.class}</span>
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
                    {r.order_type && <span>{t("review.orderType")}: {r.order_type}</span>}
                    {r.food_type && <span>{t("review.foodType")}: {r.food_type}</span>}
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
                        <p key={rep.id} className="text-sm">
                          <span className="font-semibold">@{people?.[rep.user_id]?.username ?? "user"}</span>{" "}
                          <span className="text-muted-foreground">{rep.body}</span>
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
