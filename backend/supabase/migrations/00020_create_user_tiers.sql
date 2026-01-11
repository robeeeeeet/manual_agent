-- =====================================================
-- Migration: 00019_create_user_tiers
-- Description: Create user_tiers table for tier-based limits
-- =====================================================

-- Enable uuid extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_tiers table
CREATE TABLE user_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    max_appliances INT NOT NULL DEFAULT 3,
    max_manual_searches_per_day INT NOT NULL DEFAULT 5,
    max_qa_questions_per_day INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE user_tiers IS 'User tier definitions with usage limits. -1 means unlimited.';
COMMENT ON COLUMN user_tiers.name IS 'Tier identifier: free, basic, premium';
COMMENT ON COLUMN user_tiers.display_name IS 'Display name in Japanese';
COMMENT ON COLUMN user_tiers.max_appliances IS 'Maximum appliances per user/group (-1 = unlimited)';
COMMENT ON COLUMN user_tiers.max_manual_searches_per_day IS 'Maximum manual searches per day (-1 = unlimited)';
COMMENT ON COLUMN user_tiers.max_qa_questions_per_day IS 'Maximum QA questions per day (-1 = unlimited)';

-- Insert initial tier data
INSERT INTO user_tiers (name, display_name, max_appliances, max_manual_searches_per_day, max_qa_questions_per_day) VALUES
    ('free', '無料プラン', 3, 5, 10),
    ('basic', 'ベーシック', 10, 20, 50),
    ('premium', 'プレミアム', -1, -1, -1);

-- Create index on name for fast lookups
CREATE INDEX idx_user_tiers_name ON user_tiers(name);

-- RLS policies (read-only for authenticated users)
ALTER TABLE user_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can read tier definitions
CREATE POLICY "Anyone can view tiers"
    ON user_tiers FOR SELECT
    USING (true);

-- Only service role can modify tiers
CREATE POLICY "Service role can manage tiers"
    ON user_tiers FOR ALL
    USING (auth.role() = 'service_role');
