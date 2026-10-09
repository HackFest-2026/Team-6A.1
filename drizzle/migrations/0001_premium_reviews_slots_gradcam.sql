CREATE TABLE public.subscriptions (
  user_id uuid PRIMARY KEY,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','premium_demo','premium_paid')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = _user_id AND tier IN ('premium_demo','premium_paid'))
$$;

CREATE OR REPLACE FUNCTION public.activate_premium_demo() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO public.subscriptions (user_id, tier) VALUES (auth.uid(), 'premium_demo')
  ON CONFLICT (user_id) DO UPDATE SET tier = CASE WHEN subscriptions.tier = 'premium_paid' THEN 'premium_paid' ELSE 'premium_demo' END, updated_at = now()
  RETURNING tier INTO t;
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.activate_premium_demo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_premium_demo() TO authenticated;

ALTER TABLE public.scans ADD COLUMN gradcam text;
CREATE OR REPLACE FUNCTION public.guard_scan_premium() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.gradcam IS NOT NULL AND NOT public.is_premium(NEW.user_id) THEN NEW.gradcam := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER scans_premium_guard BEFORE INSERT ON public.scans FOR EACH ROW EXECUTE FUNCTION public.guard_scan_premium();

CREATE UNIQUE INDEX appointments_no_double_booking ON public.appointments (doctor_id, scheduled_at)
  WHERE lower(status) NOT IN ('cancelled','declined','rejected');

CREATE OR REPLACE FUNCTION public.booked_slots(_doctor_id uuid, _from timestamptz, _to timestamptz) RETURNS SETOF timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT scheduled_at FROM public.appointments
  WHERE doctor_id = _doctor_id AND scheduled_at >= _from AND scheduled_at < _to
    AND lower(status) NOT IN ('cancelled','declined','rejected')
$$;
REVOKE ALL ON FUNCTION public.booked_slots(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booked_slots(uuid, timestamptz, timestamptz) TO authenticated;

CREATE TABLE public.doctor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id),
  patient_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.doctor_reviews TO authenticated;
GRANT ALL ON public.doctor_reviews TO service_role;
ALTER TABLE public.doctor_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews readable" ON public.doctor_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "patient reviews own past appointment" ON public.doctor_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = patient_id AND EXISTS (
    SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND a.patient_id = auth.uid()
      AND a.doctor_id = doctor_reviews.doctor_id AND lower(a.status) IN ('accepted','completed') AND a.scheduled_at < now()));