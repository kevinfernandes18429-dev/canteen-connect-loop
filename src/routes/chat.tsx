import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, SendHorizontal, Store, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { canteenImage } from "@/lib/canteen-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/chat")({
  validateSearch: z.object({
    canteen: z.string().optional(),
    c: z.string().optional(),
    student: z.string().optional(),
    u: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Chat — Kantin IPEKA Pluit" },
      { name: "description", content: "Chat langsung antara siswa dan penjual kantin IPEKA Pluit." },
      { property: "og:title", content: "Chat — Kantin IPEKA Pluit" },
      { property: "og:description", content: "Chat langsung dengan penjual kantin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

type Contact = {
  key: string;
  kind: "canteen" | "dm";
  canteenId: string | null;
  canteenSlug: string;
  studentId: string;
  peerId: string | null;
  conversationId: string | null;
  title: string;
  subtitle: string;
  avatar: string | null;
  lastAt: string | null;
  disabled?: boolean;
};

type CanteenRow = { id: string; name: string; slug: string; image_url: string | null; owner_id: string | null };
type ProfileRow = { id: string; username: string; full_name: string; avatar_url: string | null };

function ChatPage() {
  const { t } = useI18n();
  const { user, role, loading } = useAuth();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["chat-contacts", user?.id, role],
    enabled: !!user && !!role,
    refetchInterval: 10000,
    queryFn: async (): Promise<Contact[]> => {
      const uid = user!.id;
      const { data: canteens } = await supabase.from("canteens").select("id, name, slug, image_url, owner_id").order("name");
      const cs: CanteenRow[] = canteens ?? [];
      const ownerToCanteen = new Map(cs.filter((c) => c.owner_id).map((c) => [c.owner_id as string, c]));
      const out: Contact[] = [];

      // --- Canteen conversations ---
      if (role === "student") {
        const { data: convs } = await supabase.from("conversations").select("id, canteen_id, last_message_at").eq("student_id", uid).not("canteen_id", "is", null);
        const byCanteen = new Map((convs ?? []).map((c) => [c.canteen_id as string, c]));
        for (const c of cs) {
          const conv = byCanteen.get(c.id);
          out.push({
            key: "c:" + c.id,
            kind: "canteen",
            canteenId: c.id,
            canteenSlug: c.slug,
            studentId: uid,
            peerId: null,
            conversationId: conv?.id ?? null,
            title: c.name,
            subtitle: c.owner_id ? t("auth.owner") : t("chat.noOwner"),
            avatar: c.image_url ?? canteenImage(c.slug),
            lastAt: conv?.last_message_at ?? null,
            disabled: !c.owner_id,
          });
        }
      } else {
        const mine = role === "admin" ? cs : cs.filter((c) => c.owner_id === uid);
        const myIds = mine.map((c) => c.id);
        if (myIds.length > 0) {
          const [{ data: convs }, { data: orders }] = await Promise.all([
            supabase.from("conversations").select("id, canteen_id, student_id, last_message_at").in("canteen_id", myIds),
            role === "admin"
              ? Promise.resolve({ data: [] as { canteen_id: string; user_id: string }[] })
              : supabase.from("orders").select("canteen_id, user_id").in("canteen_id", myIds),
          ]);
          const map = new Map<string, Contact>();
          const cname = new Map(mine.map((c) => [c.id, c]));
          for (const cv of convs ?? []) {
            const k = "c:" + cv.canteen_id + ":" + cv.student_id;
            map.set(k, {
              key: k,
              kind: "canteen",
              canteenId: cv.canteen_id,
              canteenSlug: cname.get(cv.canteen_id as string)?.slug ?? "",
              studentId: cv.student_id,
              peerId: null,
              conversationId: cv.id,
              title: "",
              subtitle: role === "admin" ? cname.get(cv.canteen_id as string)?.name ?? "" : "",
              avatar: null,
              lastAt: cv.last_message_at,
            });
          }
          for (const o of orders ?? []) {
            const k = "c:" + o.canteen_id + ":" + o.user_id;
            if (!map.has(k)) {
              map.set(k, {
                key: k,
                kind: "canteen",
                canteenId: o.canteen_id,
                canteenSlug: cname.get(o.canteen_id)?.slug ?? "",
                studentId: o.user_id,
                peerId: null,
                conversationId: null,
                title: "",
                subtitle: "",
                avatar: null,
                lastAt: null,
              });
            }
          }
          out.push(...map.values());
        }
      }

      // --- Direct messages (added by username) ---
      const { data: dms } = await supabase
        .from("conversations")
        .select("id, student_id, peer_id, last_message_at")
        .not("peer_id", "is", null)
        .or(`student_id.eq.${uid},peer_id.eq.${uid}`);
      for (const d of dms ?? []) {
        const other = d.student_id === uid ? (d.peer_id as string) : d.student_id;
        out.push({
          key: "d:" + other,
          kind: "dm",
          canteenId: null,
          canteenSlug: "",
          studentId: d.student_id,
          peerId: d.peer_id,
          conversationId: d.id,
          title: "",
          subtitle: t("chat.direct"),
          avatar: null,
          lastAt: d.last_message_at,
        });
      }

      // --- Resolve people (students in canteen chats, DM peers) ---
      const peopleIds = new Set<string>();
      for (const c of out) {
        if (c.kind === "canteen" && role !== "student") peopleIds.add(c.studentId);
        if (c.kind === "dm") peopleIds.add(c.studentId === uid ? (c.peerId as string) : c.studentId);
      }
      if (peopleIds.size > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", [...peopleIds]);
        const pm = new Map<string, ProfileRow>((profiles ?? []).map((p) => [p.id, p]));
        for (const c of out) {
          const pid = c.kind === "dm" ? (c.studentId === uid ? (c.peerId as string) : c.studentId) : c.studentId;
          if (c.kind === "canteen" && role === "student") continue;
          const p = pm.get(pid);
          // A canteen owner is always presented as their canteen
          const ownedCanteen = ownerToCanteen.get(pid);
          if (ownedCanteen) {
            c.title = ownedCanteen.name;
            c.avatar = ownedCanteen.image_url ?? canteenImage(ownedCanteen.slug);
            c.subtitle = t("auth.owner") + (c.subtitle ? " · " + c.subtitle : "");
          } else {
            c.title = p?.full_name || p?.username || "?";
            c.subtitle = (p ? "@" + p.username : "") + (c.subtitle ? " · " + c.subtitle : "");
            c.avatar = p?.avatar_url ?? null;
          }
        }
      }
      return out.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
    },
  });

  // Pick contact from URL once contacts load
  useEffect(() => {
    if (!contacts || activeKey) return;
    if (search.c) {
      const hit = contacts.find((c) => c.conversationId === search.c);
      if (hit) setActiveKey(hit.key);
    } else if (search.canteen) {
      const hit = contacts.find((c) => c.kind === "canteen" && c.canteenSlug === search.canteen);
      if (hit) setActiveKey(hit.key);
    } else if (search.student) {
      const hit = contacts.find((c) => c.kind === "canteen" && c.studentId === search.student);
      if (hit) setActiveKey(hit.key);
    } else if (search.u) {
      setAddName(search.u);
      setAddOpen(true);
    }
  }, [contacts, search.c, search.canteen, search.student, search.u, activeKey]);

  const addContact = async () => {
    const uname = addName.trim().replace(/^@/, "").toLowerCase();
    if (!user || !uname) return;
    setAdding(true);
    try {
      const { data: p } = await supabase.from("profiles").select("id, username").eq("username", uname).maybeSingle();
      if (!p) { toast.error(t("chat.userNotFound")); return; }
      if (p.id === user.id) return;
      // Owners are reached through their canteen
      const { data: owned } = await supabase.from("canteens").select("id, slug").eq("owner_id", p.id).maybeSingle();
      if (owned && role === "student") {
        setActiveKey("c:" + owned.id);
        setAddOpen(false);
        return;
      }
      const existing = (contacts ?? []).find((c) => c.kind === "dm" && (c.peerId === p.id || c.studentId === p.id));
      if (existing) {
        setActiveKey(existing.key);
        setAddOpen(false);
        return;
      }
      const { error } = await supabase.from("conversations").insert({ student_id: user.id, peer_id: p.id });
      if (error && !error.message.includes("duplicate")) { toast.error(error.message); return; }
      await qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      setActiveKey("d:" + p.id);
      setAddOpen(false);
      setAddName("");
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <p className="px-4 py-20 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;
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

  const term = q.trim().toLowerCase();
  const list = (contacts ?? []).filter((c) => !term || c.title.toLowerCase().includes(term) || c.subtitle.toLowerCase().includes(term));
  const canteenList = list.filter((c) => c.kind === "canteen");
  const peopleList = list.filter((c) => c.kind === "dm");
  const active = (contacts ?? []).find((c) => c.key === activeKey) ?? null;

  const renderContact = (c: Contact) => (
    <button
      key={c.key}
      type="button"
      disabled={c.disabled}
      onClick={() => setActiveKey(c.key)}
      className={
        "flex w-full items-center gap-3 border-b border-border/60 px-3 py-3 text-left transition-all duration-200 hover:bg-secondary/70 active:scale-[0.99] disabled:opacity-50 " +
        (c.key === activeKey ? "bg-secondary" : "")
      }
    >
      <Avatar className="h-11 w-11">
        <AvatarImage src={c.avatar ?? undefined} alt={c.title} className="object-cover" />
        <AvatarFallback>{c.title.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{c.title}</p>
          {c.lastAt && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {new Date(c.lastAt).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{c.subtitle}</p>
      </div>
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="surface-card anim-pop grid h-[calc(100dvh-9rem)] min-h-[520px] overflow-hidden md:grid-cols-[320px_1fr]">
        {/* Contacts */}
        <aside className={"flex flex-col border-r border-border " + (active ? "hidden md:flex" : "flex")}>
          <div className="border-b border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h1 className="font-display text-lg font-bold">{t("chat.title")}</h1>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("chat.addContact")} onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("chat.searchContacts")} className="h-9 rounded-full" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading && <p className="p-4 text-sm text-muted-foreground">{t("common.loading")}</p>}
            {!isLoading && list.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("chat.noContacts")}</p>}
            {canteenList.length > 0 && (
              <>
                <p className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Store className="h-3 w-3" /> {role === "student" ? t("chat.canteens") : t("seller.customer")}
                </p>
                <div className="stagger">{canteenList.map(renderContact)}</div>
              </>
            )}
            {peopleList.length > 0 && (
              <>
                <p className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <UserPlus className="h-3 w-3" /> {t("chat.people")}
                </p>
                <div className="stagger">{peopleList.map(renderContact)}</div>
              </>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={"flex min-h-0 flex-col " + (active ? "flex" : "hidden md:flex")}>
          {active ? (
            <Thread key={active.key} contact={active} onBack={() => setActiveKey(null)} />
          ) : (
            <div className="anim-rise flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageCircle className="h-10 w-10 opacity-40" />
              <p className="text-sm">{t("chat.empty")}</p>
            </div>
          )}
        </section>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("chat.addContact")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); void addContact(); }}
          >
            <div className="space-y-1.5">
              <Label>{t("chat.addByUsername")}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                <Input value={addName} autoFocus maxLength={20} className="pl-7" onChange={(e) => setAddName(e.target.value)} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={adding || !addName.trim()}>
              {t("chat.addContact")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Thread({ contact, onBack }: { contact: Contact; onBack: () => void }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [convId, setConvId] = useState<string | null>(contact.conversationId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => setConvId(contact.conversationId), [contact.conversationId]);

  const { data: messages } = useQuery({
    queryKey: ["chat-messages", convId],
    enabled: !!convId,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("id, body, sender_id, created_at").eq("conversation_id", convId!).order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages?.length]);

  const send = async () => {
    const text = body.trim().slice(0, 500);
    if (!user || !text) return;
    let id = convId;
    if (!id) {
      const { data, error } =
        contact.kind === "canteen"
          ? await supabase
              .from("conversations")
              .upsert({ canteen_id: contact.canteenId, student_id: contact.studentId }, { onConflict: "canteen_id,student_id" })
              .select("id")
              .single()
          : await supabase.from("conversations").insert({ student_id: contact.studentId, peer_id: contact.peerId }).select("id").single();
      if (error || !data) { toast.error(error?.message ?? t("common.error")); return; }
      id = data.id;
      setConvId(id);
    }
    const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, body: text });
    if (error) { toast.error(error.message.includes("BANNED_WORD") ? t("filter.blocked") : error.message); return; }
    setBody("");
    void qc.invalidateQueries({ queryKey: ["chat-messages", id] });
    void qc.invalidateQueries({ queryKey: ["chat-contacts"] });
  };

  let lastDay = "";
  const total = (messages ?? []).length;
  return (
    <>
      <header className="anim-rise flex items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label={t("common.back")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarImage src={contact.avatar ?? undefined} alt={contact.title} className="object-cover" />
          <AvatarFallback>{contact.title.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{contact.title}</p>
          <p className="truncate text-xs text-muted-foreground">{contact.subtitle}</p>
        </div>
      </header>

      <div className="flex-1 space-y-1.5 overflow-y-auto bg-secondary/40 px-4 py-4">
        {total === 0 && <p className="anim-rise py-10 text-center text-sm text-muted-foreground">{t("chat.noMessages")}</p>}
        {(messages ?? []).map((m, idx) => {
          const d = new Date(m.created_at);
          const day = d.toLocaleDateString(lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short", year: "numeric" });
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.sender_id === user?.id;
          const recent = idx >= total - 12;
          return (
            <div key={m.id} className={recent ? "anim-bubble" : undefined} style={recent ? { animationDelay: `${(idx - (total - 12)) * 25}ms` } : undefined}>
              {showDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-card px-3 py-1 text-[11px] text-muted-foreground shadow-sm">{day}</span>
                </div>
              )}
              <div className={"flex " + (mine ? "justify-end" : "justify-start")}>
                <div
                  className={
                    "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm transition-transform " +
                    (mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card")
                  }
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={"mt-0.5 text-right text-[10px] " + (mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {d.toLocaleTimeString(lang === "en" ? "en-GB" : "id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void send(); }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <Input value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} placeholder={t("chat.placeholder")} className="rounded-full" />
        <Button type="submit" size="icon" className="shrink-0 rounded-full transition-transform hover:scale-105 active:scale-95" aria-label={t("common.send")} disabled={!body.trim()}>
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
}
