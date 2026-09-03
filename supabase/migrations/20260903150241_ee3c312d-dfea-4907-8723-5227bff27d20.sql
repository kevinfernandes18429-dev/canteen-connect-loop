-- Reviews: portion quantity 1-20
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 20);

-- Canteens: banner
ALTER TABLE public.canteens ADD COLUMN IF NOT EXISTS banner_url text;

-- Conversations: support direct messages between two users
ALTER TABLE public.conversations ALTER COLUMN canteen_id DROP NOT NULL;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS peer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_target_check CHECK ((canteen_id IS NOT NULL) <> (peer_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS conversations_dm_unique ON public.conversations (LEAST(student_id, peer_id), GREATEST(student_id, peer_id)) WHERE peer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations cv
    LEFT JOIN public.canteens c ON c.id = cv.canteen_id
    WHERE cv.id = _conversation_id
      AND (cv.student_id = _user_id OR cv.peer_id = _user_id OR c.owner_id = _user_id)
  );
$$;
REVOKE ALL ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "participants create conversations" ON public.conversations;
DROP POLICY IF EXISTS "participants read conversations" ON public.conversations;
DROP POLICY IF EXISTS "participants touch conversations" ON public.conversations;

CREATE POLICY "participants read conversations" ON public.conversations FOR SELECT TO authenticated
USING (student_id = auth.uid() OR peer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = conversations.canteen_id AND c.owner_id = auth.uid()));

CREATE POLICY "participants create conversations" ON public.conversations FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid() OR peer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = conversations.canteen_id AND c.owner_id = auth.uid()));

CREATE POLICY "participants touch conversations" ON public.conversations FOR UPDATE TO authenticated
USING (student_id = auth.uid() OR peer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = conversations.canteen_id AND c.owner_id = auth.uid()));

DROP POLICY IF EXISTS "messages visible to participants" ON public.messages;
DROP POLICY IF EXISTS "participants send messages" ON public.messages;

CREATE POLICY "messages visible to participants" ON public.messages FOR SELECT TO authenticated
USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "participants send messages" ON public.messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()));