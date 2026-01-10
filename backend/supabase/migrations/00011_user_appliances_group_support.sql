-- Migration: 00011_user_appliances_group_support
-- Description: Add group_id to user_appliances for group ownership support
-- Phase: 7

-- =====================================================
-- 1. user_appliances に group_id カラム追加
-- =====================================================

-- グループ所有の場合に設定される group_id カラム
ALTER TABLE public.user_appliances
    ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_user_appliances_group_id ON public.user_appliances(group_id);

-- コメント追加
COMMENT ON COLUMN public.user_appliances.group_id IS 'グループID（グループ所有の場合に設定）';

-- =====================================================
-- 2. user_id を NULL 許可に変更
-- =====================================================

-- 既存データは全て user_id が設定されているため、影響なし
ALTER TABLE public.user_appliances
    ALTER COLUMN user_id DROP NOT NULL;

-- =====================================================
-- 3. 既存の UNIQUE 制約を削除
-- =====================================================

-- 既存の (user_id, name) UNIQUE 制約を削除
ALTER TABLE public.user_appliances
    DROP CONSTRAINT IF EXISTS uq_user_appliances_user_name;

-- =====================================================
-- 4. 新しい部分インデックス（条件付き UNIQUE）を作成
-- =====================================================

-- 個人所有の場合: (user_id, name) がユニーク
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_appliances_user_name_partial
    ON public.user_appliances(user_id, name)
    WHERE user_id IS NOT NULL;

-- グループ所有の場合: (group_id, name) がユニーク
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_appliances_group_name_partial
    ON public.user_appliances(group_id, name)
    WHERE group_id IS NOT NULL;

-- =====================================================
-- 5. CHECK 制約（個人所有 XOR グループ所有）
-- =====================================================

-- user_id か group_id のどちらか一方のみが設定されることを保証
ALTER TABLE public.user_appliances
    ADD CONSTRAINT chk_user_appliances_owner
    CHECK (
        (user_id IS NOT NULL AND group_id IS NULL) OR
        (user_id IS NULL AND group_id IS NOT NULL)
    );

-- =====================================================
-- 6. グループ削除時の家電移管トリガー
-- =====================================================

-- グループ削除前に、グループ家電をオーナーの個人所有に移管
CREATE OR REPLACE FUNCTION transfer_group_appliances_to_owner()
RETURNS TRIGGER AS $$
BEGIN
    -- グループ家電をオーナーの個人所有に変更
    UPDATE public.user_appliances
    SET user_id = OLD.owner_id,
        group_id = NULL,
        updated_at = NOW()
    WHERE group_id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- グループ削除前トリガー
CREATE TRIGGER before_group_delete_transfer_appliances
    BEFORE DELETE ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION transfer_group_appliances_to_owner();

-- コメント
COMMENT ON FUNCTION transfer_group_appliances_to_owner() IS 'グループ削除時に家電をオーナーの個人所有に移管';
