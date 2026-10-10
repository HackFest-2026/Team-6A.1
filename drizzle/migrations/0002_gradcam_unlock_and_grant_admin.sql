CREATE TABLE public.gradcam_unlocks (
  scan_id uuid PRIMARY KEY REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'demo' CHECK (kind IN ('demo','paid')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gradcam_unlocks TO authenticated;
GRANT ALL ON public.gradcam_unlocks TO service_role;
ALTER TABLE public.gradcam_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own unlocks" ON public.gradcam_unlocks FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Demo unlock of Grad-CAM for one of the caller's own scans. Never recorded as paid.
CREATE OR REPLACE FUNCTION public.unlock_gradcam_demo(_scan_id uuid, _gradcam text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM scans WHERE id = _scan_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Scan not found'; END IF;
  IF _gradcam IS NULL OR left(_gradcam, 23) <> 'data:image/jpeg;base64,' THEN RAISE EXCEPTION 'Invalid image'; END IF;
  INSERT INTO gradcam_unlocks (scan_id, user_id, kind) VALUES (_scan_id, auth.uid(), 'demo') ON CONFLICT (scan_id) DO NOTHING;
  UPDATE scans SET gradcam = _gradcam WHERE id = _scan_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.unlock_gradcam_demo(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.unlock_gradcam_demo(uuid, text) TO authenticated;

-- Only an existing admin can make another account an admin.
CREATE OR REPLACE FUNCTION public.grant_admin(_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(trim(_email));
  IF uid IS NULL THEN RAISE EXCEPTION 'No account with that email'; END IF;
  INSERT INTO user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
END $$;
REVOKE EXECUTE ON FUNCTION public.grant_admin(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.grant_admin(text) TO authenticated;