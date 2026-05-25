
-- Events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_name TEXT,
  subheading TEXT,
  description TEXT,
  banner_image_url TEXT,
  timezone TEXT,
  status TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  vanish_date TIMESTAMPTZ,
  roles JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own events select" ON public.events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own events insert" ON public.events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own events update" ON public.events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own events delete" ON public.events FOR DELETE USING (auth.uid() = user_id);

-- Chat sessions table
CREATE TABLE public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own chat select" ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own chat insert" ON public.chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own chat update" ON public.chat_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own chat delete" ON public.chat_sessions FOR DELETE USING (auth.uid() = user_id);

-- Timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for banner images
INSERT INTO storage.buckets (id, name, public) VALUES ('event-banners', 'event-banners', true);

CREATE POLICY "banners public read" ON storage.objects FOR SELECT USING (bucket_id = 'event-banners');
CREATE POLICY "banners own insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-banners' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "banners own update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'event-banners' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "banners own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'event-banners' AND auth.uid()::text = (storage.foldername(name))[1]);
