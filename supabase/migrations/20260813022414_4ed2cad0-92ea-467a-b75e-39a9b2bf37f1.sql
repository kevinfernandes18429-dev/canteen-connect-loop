
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('student','canteen_owner','admin');
CREATE TYPE public.order_status AS ENUM ('pending','preparing','in_kitchen','ready','completed','cancelled');
CREATE TYPE public.presence_status AS ENUM ('online','idle','dnd','invisible');

-- UPDATED AT
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  class TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  banner_url TEXT,
  presence public.presence_status NOT NULL DEFAULT 'online',
  status_text TEXT NOT NULL DEFAULT '',
  status_emoji TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'id',
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base_username TEXT; final_username TEXT; n INT := 0;
BEGIN
  base_username := lower(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)));
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    n := n + 1; final_username := base_username || n::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, full_name, class, language)
  VALUES (NEW.id, final_username,
          coalesce(NEW.raw_user_meta_data->>'full_name',''),
          coalesce(NEW.raw_user_meta_data->>'class',''),
          coalesce(NEW.raw_user_meta_data->>'language','id'));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, (coalesce(NEW.raw_user_meta_data->>'role','student'))::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CANTEENS
CREATE TABLE public.canteens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.canteens TO anon;
GRANT SELECT, INSERT, UPDATE ON public.canteens TO authenticated;
GRANT ALL ON public.canteens TO service_role;
ALTER TABLE public.canteens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "canteens public read" ON public.canteens FOR SELECT USING (true);
CREATE POLICY "owner updates canteen" ON public.canteens FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner claims canteen" ON public.canteens FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'canteen_owner') AND auth.uid() = owner_id);
CREATE TRIGGER canteens_updated BEFORE UPDATE ON public.canteens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.canteens (slug, name, description, description_en) VALUES
('takoya','Takoya','Takoyaki, ricebowl Jepang, dan camilan hangat.','Takoyaki, Japanese rice bowls and warm snacks.'),
('uncle-fong','Uncle Fong','Masakan rumahan Chinese-Indonesia, mie dan nasi.','Chinese-Indonesian home cooking, noodles and rice.'),
('fuel-catering','Fuel Catering','Paket makan sehat bergizi seimbang.','Balanced, healthy meal packages.'),
('ichi-gourmet','Ichi Gourmet','Bento, katsu, dan hidangan gourmet Jepang.','Bento, katsu and Japanese gourmet dishes.'),
('ceria','Ceria','Jajanan favorit, snack, dan minuman segar.','Favourite snacks and fresh drinks.');

-- MENU ITEMS
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id UUID NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'main',
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu public read" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "owner manages menu" ON public.menu_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = canteen_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = canteen_id AND c.owner_id = auth.uid()));
CREATE TRIGGER menu_updated BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canteen_id UUID NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  pickup_date DATE NOT NULL,
  break_time TEXT NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  notes TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student reads own orders" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = canteen_id AND c.owner_id = auth.uid()));
CREATE POLICY "student creates order" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "student or owner updates order" ON public.orders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = canteen_id AND c.owner_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = canteen_id AND c.owner_id = auth.uid()));
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_order() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.pickup_date < (now() AT TIME ZONE 'Asia/Jakarta')::date THEN
    RAISE EXCEPTION 'Pickup date cannot be in the past';
  END IF;
  IF NEW.pickup_date > ((now() AT TIME ZONE 'Asia/Jakarta')::date + 7) THEN
    RAISE EXCEPTION 'Pickup date cannot be more than 7 days ahead';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER orders_validate BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_order();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 20),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order items visible to participants" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o LEFT JOIN public.canteens c ON c.id = o.canteen_id
                 WHERE o.id = order_id AND (o.user_id = auth.uid() OR c.owner_id = auth.uid())));
CREATE POLICY "student inserts order items" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- MESSAGES
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages visible to participants" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o LEFT JOIN public.canteens c ON c.id = o.canteen_id
                 WHERE o.id = order_id AND (o.user_id = auth.uid() OR c.owner_id = auth.uid())));
CREATE POLICY "participants send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.orders o LEFT JOIN public.canteens c ON c.id = o.canteen_id
                 WHERE o.id = order_id AND (o.user_id = auth.uid() OR c.owner_id = auth.uid())));
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE OR REPLACE FUNCTION public.notify_order_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, title, body, order_id)
    VALUES (NEW.user_id, 'order_status', NEW.status::text, NEW.id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER orders_notify AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_status();

-- REVIEWS
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id UUID NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  body TEXT NOT NULL DEFAULT '',
  order_type TEXT NOT NULL DEFAULT '',
  food_type TEXT NOT NULL DEFAULT '',
  price_per_person INTEGER NOT NULL DEFAULT 0,
  food_rating NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (food_rating >= 0 AND food_rating <= 5),
  service_rating NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (service_rating >= 0 AND service_rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews readable" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "own review write" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own review update" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own review delete" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER reviews_updated BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.review_votes (
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value IN (-1,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_votes TO authenticated;
GRANT ALL ON public.review_votes TO service_role;
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes readable" ON public.review_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "own vote" ON public.review_votes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.review_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_replies TO authenticated;
GRANT ALL ON public.review_replies TO service_role;
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "replies readable" ON public.review_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "own reply" ON public.review_replies FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- FORUM
CREATE TABLE public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canteen_id UUID REFERENCES public.canteens(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_posts TO authenticated;
GRANT ALL ON public.forum_posts TO service_role;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forum posts readable" ON public.forum_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "own forum post" ON public.forum_posts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER forum_posts_updated BEFORE UPDATE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.forum_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_comments TO authenticated;
GRANT ALL ON public.forum_comments TO service_role;
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forum comments readable" ON public.forum_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "own forum comment" ON public.forum_comments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.forum_votes (
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value IN (-1,1)),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_votes TO authenticated;
GRANT ALL ON public.forum_votes TO service_role;
ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forum votes readable" ON public.forum_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "own forum vote" ON public.forum_votes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- BAD WORD FILTER
CREATE TABLE public.banned_words (
  word TEXT PRIMARY KEY
);
GRANT SELECT ON public.banned_words TO authenticated;
GRANT ALL ON public.banned_words TO service_role;
ALTER TABLE public.banned_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banned words readable" ON public.banned_words FOR SELECT TO authenticated USING (true);
INSERT INTO public.banned_words (word) VALUES
('anjing'),('babi'),('bangsat'),('kontol'),('memek'),('goblok'),('tolol'),('bajingan'),('brengsek'),('ngentot'),
('fuck'),('shit'),('bitch'),('asshole'),('bastard'),('cunt'),('dick'),('retard'),('idiot'),('stupid');

CREATE OR REPLACE FUNCTION public.contains_banned_word(_text TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.banned_words w WHERE lower(_text) ~* ('\m' || w.word || '\M'));
$$;

CREATE OR REPLACE FUNCTION public.reject_banned_words() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.contains_banned_word(coalesce(NEW.body,'') || ' ' || coalesce(to_jsonb(NEW)->>'title','')) THEN
    RAISE EXCEPTION 'BANNED_WORD';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER forum_posts_filter BEFORE INSERT OR UPDATE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.reject_banned_words();
CREATE TRIGGER forum_comments_filter BEFORE INSERT OR UPDATE ON public.forum_comments FOR EACH ROW EXECUTE FUNCTION public.reject_banned_words();
CREATE TRIGGER reviews_filter BEFORE INSERT OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.reject_banned_words();
CREATE TRIGGER review_replies_filter BEFORE INSERT OR UPDATE ON public.review_replies FOR EACH ROW EXECUTE FUNCTION public.reject_banned_words();

-- DELETED ACCOUNTS (30 day inactivity)
CREATE TABLE public.deleted_accounts (
  email TEXT PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL DEFAULT 'inactive_30_days'
);
GRANT ALL ON public.deleted_accounts TO service_role;
ALTER TABLE public.deleted_accounts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.was_account_deleted(_email TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.deleted_accounts WHERE lower(email) = lower(_email));
$$;
GRANT EXECUTE ON FUNCTION public.was_account_deleted(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_last_active()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_active_at = now() WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.touch_last_active() TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_inactive_accounts()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE removed INTEGER := 0;
BEGIN
  INSERT INTO public.deleted_accounts (email)
  SELECT u.email FROM auth.users u JOIN public.profiles p ON p.id = u.id
  WHERE p.last_active_at < now() - INTERVAL '30 days' AND u.email IS NOT NULL
  ON CONFLICT (email) DO UPDATE SET deleted_at = now();

  DELETE FROM auth.users u USING public.profiles p
  WHERE p.id = u.id AND p.last_active_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END; $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('purge-inactive-accounts','0 3 * * *', $$SELECT public.purge_inactive_accounts();$$);
