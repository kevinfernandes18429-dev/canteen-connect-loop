import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n, formatRupiah, type TKey } from "@/lib/i18n";
import { formatClass } from "@/lib/classes";
import { STATUS_STYLES } from "@/lib/constants";
import { adminDeleteUser, adminListUsers, adminSetRole, adminUpdateProfile } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Panel Admin — Kantin IPEKA Pluit" },
      { name: "description", content: "Kelola akun, kantin, chat, forum, dan filter kata Kantin IPEKA Pluit." },
      { property: "og:title", content: "Panel Admin — Kantin IPEKA Pluit" },
      { property: "og:description", content: "Manajemen penuh untuk admin kantin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const ROLES = ["student", "canteen_owner", "admin"] as const;

function ConfirmDelete({ text, onConfirm, label }: { text: string; onConfirm: () => void; label?: string }) {
  const { t } = useI18n();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
          {label ? <span className="ml-1">{label}</span> : null}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---------------- Users ---------------- */
function UsersTab() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const listUsers = useServerFn(adminListUsers);
  const setRole = useServerFn(adminSetRole);
  const deleteUser = useServerFn(adminDeleteUser);
  const updateProfile = useServerFn(adminUpdateProfile);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: string; username: string; full_name: string; class: string } | null>(null);

  const { data: users, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => listUsers() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });
  const onErr = (e: Error) => toast.error(e.message === "USERNAME_TAKEN" ? t("auth.usernameTaken") : e.message);

  const roleMut = useMutation({ mutationFn: (v: { userId: string; role: (typeof ROLES)[number] }) => setRole({ data: v }), onSuccess: invalidate, onError: onErr });
  const delMut = useMutation({ mutationFn: (userId: string) => deleteUser({ data: { userId } }), onSuccess: invalidate, onError: onErr });
  const editMut = useMutation({
    mutationFn: (v: NonNullable<typeof editing>) => updateProfile({ data: { userId: v.id, username: v.username, full_name: v.full_name, class: v.class } }),
    onSuccess: () => { setEditing(null); toast.success(t("settings.saved")); void invalidate(); },
    onError: onErr,
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users ?? []).filter((u) => !term || [u.username, u.full_name, u.email, u.class].some((v) => v?.toLowerCase().includes(term)));
  }, [users, q]);

  return (
    <div className="space-y-4">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.search")} className="max-w-md" />
      {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      <div className="space-y-2">
        {filtered.map((u) => (
          <div key={u.id} className="surface-card flex flex-wrap items-center gap-3 p-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={u.avatar_url ?? undefined} alt={u.username} />
              <AvatarFallback>{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                <Link to="/u/$username" params={{ username: u.username }} className="hover:underline">
                  {u.full_name || u.username}
                </Link>{" "}
                <span className="font-normal text-muted-foreground">@{u.username}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {u.email} · {u.class ? formatClass(u.class, lang) : "—"} · {t("admin.lastActive")}: {new Date(u.last_active_at).toLocaleDateString(lang === "en" ? "en-GB" : "id-ID")}
              </p>
            </div>
            <Select value={u.role} onValueChange={(v) => roleMut.mutate({ userId: u.id, role: v as (typeof ROLES)[number] })}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r === "student" ? t("auth.student") : r === "canteen_owner" ? t("auth.owner") : "Admin"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setEditing({ id: u.id, username: u.username, full_name: u.full_name, class: u.class })}>
              {t("common.edit")}
            </Button>
            <ConfirmDelete text={t("admin.deleteUserConfirm")} onConfirm={() => delMut.mutate(u.id)} />
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.edit")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{t("settings.username")}</Label>
                <Input value={editing.username} maxLength={20} onChange={(e) => setEditing({ ...editing, username: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>{t("auth.fullName")}</Label>
                <Input value={editing.full_name} maxLength={80} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>{t("auth.class")}</Label>
                <Input value={editing.class} maxLength={40} placeholder="SMA 11.2 Sains Murni" onChange={(e) => setEditing({ ...editing, class: e.target.value })} />
              </div>
              <Button onClick={() => editMut.mutate(editing)} disabled={editMut.isPending}>
                {t("settings.save")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Canteens ---------------- */
function CanteensTab() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: canteens } = useQuery({
    queryKey: ["admin-canteens"],
    queryFn: async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("canteens").select("*").order("name"),
        supabase.from("profiles").select("id, username"),
      ]);
      const names = new Map((p ?? []).map((x) => [x.id, x.username]));
      return (c ?? []).map((x) => ({ ...x, owner_username: x.owner_id ? names.get(x.owner_id) ?? null : null }));
    },
  });
  const [draft, setDraft] = useState<Record<string, { name: string; description: string; description_en: string }>>({});

  const save = async (id: string) => {
    const d = draft[id];
    if (!d) return;
    const { error } = await supabase.from("canteens").update({ name: d.name.slice(0, 60), description: d.description.slice(0, 300), description_en: d.description_en.slice(0, 300) }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("settings.saved"));
    void qc.invalidateQueries({ queryKey: ["admin-canteens"] });
  };
  const releaseOwner = async (id: string) => {
    const { error } = await supabase.from("canteens").update({ owner_id: null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["admin-canteens"] });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(canteens ?? []).map((c) => {
        const d = draft[c.id] ?? { name: c.name, description: c.description, description_en: c.description_en };
        const set = (patch: Partial<typeof d>) => setDraft({ ...draft, [c.id]: { ...d, ...patch } });
        return (
          <div key={c.id} className="surface-card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <Link to="/canteen/$slug" params={{ slug: c.slug }} className="text-xs text-primary hover:underline">
                /{c.slug}
              </Link>
              <span className="text-xs text-muted-foreground">
                {t("admin.owner")}: {c.owner_username ? "@" + c.owner_username : t("admin.noOwner")}
                {c.owner_id && (
                  <button className="ml-2 text-destructive hover:underline" onClick={() => releaseOwner(c.id)}>
                    ✕
                  </button>
                )}
              </span>
            </div>
            <Input value={d.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
            <Textarea value={d.description} rows={2} maxLength={300} placeholder="Deskripsi (ID)" onChange={(e) => set({ description: e.target.value })} />
            <Textarea value={d.description_en} rows={2} maxLength={300} placeholder="Description (EN)" onChange={(e) => set({ description_en: e.target.value })} />
            <Button size="sm" onClick={() => save(c.id)}>
              {t("settings.save")}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Chats ---------------- */
function ChatsTab() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-messages"],
    refetchInterval: 10000,
    queryFn: async () => {
      const [{ data: m }, { data: p }, { data: o }] = await Promise.all([
        supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("profiles").select("id, username"),
        supabase.from("orders").select("id, status, total, canteens(name)"),
      ]);
      const names = new Map((p ?? []).map((x) => [x.id, x.username]));
      const orders = new Map((o ?? []).map((x) => [x.id, x]));
      return (m ?? []).map((x) => ({ ...x, sender: names.get(x.sender_id) ?? "?", order: orders.get(x.order_id) }));
    },
  });

  const del = async (id: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["admin-messages"] });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>>();
    for (const m of data ?? []) {
      const arr = map.get(m.order_id) ?? [];
      arr.push(m);
      map.set(m.order_id, arr);
    }
    return [...map.entries()];
  }, [data]);

  return (
    <div className="space-y-4">
      {grouped.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
      {grouped.map(([orderId, msgs]) => {
        const o = msgs[0]?.order;
        return (
          <div key={orderId} className="surface-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold">
                {t("admin.order")} · {o?.canteens?.name ?? "?"} · {o ? formatRupiah(o.total) : ""}
              </span>
              {o && <span className={"rounded-full px-2 py-0.5 font-semibold " + (STATUS_STYLES[o.status] ?? "")}>{t(("status." + o.status) as TKey)}</span>}
            </div>
            <div className="space-y-1.5">
              {[...msgs].reverse().map((m) => (
                <div key={m.id} className="flex items-start gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold">@{m.sender}</span>{" "}
                    <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString(lang === "en" ? "en-GB" : "id-ID")}</span>
                    <p className="break-words">{m.body}</p>
                  </div>
                  <ConfirmDelete text={t("admin.deleteMsgConfirm")} onConfirm={() => del(m.id)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Forum ---------------- */
function ForumTab() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-forum"],
    queryFn: async () => {
      const [{ data: posts }, { data: p }] = await Promise.all([
        supabase.from("forum_posts").select("id, title, body, user_id, created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("id, username"),
      ]);
      const names = new Map((p ?? []).map((x) => [x.id, x.username]));
      return (posts ?? []).map((x) => ({ ...x, author: names.get(x.user_id) ?? "?" }));
    },
  });
  const del = async (id: string) => {
    await supabase.from("forum_comments").delete().eq("post_id", id);
    await supabase.from("forum_votes").delete().eq("post_id", id);
    const { error } = await supabase.from("forum_posts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["admin-forum"] });
  };
  return (
    <div className="space-y-2">
      {(data ?? []).map((p) => (
        <div key={p.id} className="surface-card flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{p.title}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">{p.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">@{p.author}</p>
          </div>
          <ConfirmDelete text={t("admin.deletePostConfirm")} onConfirm={() => del(p.id)} />
        </div>
      ))}
    </div>
  );
}

/* ---------------- Banned words ---------------- */
function WordsTab() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [word, setWord] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-words"],
    queryFn: async () => (await supabase.from("banned_words").select("word").order("word")).data ?? [],
  });
  const add = async () => {
    const w = word.trim().toLowerCase();
    if (!w || w.length > 40) return;
    const { error } = await supabase.from("banned_words").insert({ word: w });
    if (error) { toast.error(error.message); return; }
    setWord("");
    void qc.invalidateQueries({ queryKey: ["admin-words"] });
  };
  const remove = async (w: string) => {
    const { error } = await supabase.from("banned_words").delete().eq("word", w);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["admin-words"] });
  };
  return (
    <div className="space-y-4">
      <div className="flex max-w-md gap-2">
        <Input value={word} maxLength={40} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add}>{t("admin.addWord")}</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(data ?? []).map((w) => (
          <span key={w.word} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1 text-sm">
            {w.word}
            <button aria-label={t("admin.deleteWord")} className="text-muted-foreground hover:text-destructive" onClick={() => remove(w.word)}>
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function AdminPage() {
  const { t } = useI18n();
  const { user, role, loading } = useAuth();

  if (loading) return <p className="px-4 py-20 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!user || role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-muted-foreground">{t("admin.forbidden")}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/">{t("common.back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("admin.title")}</h1>
      <Tabs defaultValue="users" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users">{t("admin.users")}</TabsTrigger>
          <TabsTrigger value="canteens">{t("admin.canteens")}</TabsTrigger>
          <TabsTrigger value="chats">{t("admin.chats")}</TabsTrigger>
          <TabsTrigger value="forum">{t("admin.forum")}</TabsTrigger>
          <TabsTrigger value="words">{t("admin.words")}</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
        <TabsContent value="canteens" className="mt-6"><CanteensTab /></TabsContent>
        <TabsContent value="chats" className="mt-6"><ChatsTab /></TabsContent>
        <TabsContent value="forum" className="mt-6"><ForumTab /></TabsContent>
        <TabsContent value="words" className="mt-6"><WordsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
