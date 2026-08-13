import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  class: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
  presence: "online" | "idle" | "dnd" | "invisible";
  status_text: string;
  status_emoji: string;
  language: string;
  two_factor_enabled: boolean;
};

type Ctx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: "student" | "canteen_owner" | "admin" | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({
  session: null,
  user: null,
  profile: null,
  role: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Ctx["role"]>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);
    setProfile((p as Profile) ?? null);
    setRole((r?.role as Ctx["role"]) ?? "student");
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => {
          void loadProfile(s.user.id);
          void supabase.rpc("touch_last_active");
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
        void supabase.rpc("touch_last_active");
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo<Ctx>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role,
      loading,
      refreshProfile: async () => {
        if (session?.user) await loadProfile(session.user.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setRole(null);
      },
    }),
    [session, profile, role, loading, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
