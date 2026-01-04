-- ============================================================================
-- Migration: 00007_auth_users_sync_triggers.sql
-- Description: auth.users と public.users を同期するトリガーを追加
-- ============================================================================
--
-- 問題:
--   現在、auth.users に新規ユーザーが作成されても public.users には自動作成されない。
--   また、auth.users からユーザーを削除しても public.users のデータは残る。
--
-- 解決策:
--   1. auth.users への INSERT 時に public.users にも自動作成するトリガー
--   2. auth.users からの DELETE 時に public.users も自動削除するトリガー
--
-- ============================================================================

-- ============================================================================
-- Step 1: ユーザー作成トリガー関数
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, notify_time, timezone)
    VALUES (
        NEW.id,
        NEW.email,
        '09:00'::TIME,       -- デフォルト通知時間: 午前9時
        'Asia/Tokyo'         -- デフォルトタイムゾーン: 日本時間
    )
    ON CONFLICT (id) DO NOTHING;  -- 既に存在する場合は何もしない

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
    'auth.users に新規ユーザーが作成されたとき、public.users にも対応するレコードを作成する';

-- ============================================================================
-- Step 2: ユーザー削除トリガー関数
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.handle_user_delete() IS
    'auth.users からユーザーが削除されたとき、public.users の対応するレコードも削除する';

-- ============================================================================
-- Step 3: トリガーの作成
-- ============================================================================

-- 既存のトリガーがある場合は削除（冪等性のため）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- ユーザー作成トリガー
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ユーザー削除トリガー
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_delete();

-- ============================================================================
-- Step 4: 既存の auth.users で public.users にないユーザーを同期
-- ============================================================================
-- 注意: このマイグレーション適用時点で、既存の auth.users ユーザーで
--       public.users にレコードがない場合に作成する

INSERT INTO public.users (id, email, notify_time, timezone)
SELECT
    a.id,
    a.email,
    '09:00'::TIME,
    'Asia/Tokyo'
FROM auth.users a
LEFT JOIN public.users p ON a.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 完了
-- ============================================================================
-- このマイグレーションで作成されたもの:
-- - Functions: handle_new_user(), handle_user_delete()
-- - Triggers: on_auth_user_created, on_auth_user_deleted
--
-- 動作:
-- - auth.users に INSERT → public.users に自動作成（デフォルト設定で）
-- - auth.users から DELETE → public.users から自動削除
--   → public.users の CASCADE により、関連データも削除される
--     - user_appliances → CASCADE
--     - push_subscriptions → CASCADE
--     - maintenance_logs (done_by_user_id) → CASCADE
