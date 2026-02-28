-- gen_random_uuid() is built into PostgreSQL 13+, no extension needed

-- users table (mirrors Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- email_accounts table
CREATE TABLE public.email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook')),
    email_address TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    history_id TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, email_address)
);

CREATE INDEX idx_email_accounts_user_id ON public.email_accounts(user_id);

-- application stage enum
CREATE TYPE app_stage AS ENUM (
    'applied', 'acknowledged', 'assessment', 'interview',
    'offer', 'rejected', 'withdrawn'
);

-- applications table
CREATE TABLE public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email_account_id UUID REFERENCES public.email_accounts(id),
    company_name TEXT NOT NULL,
    company_domain TEXT,
    role_title TEXT,
    current_stage app_stage DEFAULT 'applied',
    applied_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ,
    outcome TEXT CHECK (outcome IN ('pending', 'rejected', 'offer', 'withdrawn', 'hired')),
    notes TEXT,
    is_manual BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_applications_user_id ON public.applications(user_id);
CREATE INDEX idx_applications_last_activity ON public.applications(last_activity_at DESC);
CREATE INDEX idx_applications_email_account_id ON public.applications(email_account_id);

-- event type enum
CREATE TYPE event_type AS ENUM (
    'applied', 'acknowledged', 'assessment', 'interview_invite',
    'interview_completed', 'offer', 'rejected', 'withdrawn', 'other'
);

-- application_events table
CREATE TABLE public.application_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    event_type event_type NOT NULL,
    email_message_id TEXT,
    subject TEXT,
    sender TEXT,
    received_at TIMESTAMPTZ NOT NULL,
    raw_snippet TEXT,
    classified_by TEXT DEFAULT 'rule',
    confidence_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_application_events_application_id ON public.application_events(application_id);

-- user_metrics cache table
CREATE TABLE public.user_metrics (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    computed_at TIMESTAMPTZ,
    total_applied INT DEFAULT 0,
    response_rate FLOAT DEFAULT 0,
    interview_rate FLOAT DEFAULT 0,
    offer_rate FLOAT DEFAULT 0,
    avg_days_to_response FLOAT,
    metrics_json JSONB DEFAULT '{}'
);

-- Trigger function to auto-update updated_at columns
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_email_accounts
    BEFORE UPDATE ON public.email_accounts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_applications
    BEFORE UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own data
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can view own email accounts"
    ON public.email_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own email accounts"
    ON public.email_accounts FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own applications"
    ON public.applications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own applications"
    ON public.applications FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own application events"
    ON public.application_events FOR SELECT
    USING (auth.uid() = (
        SELECT user_id FROM public.applications WHERE id = application_id
    ));

CREATE POLICY "Users can view own metrics"
    ON public.user_metrics FOR SELECT
    USING (auth.uid() = user_id);
