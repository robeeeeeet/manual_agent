-- =====================================================
-- Migration: 00020_add_tier_to_users
-- Description: Add tier_id column to users table
-- =====================================================

-- Get the tier IDs we'll need
DO $$
DECLARE
    free_tier_id UUID;
    basic_tier_id UUID;
BEGIN
    -- Get tier IDs
    SELECT id INTO free_tier_id FROM user_tiers WHERE name = 'free';
    SELECT id INTO basic_tier_id FROM user_tiers WHERE name = 'basic';

    -- Add tier_id column to users table
    ALTER TABLE users ADD COLUMN tier_id UUID;

    -- Add foreign key constraint
    ALTER TABLE users ADD CONSTRAINT fk_users_tier
        FOREIGN KEY (tier_id) REFERENCES user_tiers(id)
        ON DELETE RESTRICT;

    -- Set default for new users to free tier
    EXECUTE format('ALTER TABLE users ALTER COLUMN tier_id SET DEFAULT %L', free_tier_id);

    -- Update existing users to basic tier (早期利用者優遇)
    UPDATE users SET tier_id = basic_tier_id WHERE tier_id IS NULL;

    -- Make tier_id NOT NULL after backfilling
    ALTER TABLE users ALTER COLUMN tier_id SET NOT NULL;
END $$;

-- Create index for fast tier lookups
CREATE INDEX idx_users_tier_id ON users(tier_id);

-- Add comment for documentation
COMMENT ON COLUMN users.tier_id IS 'User tier (free/basic/premium). New users default to free, existing users upgraded to basic.';
