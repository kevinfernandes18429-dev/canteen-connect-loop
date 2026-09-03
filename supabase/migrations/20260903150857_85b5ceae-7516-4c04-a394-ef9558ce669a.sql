UPDATE public.profiles p SET class = ''
WHERE p.class <> '' AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role <> 'student');