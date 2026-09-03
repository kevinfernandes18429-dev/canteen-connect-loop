import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChefHat, LogOut, Menu, Moon, Search, Settings, ShieldCheck, ShoppingCart, Sun, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { useI18n, type TKey } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PresenceDot } from "./PresenceDot";

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center rounded-full border border-border bg-secondary p-0.5 text-xs font-semibold">
      {(["id", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={
            "rounded-full px-2.5 py-1 uppercase transition-colors " +
            (lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
          }
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const { t } = useI18n();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={resolved === "dark" ? t("theme.light") : t("theme.dark")}
      onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
    >
      {resolved === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

function NotificationBell() {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });
  const unread = (data ?? []).filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">{t("nav.notifications")}</p>
          {unread > 0 && (
            <button
              className="text-xs text-primary"
              onClick={async () => {
                await supabase.from("notifications").update({ read: true }).eq("read", false);
                void qc.invalidateQueries({ queryKey: ["notifications"] });
              }}
            >
              ✓
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(data ?? []).length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("nav.noNotifications")}</p>
          )}
          {(data ?? []).map((n) => (
            <div key={n.id} className={"border-b px-4 py-3 text-sm last:border-0 " + (n.read ? "opacity-60" : "")}>
              <p className="font-medium">{t("orders.status")}</p>
              <p className="text-muted-foreground">{t(("status." + n.body) as TKey)}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const navLinks = [
  { to: "/", key: "nav.home" as TKey },
  { to: "/canteens", key: "nav.canteens" as TKey },
  { to: "/orders", key: "nav.orders" as TKey },
  { to: "/forum", key: "nav.forum" as TKey },
];

export function AppHeader() {
  const { t } = useI18n();
  const { user, profile, role, signOut } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim().replace(/^@/, "");
    if (term) void navigate({ to: "/u/$username", params: { username: term } });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="gradient-brand flex h-9 w-9 items-center justify-center rounded-xl">
            <UtensilsCrossed className="h-4.5 w-4.5 text-primary-foreground" />
          </span>
          <span className="font-display text-base font-bold tracking-tight sm:text-lg">IPEKA Pluit</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {t(l.key)}
            </Link>
          ))}
          {role === "canteen_owner" && (
            <Link
              to="/seller"
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChefHat className="mr-1 inline h-4 w-4" />
              {t("nav.seller")}
            </Link>
          )}
          {role === "admin" && (
            <Link
              to="/admin"
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ShieldCheck className="mr-1 inline h-4 w-4" />
              {t("nav.admin")}
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user && (
            <form onSubmit={submitSearch} className="relative hidden lg:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("nav.search")}
                className="h-9 w-52 rounded-full pl-8"
              />
            </form>
          )}
          <LangToggle />
          <ThemeToggle />
          {user && <NotificationBell />}
          {user && (
            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon">
                <ShoppingCart className="h-5 w-5" />
              </Button>
              {count > 0 && (
                <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full bg-accent px-1 text-[10px] text-accent-foreground">
                  {count}
                </Badge>
              )}
            </Link>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.username ?? ""} />
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                      {(profile?.username ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <PresenceDot presence={profile?.presence} className="absolute -bottom-0.5 -right-0.5 h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-semibold">{profile?.full_name || profile?.username}</p>
                  <p className="text-xs text-muted-foreground">@{profile?.username}</p>
                </div>
                <DropdownMenuSeparator />
                {profile && (
                  <DropdownMenuItem asChild>
                    <Link to="/u/$username" params={{ username: profile.username }}>
                      {t("settings.profile")}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    {t("nav.settings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    void navigate({ to: "/auth" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("nav.signout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">{t("nav.signin")}</Link>
            </Button>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-6">
              <nav className="mt-8 flex flex-col gap-1">
                {navLinks.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
                  >
                    {t(l.key)}
                  </Link>
                ))}
                {role === "canteen_owner" && (
                  <Link to="/seller" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary">
                    {t("nav.seller")}
                  </Link>
                )}
                {role === "admin" && (
                  <Link to="/admin" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary">
                    {t("nav.admin")}
                  </Link>
                )}
                <Link to="/settings" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary">
                  {t("nav.settings")}
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
