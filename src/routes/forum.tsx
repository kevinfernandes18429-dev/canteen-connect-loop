import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowBigDown, ArrowBigUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/forum")({
  head: () => ({
    meta: [
      { title: "Forum Kantin — Kantin IPEKA Pluit" },
      { name: "description", content: "Diskusi makanan kantin IPEKA Pluit ala Reddit dengan upvote dan komentar." },
      { property: "og:title", content: "Forum Kantin — Kantin IPEKA Pluit" },
      { property: "og:description", content: "Bahas menu favorit bersama siswa lain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForumPage,
});

function ForumPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const { data: posts } = useQuery({
    queryKey: ["forum-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("forum_posts")
        .select("*, forum_votes(user_id, value), forum_comments(id, body, user_id, created_at)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: people } = useQuery({
    queryKey: ["forum-people", (posts ?? []).length],
    enabled: !!posts,
    queryFn: async () => {
      const ids = new Set<string>();
      for (const p of posts ?? []) {
        ids.add(p.user_id);
        for (const c of (p.forum_comments ?? []) as { user_id: string }[]) ids.add(c.user_id);
      }
      if (ids.size === 0) return {} as Record<string, string>;
      const { data } = await supabase.from("profiles").select("id, username").in("id", [...ids]);
      const map: Record<string, string> = {};
      for (const p of data ?? []) map[p.id] = p.username;
      return map;
    },
  });

  const createPost = async () => {
    if (!user || !title.trim()) return;
    const { error } = await supabase
      .from("forum_posts")
      .insert({ user_id: user.id, title: title.trim().slice(0, 150), body: body.trim().slice(0, 3000) });
    if (error) return toast.error(error.message.includes("BANNED_WORD") ? t("filter.blocked") : error.message);
    setOpen(false);
    setTitle("");
    setBody("");
    void qc.invalidateQueries({ queryKey: ["forum-posts"] });
  };

  const vote = async (postId: string, value: number) => {
    if (!user) return;
    await supabase.from("forum_votes").upsert({ post_id: postId, user_id: user.id, value }, { onConflict: "post_id,user_id" });
    void qc.invalidateQueries({ queryKey: ["forum-posts"] });
  };

  const sendComment = async (postId: string) => {
    if (!user || !comment.trim()) return;
    const { error } = await supabase
      .from("forum_comments")
      .insert({ post_id: postId, user_id: user.id, body: comment.trim().slice(0, 1000) });
    if (error) return toast.error(error.message.includes("BANNED_WORD") ? t("filter.blocked") : error.message);
    setComment("");
    setCommentFor(null);
    void qc.invalidateQueries({ queryKey: ["forum-posts"] });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">{t("forum.title")}</h1>
        {user ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">{t("forum.new")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("forum.new")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("forum.postTitle")}</Label>
                  <Input value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("forum.postBody")}</Label>
                  <Textarea value={body} rows={5} maxLength={3000} onChange={(e) => setBody(e.target.value)} />
                </div>
                <Button className="w-full" onClick={createPost}>
                  {t("forum.post")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Button asChild size="sm">
            <Link to="/auth">{t("auth.signin")}</Link>
          </Button>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {(posts ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("forum.empty")}</p>}
        {(posts ?? []).map((p) => {
          const votes = (p.forum_votes ?? []) as { user_id: string; value: number }[];
          const score = votes.reduce((s, v) => s + v.value, 0);
          const mine = votes.find((v) => v.user_id === user?.id)?.value ?? 0;
          const comments = (p.forum_comments ?? []) as { id: string; body: string; user_id: string }[];
          return (
            <article key={p.id} className="surface-card flex gap-3 p-5">
              <div className="flex flex-col items-center">
                <button className={mine === 1 ? "text-accent" : "text-muted-foreground"} onClick={() => vote(p.id, 1)}>
                  <ArrowBigUp className="h-5 w-5" />
                </button>
                <span className="text-sm font-bold">{score}</span>
                <button className={mine === -1 ? "text-primary" : "text-muted-foreground"} onClick={() => vote(p.id, -1)}>
                  <ArrowBigDown className="h-5 w-5" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{p.title}</h2>
                <p className="text-xs text-muted-foreground">@{people?.[p.user_id] ?? "user"}</p>
                {p.body && <p className="mt-2 whitespace-pre-wrap text-sm">{p.body}</p>}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 -ml-2"
                  onClick={() => setCommentFor(commentFor === p.id ? null : p.id)}
                >
                  <MessageSquare className="mr-1 h-4 w-4" />
                  {comments.length} {t("forum.comments")}
                </Button>
                {comments.length > 0 && (
                  <div className="mt-2 space-y-1.5 border-l-2 border-border pl-3">
                    {comments.map((c) => (
                      <p key={c.id} className="text-sm">
                        <span className="font-semibold">@{people?.[c.user_id] ?? "user"}</span>{" "}
                        <span className="text-muted-foreground">{c.body}</span>
                      </p>
                    ))}
                  </div>
                )}
                {commentFor === p.id && user && (
                  <div className="mt-3 flex gap-2">
                    <Input value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} />
                    <Button size="sm" onClick={() => sendComment(p.id)}>
                      {t("common.send")}
                    </Button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}