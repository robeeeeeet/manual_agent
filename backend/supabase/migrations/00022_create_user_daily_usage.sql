-- =====================================================
-- Migration: 00021_create_user_daily_usage
-- Description: Create user_daily_usage table for tracking daily usage limits
-- =====================================================

-- Enable uuid extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_daily_usage table
CREATE TABLE user_daily_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    manual_searches INT NOT NULL DEFAULT 0,
    qa_questions INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Add comments for documentation
COMMENT ON TABLE user_daily_usage IS 'Daily usage tracking per user for tier limits enforcement';
COMMENT ON COLUMN user_daily_usage.user_id IS 'User who performed the actions';
COMMENT ON COLUMN user_daily_usage.date IS 'Date of usage (UTC)';
COMMENT ON COLUMN user_daily_usage.manual_searches IS 'Number of manual searches (image recognition) performed today';
COMMENT ON COLUMN user_daily_usage.qa_questions IS 'Number of QA questions asked today';

-- Create indexes for fast lookups
CREATE INDEX idx_user_daily_usage_user_date ON user_daily_usage(user_id, date);
CREATE INDEX idx_user_daily_usage_date ON user_daily_usage(date);

-- Create updated_at trigger
CREATE TRIGGER set_user_daily_usage_updated_at
    BEFORE UPDATE ON user_daily_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE user_daily_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own usage"
    ON user_daily_usage FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can manage all usage records
CREATE POLICY "Service role can manage usage"
    ON user_daily_usage FOR ALL
    USING (auth.role() = 'service_role');
