-- 1. Fix banned word filter: trigger must run with definer rights
CREATE OR REPLACE FUNCTION public.reject_banned_words()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.contains_banned_word(coalesce(NEW.body,'') || ' ' || coalesce(to_jsonb(NEW)->>'title','')) THEN
    RAISE EXCEPTION 'BANNED_WORD';
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS messages_filter ON public.messages;
CREATE TRIGGER messages_filter BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.reject_banned_words();

-- 2. Functions used by RLS / client must be executable by authenticated
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO authenticated;

-- 3. Username validation on change
CREATE OR REPLACE FUNCTION public.validate_username()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.username := lower(trim(NEW.username));
  IF NEW.username !~ '^[a-z0-9_.]{3,20}$' THEN
    RAISE EXCEPTION 'INVALID_USERNAME';
  END IF;
  RETURN NEW;
END; $function$;
DROP TRIGGER IF EXISTS profiles_validate_username ON public.profiles;
CREATE TRIGGER profiles_validate_username BEFORE INSERT OR UPDATE OF username ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_username();

-- 4. Admin policies
CREATE POLICY "admin manages profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT DELETE ON public.profiles TO authenticated;

CREATE POLICY "admin manages roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE POLICY "admin manages canteens" ON public.canteens FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT DELETE ON public.canteens TO authenticated;

CREATE POLICY "admin manages menu" ON public.menu_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "admin manages orders" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT DELETE ON public.orders TO authenticated;

CREATE POLICY "admin manages order items" ON public.order_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT UPDATE, DELETE ON public.order_items TO authenticated;

CREATE POLICY "admin manages messages" ON public.messages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT UPDATE, DELETE ON public.messages TO authenticated;

CREATE POLICY "admin manages forum posts" ON public.forum_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages forum comments" ON public.forum_comments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages reviews" ON public.reviews FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages review replies" ON public.review_replies FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin reads notifications" ON public.notifications FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "admin manages banned words" ON public.banned_words FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE, DELETE ON public.banned_words TO authenticated;