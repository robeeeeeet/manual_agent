-- Migration: 00014_fix_group_appliance_ownership
-- Description: Fix appliance ownership tracking for group sharing
-- Phase: 7 (Family Sharing Enhancement)
--
-- Problem with previous design:
-- - When sharing, user_id was set to NULL, losing original owner information
-- - When group deleted/left, appliances couldn't be returned to original owner
-- - Trigger transferred appliances to group owner, not original owner
--
-- New design:
-- - When sharing, user_id is KEPT (tracks original owner)
-- - group_id is set to indicate shared status
-- - When leaving/deleting group, just clear group_id (user_id already correct)

-- =====================================================
-- 1. Modify CHECK constraint to allow both user_id and group_id
-- =====================================================

-- Drop existing XOR constraint
ALTER TABLE public.user_appliances
    DROP CONSTRAINT IF EXISTS chk_user_appliances_owner;

-- Add new constraint:
-- - Personal: user_id set, group_id NULL
-- - Shared: user_id set (original owner), group_id set
-- - Note: user_id must ALWAYS be set (no orphan appliances)
ALTER TABLE public.user_appliances
    ADD CONSTRAINT chk_user_appliances_owner
    CHECK (
        user_id IS NOT NULL
    );

COMMENT ON CONSTRAINT chk_user_appliances_owner ON public.user_appliances
    IS 'user_id must always be set (tracks owner/original owner). group_id set = shared with group.';

-- =====================================================
-- 2. Update existing shared appliances (set user_id from group owner)
-- =====================================================

-- For any existing appliances with user_id=NULL and group_id set,
-- set user_id to the group owner (best effort recovery)
UPDATE public.user_appliances ua
SET user_id = g.owner_id
FROM public.groups g
WHERE ua.group_id = g.id
  AND ua.user_id IS NULL;

-- =====================================================
-- 3. Simplify the group delete trigger
-- =====================================================

-- Since user_id is now always set to the original owner,
-- we just need to clear group_id on delete
CREATE OR REPLACE FUNCTION transfer_group_appliances_to_owner()
RETURNS TRIGGER AS $$
BEGIN
    -- Clear group_id to return appliances to personal ownership
    -- user_id is already set to the original owner
    UPDATE public.user_appliances
    SET group_id = NULL,
        updated_at = NOW()
    WHERE group_id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION transfer_group_appliances_to_owner()
    IS 'グループ削除時に家電を個人所有に戻す（user_idは既に元の所有者を保持）';

-- =====================================================
-- 4. Add NOT NULL constraint to user_id
-- =====================================================

-- After data migration, enforce NOT NULL
ALTER TABLE public.user_appliances
    ALTER COLUMN user_id SET NOT NULL;
