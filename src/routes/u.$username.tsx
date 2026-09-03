import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceDot } from "@/components/app/PresenceDot";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — Kantin IPEKA Pluit` },
      { name: "description", content: `Profil @${params.username} di aplikasi pre-order Kantin IPEKA Pluit.` },
      { property: "og:title", content: `@${params.username} — Kantin IPEKA Pluit` },
      { property: "og:description", content: `Lihat profil @${params.username}.` },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { t } = useI18n();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      return data;
    },
  });

  if (isLoading) return <p className="px-4 py-20 text-center text-muted-foreground">{t("common.loading")}</p>;
  if (!profile) return <p className="px-4 py-20 text-center text-muted-foreground">@{username} —</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div
          className="h-36 bg-primary/15 bg-cover bg-center"
          style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})` } : undefined}
        />
        <div className="p-6">
          <div className="-mt-14 flex items-end gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 border-card">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.username} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {profile.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <PresenceDot presence={profile.presence} className="absolute bottom-1 right-1 h-4 w-4" />
            </div>
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">{profile.full_name || profile.username}</h1>
          <p className="text-sm text-muted-foreground">
            @{profile.username} {profile.class && `· ${formatClass(profile.class, lang)}`}
          </p>
          {(profile.status_text || profile.status_emoji) && (
            <p className="mt-3 inline-block rounded-2xl bg-secondary px-3 py-1.5 text-sm">
              {profile.status_emoji} {profile.status_text}
            </p>
          )}
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {t(("presence." + profile.presence) as TKey)}
          </p>
          {profile.bio && <p className="mt-4 whitespace-pre-wrap text-sm">{profile.bio}</p>}
        </div>
      </div>
    </div>
  );
}