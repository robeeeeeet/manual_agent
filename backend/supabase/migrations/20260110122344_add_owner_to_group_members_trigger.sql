-- =====================================================
-- Migration: 00026_add_owner_to_group_members_trigger
-- Description: グループ作成時にオーナーを自動的にgroup_membersに追加するトリガー
-- Note: This migration was already applied to Supabase as 20260110122344
-- =====================================================

-- ============================================================================
-- オーナー自動追加関数
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_owner_to_group_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- オーナーを group_members に role='owner' として追加
    INSERT INTO public.group_members (group_id, user_id, role, joined_at)
    VALUES (NEW.id, NEW.owner_id, 'owner', NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        group_id = EXCLUDED.group_id,
        role = 'owner',
        joined_at = NOW();

    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.add_owner_to_group_members() IS
    'グループ作成時にオーナーをgroup_membersテーブルにrole=ownerとして自動追加する';

-- ============================================================================
-- トリガー作成
-- ============================================================================

DROP TRIGGER IF EXISTS after_group_insert_add_owner ON public.groups;

CREATE TRIGGER after_group_insert_add_owner
    AFTER INSERT ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION public.add_owner_to_group_members();

-- ============================================================================
-- 完了
-- ============================================================================
-- このマイグレーションで作成されたもの:
-- - Function: add_owner_to_group_members()
-- - Trigger: after_group_insert_add_owner (on groups table)
-- ============================================================================
