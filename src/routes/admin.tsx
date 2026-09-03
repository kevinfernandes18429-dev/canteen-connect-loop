import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n, formatRupiah } from "@/lib/i18n";
import { formatClass, isClassComplete, parseClass, serializeClass, type ClassValue } from "@/lib/classes";
import { adminDeleteUsers, adminListUsers, adminSetRole, adminUpdateProfile, adminVerifyOwner } from "@/lib/admin.functions";
import { ReviewEditor, Stars, orderTypeLabel } from "@/components/app/CanteenReviews";
import { ClassPicker } from "@/components/app/ClassPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
      { name: "description", content: "Kelola akun, kantin, chat, forum, ulasan, dan filter kata Kantin IPEKA Pluit." },
      { property: "og:title", content: "Panel Admin — Kantin IPEKA Pluit" },
      { property: "og:description", content: "Manajemen penuh untuk admin kantin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const ROLES = ["student", "canteen_owner", "admin"] as const;

function ConfirmDelete({ text, onConfirm, label, variant = "ghost" }: { text: string; onConfirm: () => void; label?: string; variant?: "ghost" | "destructive" }) {
  const { t } = useI18n();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size="sm" className={variant === "ghost" ? "text-destructive hover:text-destructive" : ""}>
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

/** Generic multi-select state helper for bulk actions. */
function useSelection(allIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleAll = (on: boolean) => setSelected(on ? new Set(allIds) : new Set());
  const clear = () => setSelected(new Set());
  return { selected, toggle, allSelected, toggleAll, clear, ids: [...selected].filter((id) => allIds.includes(id)) };
}

function BulkBar({ count, allSelected, onToggleAll, onDelete, children }: { count: number; allSelected: boolean; onToggleAll: (v: boolean) => void; onDelete: () => void; children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className={"flex flex-wrap items-center gap-3 rounded-xl border p-3 " + (count > 0 ? "border-primary/30 bg-primary/5" : "border-border")}>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox checked={allSelected} onCheckedChange={(v) => onToggleAll(!!v)} />
        {t("seller.selectAll")}
      </label>
      {count > 0 && (
        <>
          <span className="text-sm font-semibold">{count} {t("seller.selected")}</span>
          {children}
          <span className="ml-auto">
            <ConfirmDelete variant="destructive" label={t("seller.deleteSelected")} text={t("admin.deleteSelectedConfirm")} onConfirm={onDelete} />
          </span>
        </>
      )}
    </div>
  );
}

/* ---------------- Users ---------------- */
function UsersTab() {
  const { t, lang } = useI18n();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const listUsers = useServerFn(adminListUsers);
  const setRole = useServerFn(adminSetRole);
  const deleteUsers = useServerFn(adminDeleteUsers);
  const updateProfile = useServerFn(adminUpdateProfile);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: string; username: string; full_name: string; role: string; klass: ClassValue } | null>(null);

  const { data: users, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => listUsers() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });
  const onErr = (e: Error) => toast.error(e.message === "USERNAME_TAKEN" ? t("auth.usernameTaken") : e.message);

  const roleMut = useMutation({ mutationFn: (v: { userId: string; role: (typeof ROLES)[number] }) => setRole({ data: v }), onSuccess: invalidate, onError: onErr });
  const delMut = useMutation({ mutationFn: (userIds: string[]) => deleteUsers({ data: { userIds } }), onSuccess: () => { sel.clear(); void invalidate(); }, onError: onErr });
  const editMut = useMutation({
    mutationFn: (v: NonNullable<typeof editing>) =>
      updateProfile({ data: { userId: v.id, username: v.username, full_name: v.full_name, class: v.role === "student" ? serializeClass(v.klass) : "" } }),
    onSuccess: () => { setEditing(null); toast.success(t("settings.saved")); void invalidate(); },
    onError: onErr,
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users ?? []).filter((u) => !term || [u.username, u.full_name, u.email, u.class].some((v) => v?.toLowerCase().includes(term)));
  }, [users, q]);
  const sel = useSelection(filtered.filter((u) => u.id !== me?.id).map((u) => u.id));

  return (
    <div className="space-y-4">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.search")} className="max-w-md" />
      <BulkBar count={sel.ids.length} allSelected={sel.allSelected} onToggleAll={sel.toggleAll} onDelete={() => delMut.mutate(sel.ids)} />
      {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      <div className="space-y-2">
        {filtered.map((u) => (
          <div key={u.id} className={"surface-card flex flex-wrap items-center gap-3 p-3 " + (sel.selected.has(u.id) ? "ring-2 ring-primary/40" : "")}>
            <Checkbox checked={sel.selected.has(u.id)} disabled={u.id === me?.id} onCheckedChange={(v) => sel.toggle(u.id, !!v)} aria-label={u.username} />
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
                {u.email}
                {u.role === "student" ? " · " + (u.class && u.class !== "-" ? formatClass(u.class, lang) : "—") : ""} · {t("admin.lastActive")}: {new Date(u.last_active_at).toLocaleDateString(lang === "en" ? "en-GB" : "id-ID")}
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
            <Button variant="outline" size="sm" onClick={() => setEditing({ id: u.id, username: u.username, full_name: u.full_name, role: u.role, klass: parseClass(u.class) })}>
              {t("common.edit")}
            </Button>
            {u.id !== me?.id && <ConfirmDelete text={t("admin.deleteUserConfirm")} onConfirm={() => delMut.mutate([u.id])} />}
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
              {editing.role === "student" && (
                <div className="space-y-1">
                  <Label>{t("auth.class")}</Label>
                  <ClassPicker value={editing.klass} onChange={(v) => setEditing({ ...editing, klass: v })} />
                </div>
              )}
              <Button
                onClick={() => editMut.mutate(editing)}
                disabled={editMut.isPending || (editing.role === "student" && !isClassComplete(editing.klass))}
              >
                {t("settings.save")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Owner sign-ups ---------------- */
function OwnerSignupsTab() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const listUsers = useServerFn(adminListUsers);
  const verify = useServerFn(adminVerifyOwner);
  const setRole = useServerFn(adminSetRole);
  const [choice, setChoice] = useState<Record<string, string>>({});

  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: () => listUsers() });
  const { data: canteens } = useQuery({
    queryKey: ["admin-canteens-lite"],
    queryFn: async () => (await supabase.from("canteens").select("id, name, owner_id").order("name")).data ?? [],
  });

  const ownedBy = new Map((canteens ?? []).filter((c) => c.owner_id).map((c) => [c.owner_id as string, c]));
  const pending = (users ?? []).filter((u) => u.role === "canteen_owner" && !ownedBy.has(u.id));
  const verified = (users ?? []).filter((u) => u.role === "canteen_owner" && ownedBy.has(u.id));

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
    void qc.invalidateQueries({ queryKey: ["admin-canteens-lite"] });
    void qc.invalidateQueries({ queryKey: ["admin-canteens"] });
  };
  const verifyMut = useMutation({
    mutationFn: (v: { userId: string; canteenId: string }) => verify({ data: v }),
    onSuccess: () => { toast.success(t("admin.verified")); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: (userId: string) => setRole({ data: { userId, role: "student" } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const Row = ({ u, actions }: { u: (typeof pending)[number]; actions: ReactNode }) => (
    <div className="surface-card flex flex-wrap items-center gap-3 p-3">
      <Avatar className="h-9 w-9">
        <AvatarImage src={u.avatar_url ?? undefined} alt={u.username} />
        <AvatarFallback>{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {u.full_name || u.username} <span className="font-normal text-muted-foreground">@{u.username}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {u.email} · {t("admin.registeredAt")}: {new Date(u.created_at).toLocaleDateString(lang === "en" ? "en-GB" : "id-ID")}
        </p>
      </div>
      {actions}
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("admin.pendingOwners")} ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-muted-foreground">{t("admin.noPending")}</p>}
        {pending.map((u) => (
          <Row
            key={u.id}
            u={u}
            actions={
              <>
                <Select value={choice[u.id] ?? ""} onValueChange={(v) => setChoice({ ...choice, [u.id]: v })}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder={t("admin.assignCanteen")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(canteens ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.owner_id ? "·" : ""} {c.owner_id ? t("admin.owner").toLowerCase() : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!choice[u.id] || verifyMut.isPending} onClick={() => verifyMut.mutate({ userId: u.id, canteenId: choice[u.id]! })}>
                  {t("admin.verify")}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => rejectMut.mutate(u.id)}>
                  {t("admin.reject")}
                </Button>
              </>
            }
          />
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("admin.verified")} ({verified.length})</h2>
        {verified.map((u) => (
          <Row key={u.id} u={u} actions={<span className="rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">{ownedBy.get(u.id)?.name}</span>} />
        ))}
      </section>
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
    void qc.invalidateQueries({ queryKey: ["admin-canteens-lite"] });
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
    queryKey: ["admin-conversations"],
    refetchInterval: 10000,
    queryFn: async () => {
      const [{ data: convs }, { data: m }, { data: p }, { data: c }] = await Promise.all([
        supabase.from("conversations").select("id, canteen_id, student_id, last_message_at").order("last_message_at", { ascending: false }).limit(100),
        supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("profiles").select("id, username"),
        supabase.from("canteens").select("id, name"),
      ]);
      const names = new Map((p ?? []).map((x) => [x.id, x.username]));
      const cnames = new Map((c ?? []).map((x) => [x.id, x.name]));
      const byConv = new Map<string, NonNullable<typeof m>>();
      for (const msg of m ?? []) {
        const arr = byConv.get(msg.conversation_id) ?? [];
        arr.push(msg);
        byConv.set(msg.conversation_id, arr);
      }
      return (convs ?? []).map((cv) => ({
        ...cv,
        canteen: cv.canteen_id ? cnames.get(cv.canteen_id) ?? "?" : "DM · @" + (names.get((cv as { peer_id?: string | null }).peer_id ?? "") ?? "?"),
        student: names.get(cv.student_id) ?? "?",
        messages: (byConv.get(cv.id) ?? []).slice().reverse().map((x) => ({ ...x, sender: names.get(x.sender_id) ?? "?" })),
      }));
    },
  });

  const allMsgIds = useMemo(() => (data ?? []).flatMap((cv) => cv.messages.map((m) => m.id)), [data]);
  const sel = useSelection(allMsgIds);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-conversations"] });

  const delMessages = async (ids: string[]) => {
    const { error } = await supabase.from("messages").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    sel.clear();
    void invalidate();
  };
  const delConversation = async (id: string) => {
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void invalidate();
  };

  return (
    <div className="space-y-4">
      <BulkBar count={sel.ids.length} allSelected={sel.allSelected} onToggleAll={sel.toggleAll} onDelete={() => delMessages(sel.ids)} />
      {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">—</p>}
      {(data ?? []).map((cv) => (
        <div key={cv.id} className="surface-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <label className="flex items-center gap-2 font-semibold">
              <Checkbox
                checked={cv.messages.length > 0 && cv.messages.every((m) => sel.selected.has(m.id))}
                onCheckedChange={(v) => cv.messages.forEach((m) => sel.toggle(m.id, !!v))}
              />
              {t("admin.conversation")} · {cv.canteen} ↔ @{cv.student}
            </label>
            <span className="flex items-center gap-2">
              <Button asChild size="sm" variant="ghost">
                <Link to="/chat" search={{ c: cv.id }}>{t("nav.chat")}</Link>
              </Button>
              <ConfirmDelete text={t("admin.deleteConvConfirm")} onConfirm={() => delConversation(cv.id)} />
            </span>
          </div>
          <div className="space-y-1.5">
            {cv.messages.map((m) => (
              <div key={m.id} className={"flex items-start gap-2 rounded-xl px-3 py-2 text-sm " + (sel.selected.has(m.id) ? "bg-primary/10" : "bg-secondary/60")}>
                <Checkbox className="mt-1" checked={sel.selected.has(m.id)} onCheckedChange={(v) => sel.toggle(m.id, !!v)} />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">@{m.sender}</span>{" "}
                  <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString(lang === "en" ? "en-GB" : "id-ID")}</span>
                  <p className="break-words">{m.body}</p>
                </div>
                <ConfirmDelete text={t("admin.deleteMsgConfirm")} onConfirm={() => delMessages([m.id])} />
              </div>
            ))}
          </div>
        </div>
      ))}
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
  const sel = useSelection((data ?? []).map((p) => p.id));
  const del = async (ids: string[]) => {
    const { error } = await supabase.from("forum_posts").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    sel.clear();
    void qc.invalidateQueries({ queryKey: ["admin-forum"] });
  };
  return (
    <div className="space-y-3">
      <BulkBar count={sel.ids.length} allSelected={sel.allSelected} onToggleAll={sel.toggleAll} onDelete={() => del(sel.ids)} />
      {(data ?? []).map((p) => (
        <div key={p.id} className={"surface-card flex items-start gap-3 p-4 " + (sel.selected.has(p.id) ? "ring-2 ring-primary/40" : "")}>
          <Checkbox className="mt-1" checked={sel.selected.has(p.id)} onCheckedChange={(v) => sel.toggle(p.id, !!v)} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{p.title}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">{p.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">@{p.author}</p>
          </div>
          <ConfirmDelete text={t("admin.deletePostConfirm")} onConfirm={() => del([p.id])} />
        </div>
      ))}
    </div>
  );
}

/* ---------------- Reviews ---------------- */
function ReviewsTab() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id: string; canteenId: string } | null>(null);
  const [initial, setInitial] = useState({ food: 5, service: 5, body: "", orderType: "", foods: [] as string[], price: 0, quantity: 1 });
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const [{ data: r }, { data: p }, { data: c }] = await Promise.all([
        supabase.from("reviews").select("*, review_replies(id, body, user_id)").order("created_at", { ascending: false }).limit(300),
        supabase.from("profiles").select("id, username"),
        supabase.from("canteens").select("id, name"),
      ]);
      const names = new Map((p ?? []).map((x) => [x.id, x.username]));
      const cnames = new Map((c ?? []).map((x) => [x.id, x.name]));
      return (r ?? []).map((x) => ({ ...x, author: names.get(x.user_id) ?? "?", canteen: cnames.get(x.canteen_id) ?? "?", replies: (x.review_replies ?? []).map((rep) => ({ ...rep, author: names.get(rep.user_id) ?? "?" })) }));
    },
  });
  const sel = useSelection((data ?? []).map((r) => r.id));
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    void qc.invalidateQueries({ queryKey: ["reviews"] });
  };
  const del = async (ids: string[]) => {
    const { error } = await supabase.from("reviews").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    sel.clear();
    invalidate();
  };
  const delReply = async (id: string) => {
    const { error } = await supabase.from("review_replies").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidate();
  };
  const reply = async (reviewId: string) => {
    if (!user || !replyBody.trim()) return;
    const { error } = await supabase.from("review_replies").insert({ review_id: reviewId, user_id: user.id, body: replyBody.trim().slice(0, 500) });
    if (error) { toast.error(error.message.includes("BANNED_WORD") ? t("filter.blocked") : error.message); return; }
    setReplyBody("");
    setReplyFor(null);
    invalidate();
  };
  const saveEdit = async (f: typeof initial) => {
    if (!editing) return;
    const { error } = await supabase
      .from("reviews")
      .update({ body: f.body.trim().slice(0, 1000), order_type: f.orderType, food_type: f.foods.join(", ").slice(0, 200), price_per_person: f.price, food_rating: f.food, service_rating: f.service })
      .eq("id", editing.id);
    if (error) { toast.error(error.message.includes("BANNED_WORD") ? t("filter.blocked") : error.message); return; }
    setEditing(null);
    toast.success(t("settings.saved"));
    invalidate();
  };

  return (
    <div className="space-y-3">
      <BulkBar count={sel.ids.length} allSelected={sel.allSelected} onToggleAll={sel.toggleAll} onDelete={() => del(sel.ids)} />
      {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("review.empty")}</p>}
      {(data ?? []).map((r) => (
        <div key={r.id} className={"surface-card flex items-start gap-3 p-4 " + (sel.selected.has(r.id) ? "ring-2 ring-primary/40" : "")}>
          <Checkbox className="mt-1" checked={sel.selected.has(r.id)} onCheckedChange={(v) => sel.toggle(r.id, !!v)} />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold">@{r.author}</span> <span className="text-muted-foreground">· {r.canteen}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">{t("review.food")} <Stars value={Number(r.food_rating)} /></span>
              <span className="flex items-center gap-1">{t("review.service")} <Stars value={Number(r.service_rating)} /></span>
              {r.order_type && <span>{orderTypeLabel(r.order_type, t)}</span>}
              {r.food_type && <span>{r.food_type}</span>}
              {r.price_per_person > 0 && <span>{formatRupiah(r.price_per_person)}</span>}
            </div>
            {r.body && <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>}
            {r.replies.length > 0 && (
              <div className="mt-2 space-y-1 border-l-2 border-border pl-3 text-sm">
                {r.replies.map((rep) => (
                  <p key={rep.id} className="flex items-start gap-2">
                    <span className="flex-1"><span className="font-semibold">@{rep.author}</span> <span className="text-muted-foreground">{rep.body}</span></span>
                    <button aria-label={t("common.delete")} className="text-muted-foreground hover:text-destructive" onClick={() => delReply(rep.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </p>
                ))}
              </div>
            )}
            {replyFor === r.id ? (
              <div className="mt-2 flex gap-2">
                <Input value={replyBody} maxLength={500} onChange={(e) => setReplyBody(e.target.value)} placeholder={t("review.reply")} />
                <Button size="sm" onClick={() => reply(r.id)}>{t("common.send")}</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => setReplyFor(r.id)}>{t("review.reply")}</Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("admin.editReview")}
            onClick={() => {
              setInitial({ food: Number(r.food_rating), service: Number(r.service_rating), body: r.body, orderType: r.order_type, foods: r.food_type ? r.food_type.split(", ").filter(Boolean) : [], price: r.price_per_person, quantity: r.quantity ?? 1 });
              setEditing({ id: r.id, canteenId: r.canteen_id });
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <ConfirmDelete text={t("admin.deleteReviewConfirm")} onConfirm={() => del([r.id])} />
        </div>
      ))}
      {editing && (
        <ReviewEditor canteenId={editing.canteenId} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={initial} onSave={saveEdit} />
      )}
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
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="users">{t("admin.users")}</TabsTrigger>
          <TabsTrigger value="owners">{t("admin.ownerSignups")}</TabsTrigger>
          <TabsTrigger value="canteens">{t("admin.canteens")}</TabsTrigger>
          <TabsTrigger value="chats">{t("admin.chats")}</TabsTrigger>
          <TabsTrigger value="forum">{t("admin.forum")}</TabsTrigger>
          <TabsTrigger value="reviews">{t("admin.reviews")}</TabsTrigger>
          <TabsTrigger value="words">{t("admin.words")}</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
        <TabsContent value="owners" className="mt-6"><OwnerSignupsTab /></TabsContent>
        <TabsContent value="canteens" className="mt-6"><CanteensTab /></TabsContent>
        <TabsContent value="chats" className="mt-6"><ChatsTab /></TabsContent>
        <TabsContent value="forum" className="mt-6"><ForumTab /></TabsContent>
        <TabsContent value="reviews" className="mt-6"><ReviewsTab /></TabsContent>
        <TabsContent value="words" className="mt-6"><WordsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
