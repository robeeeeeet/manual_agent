-- ============================================================
-- Migration: 00019_normalize_group_owner
-- Description: Remove redundant role column from group_members table
-- ============================================================
-- Purpose:
--   Normalize group owner information by removing redundancy.
--   Owner information is now managed solely via groups.owner_id
--
-- Changes:
--   1. Remove CHECK constraint on role column
--   2. Remove role column from group_members table
--   3. Update table comment
--
-- Note: No data migration needed as owner info exists in groups.owner_id
-- ============================================================

-- Step 1: Remove CHECK constraint
ALTER TABLE public.group_members DROP CONSTRAINT IF EXISTS group_members_role_check;

-- Step 2: Remove role column
ALTER TABLE public.group_members DROP COLUMN IF EXISTS role;

-- Step 3: Update table comment
COMMENT ON TABLE public.group_members IS 'グループメンバーシップを管理するテーブル。オーナー情報は groups.owner_id で管理';
