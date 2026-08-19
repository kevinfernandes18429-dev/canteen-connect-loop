import { supabase } from "@/integrations/supabase/client";

export async function uploadMedia(userId: string, file: File, folder: string) {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data, error: signError } = await supabase.storage.from("media").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signError) throw signError;
  return data.signedUrl;
}