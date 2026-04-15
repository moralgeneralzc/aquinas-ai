-- ============================================================
-- PLATAFORMA IA TOMISTA — Supabase Migration
-- ============================================================
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. ENUM para planes
CREATE TYPE plan_type AS ENUM ('gratuito', 'studioso', 'doctor');

-- 2. Perfiles de usuario (se crea automáticamente al registrarse)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  plan plan_type NOT NULL DEFAULT 'gratuito',
  credits_remaining INTEGER NOT NULL DEFAULT 10,
  credits_reset_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day'),
  total_queries INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  lemon_squeezy_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Conversaciones (sesiones de chat)
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nueva conversación',
  mode TEXT NOT NULL DEFAULT 'chat' CHECK (mode IN ('chat', 'socratico', 'comparador')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Mensajes dentro de conversaciones
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Registro de uso (analytics)
CREATE TABLE public.usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  credits_consumed INTEGER NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_conversations_user ON public.conversations(user_id, updated_at DESC);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at ASC);
CREATE INDEX idx_usage_log_user ON public.usage_log(user_id, created_at DESC);
CREATE INDEX idx_profiles_plan ON public.profiles(plan);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_log ENABLE ROW LEVEL SECURITY;

-- Profiles: cada usuario solo ve/edita su perfil
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Conversations: cada usuario solo ve sus conversaciones
CREATE POLICY "Users manage own conversations" ON public.conversations
  FOR ALL USING (auth.uid() = user_id);

-- Messages: acceso via conversación del usuario
CREATE POLICY "Users manage own messages" ON public.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
    )
  );

-- Usage log: solo lectura del propio uso
CREATE POLICY "Users view own usage" ON public.usage_log
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- FUNCIÓN: Crear perfil automáticamente al registrarse
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCIÓN: Reset diario de créditos según plan
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_credits_if_needed(p_user_id UUID)
RETURNS TABLE(credits INTEGER, plan plan_type) AS $$
DECLARE
  v_profile RECORD;
  v_max_credits INTEGER;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  
  IF v_profile.credits_reset_at <= NOW() THEN
    -- Determinar créditos según plan
    v_max_credits := CASE v_profile.plan
      WHEN 'gratuito' THEN 10
      WHEN 'studioso' THEN 100
      WHEN 'doctor' THEN 999999
    END;
    
    UPDATE public.profiles
    SET credits_remaining = v_max_credits,
        credits_reset_at = NOW() + INTERVAL '1 day',
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN QUERY SELECT v_max_credits, v_profile.plan;
  ELSE
    RETURN QUERY SELECT v_profile.credits_remaining, v_profile.plan;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCIÓN: Consumir crédito (atómica)
-- ============================================================
CREATE OR REPLACE FUNCTION public.consume_credit(p_user_id UUID, p_action TEXT DEFAULT 'chat')
RETURNS BOOLEAN AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  -- Primero resetear si corresponde
  PERFORM public.reset_credits_if_needed(p_user_id);
  
  -- Intentar decrementar
  UPDATE public.profiles
  SET credits_remaining = credits_remaining - 1,
      total_queries = total_queries + 1,
      updated_at = NOW()
  WHERE id = p_user_id AND credits_remaining > 0
  RETURNING credits_remaining INTO v_credits;
  
  IF v_credits IS NULL THEN
    RETURN FALSE; -- Sin créditos
  END IF;
  
  -- Registrar uso
  INSERT INTO public.usage_log (user_id, action) VALUES (p_user_id, p_action);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SERVICE ROLE: Permitir al Worker acceder con service_role key
-- ============================================================
-- El Worker usa supabase service_role key para:
-- 1. Verificar JWT
-- 2. Consultar/actualizar créditos
-- 3. Crear conversaciones y mensajes
-- Las policies de RLS no aplican al service_role (bypassa RLS)
