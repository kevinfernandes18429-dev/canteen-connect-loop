
REVOKE EXECUTE ON FUNCTION public.purge_inactive_accounts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_order_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.contains_banned_word(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.touch_last_active() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.was_account_deleted(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.was_account_deleted(text) TO anon, authenticated;
CREATE POLICY "no client access to deleted accounts" ON public.deleted_accounts FOR SELECT TO authenticated USING (false);
