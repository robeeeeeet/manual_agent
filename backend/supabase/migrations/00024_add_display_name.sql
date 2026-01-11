-- ============================================================================
-- Migration: 00024_add_display_name.sql
-- Description: users テーブルに display_name カラムを追加
-- ============================================================================
--
-- 目的:
--   グループメンバー間で分かりやすいユーザー表示名を設定できるようにする。
--   家電の重複登録時に「○○さんが同じ家電を持っています」と表示するために使用。
--
-- 変更内容:
--   1. users テーブルに display_name カラムを追加
--   2. 既存ユーザーのdisplay_nameをメールの@前で初期化
--   3. handle_new_user() 関数を更新してdisplay_nameをサポート
--
-- ============================================================================

-- ============================================================================
-- Step 1: display_name カラムを追加
-- ============================================================================

-- まず NULL 許容で追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;

-- ============================================================================
-- Step 2: 既存ユーザーの display_name を設定
-- ============================================================================

-- メールアドレスの @ 前を display_name として設定
UPDATE users
SET display_name = SPLIT_PART(email, '@', 1)
WHERE display_name IS NULL;

-- ============================================================================
-- Step 3: NOT NULL 制約を追加
-- ============================================================================

ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;

-- デフォルト値は設定しない（サインアップ時に必須入力とするため）

-- ============================================================================
-- Step 4: コメントを追加
-- ============================================================================

COMMENT ON COLUMN users.display_name IS 'グループ内で表示されるユーザー名（サインアップ時に入力必須）';

-- ============================================================================
-- Step 5: handle_new_user() 関数を更新
-- ============================================================================
-- サインアップ時に raw_user_meta_data から display_name を取得する

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_display_name TEXT;
BEGIN
    -- raw_user_meta_data から display_name を取得（フロントエンドから渡される）
    -- 存在しない場合はメールの @ 前をデフォルトとして使用
    v_display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        SPLIT_PART(NEW.email, '@', 1)
    );

    INSERT INTO public.users (id, email, display_name, notify_time, timezone)
    VALUES (
        NEW.id,
        NEW.email,
        v_display_name,
        '09:00'::TIME,
        'Asia/Tokyo'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
    'auth.users に新規ユーザーが作成されたとき、public.users にも対応するレコードを作成する。display_name は raw_user_meta_data から取得、なければメール @ 前を使用';

-- ============================================================================
-- Step 6: RLS ポリシーの更新
-- ============================================================================
-- グループメンバーが他のメンバーの display_name を参照できるようにする

-- 既存のポリシーを維持しつつ、グループメンバー参照用のポリシーを追加
DO $$
BEGIN
    -- 既存のポリシーが存在しない場合のみ作成
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'users'
        AND policyname = 'Group members can view each other display_name'
    ) THEN
        CREATE POLICY "Group members can view each other display_name"
            ON users
            FOR SELECT
            USING (
                -- 自分自身のレコード
                auth.uid() = id
                OR
                -- 同じグループのメンバー
                EXISTS (
                    SELECT 1
                    FROM groups g
                    INNER JOIN group_members gm ON g.id = gm.group_id
                    WHERE gm.user_id = auth.uid()
                    AND (
                        g.owner_id = users.id
                        OR EXISTS (
                            SELECT 1 FROM group_members gm2
                            WHERE gm2.group_id = g.id
                            AND gm2.user_id = users.id
                        )
                    )
                )
            );
    END IF;
END $$;

-- ============================================================================
-- 完了
-- ============================================================================
-- このマイグレーションで作成/更新されたもの:
-- - Column: users.display_name (TEXT, NOT NULL)
-- - Function: handle_new_user() を更新（display_name サポート）
-- - Policy: グループメンバーの display_name 参照ポリシー
-- ============================================================================
