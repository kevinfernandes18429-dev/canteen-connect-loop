CREATE POLICY "owner claims unowned canteen" ON public.canteens FOR UPDATE TO authenticated
USING (owner_id IS NULL AND public.has_role(auth.uid(), 'canteen_owner'::app_role))
WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'canteen_owner'::app_role));