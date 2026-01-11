-- =====================================================
-- Migration: 00023_add_admin_tier_and_update_premium
-- Description: Add admin tier and set limits for premium tier
-- =====================================================

-- Add admin tier with all unlimited
INSERT INTO user_tiers (name, display_name, max_appliances, max_manual_searches_per_day, max_qa_questions_per_day) VALUES
    ('admin', '管理者', -1, -1, -1);

-- Update premium tier to have limits on manual searches and QA questions
-- (appliances remain unlimited)
UPDATE user_tiers
SET max_manual_searches_per_day = 100,
    max_qa_questions_per_day = 500
WHERE name = 'premium';

-- Add comment for admin tier
COMMENT ON COLUMN user_tiers.name IS 'Tier identifier: free, basic, premium, admin';
