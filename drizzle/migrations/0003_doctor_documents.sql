ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS documents text[] NOT NULL DEFAULT '{}';
CREATE POLICY "doctor uploads own docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'doctor-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "doctor or admin reads docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'doctor-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));