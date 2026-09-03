-- Conversations (WhatsApp-style, one per canteen + student)
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id uuid NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canteen_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read conversations" ON public.conversations FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = conversations.canteen_id AND c.owner_id = auth.uid()));
CREATE POLICY "participants create conversations" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = conversations.canteen_id AND c.owner_id = auth.uid()));
CREATE POLICY "participants touch conversations" ON public.conversations FOR UPDATE TO authenticated
  USING (student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = conversations.canteen_id AND c.owner_id = auth.uid()));
CREATE POLICY "admin manages conversations" ON public.conversations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER conversations_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Messages now belong to a conversation
ALTER TABLE public.messages ADD COLUMN conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ALTER COLUMN order_id DROP NOT NULL;

INSERT INTO public.conversations (canteen_id, student_id, last_message_at)
SELECT o.canteen_id, o.user_id, max(m.created_at)
FROM public.messages m JOIN public.orders o ON o.id = m.order_id
GROUP BY o.canteen_id, o.user_id
ON CONFLICT (canteen_id, student_id) DO NOTHING;

UPDATE public.messages m SET conversation_id = c.id
FROM public.orders o JOIN public.conversations c ON c.canteen_id = o.canteen_id AND c.student_id = o.user_id
WHERE o.id = m.order_id AND m.conversation_id IS NULL;

DELETE FROM public.messages WHERE conversation_id IS NULL;
ALTER TABLE public.messages ALTER COLUMN conversation_id SET NOT NULL;
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at);

DROP POLICY IF EXISTS "messages visible to participants" ON public.messages;
DROP POLICY IF EXISTS "participants send messages" ON public.messages;
CREATE POLICY "messages visible to participants" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations cv LEFT JOIN public.canteens c ON c.id = cv.canteen_id
                 WHERE cv.id = messages.conversation_id AND (cv.student_id = auth.uid() OR c.owner_id = auth.uid())));
CREATE POLICY "participants send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations cv LEFT JOIN public.canteens c ON c.id = cv.canteen_id
                 WHERE cv.id = messages.conversation_id AND (cv.student_id = auth.uid() OR c.owner_id = auth.uid())));

CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER messages_touch_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();

-- Owners can no longer self-claim canteens; admin assigns (verification)
DROP POLICY IF EXISTS "owner claims canteen" ON public.canteens;
DROP POLICY IF EXISTS "owner claims unowned canteen" ON public.canteens;

-- Admin full control over review votes
CREATE POLICY "admin manages review votes" ON public.review_votes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));