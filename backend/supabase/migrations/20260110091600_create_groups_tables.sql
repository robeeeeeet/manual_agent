-- Migration: 00010_create_groups_tables
-- Description: Create groups and group_members tables for family sharing feature
-- Phase: 7

-- =====================================================
-- 1. groups テーブル（グループマスター）
-- =====================================================

CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_code TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 招待コードのユニーク制約とインデックス
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_invite_code ON public.groups(invite_code);

-- オーナー検索用インデックス
CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON public.groups(owner_id);

-- コメント
COMMENT ON TABLE public.groups IS 'グループ（家族共有単位）を管理するテーブル';
COMMENT ON COLUMN public.groups.id IS 'グループID（PK）';
COMMENT ON COLUMN public.groups.name IS 'グループ名';
COMMENT ON COLUMN public.groups.invite_code IS '招待コード（6-8文字英数字）';
COMMENT ON COLUMN public.groups.owner_id IS 'グループオーナーのユーザーID';
COMMENT ON COLUMN public.groups.created_at IS '作成日時';
COMMENT ON COLUMN public.groups.updated_at IS '更新日時';

-- =====================================================
-- 2. group_members テーブル（グループメンバー）
-- =====================================================

CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 同一グループに同一ユーザーは1回のみ
    CONSTRAINT uq_group_members_group_user UNIQUE (group_id, user_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

-- コメント
COMMENT ON TABLE public.group_members IS 'グループメンバーシップを管理するテーブル';
COMMENT ON COLUMN public.group_members.id IS 'メンバーシップID（PK）';
COMMENT ON COLUMN public.group_members.group_id IS '所属グループID';
COMMENT ON COLUMN public.group_members.user_id IS 'メンバーのユーザーID';
COMMENT ON COLUMN public.group_members.role IS '役割（owner: オーナー, member: メンバー）';
COMMENT ON COLUMN public.group_members.joined_at IS '参加日時';

-- =====================================================
-- 3. updated_at 自動更新トリガー
-- =====================================================

-- groups テーブル用
CREATE OR REPLACE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. RLS ポリシー
-- =====================================================

-- groups テーブルの RLS 有効化
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- groups: グループメンバーのみ閲覧可能
CREATE POLICY "Members can view their groups"
    ON public.groups FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = groups.id
            AND group_members.user_id = auth.uid()
        )
    );

-- groups: 認証済みユーザーが作成可能
CREATE POLICY "Authenticated users can create groups"
    ON public.groups FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- groups: オーナーのみ更新可能
CREATE POLICY "Owners can update their groups"
    ON public.groups FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- groups: オーナーのみ削除可能
CREATE POLICY "Owners can delete their groups"
    ON public.groups FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- group_members テーブルの RLS 有効化
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- group_members: 同じグループのメンバーを閲覧可能
CREATE POLICY "Members can view group members"
    ON public.group_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_members.group_id
            AND gm.user_id = auth.uid()
        )
    );

-- group_members: 自分自身を追加可能（招待コード経由での参加）
CREATE POLICY "Users can join groups"
    ON public.group_members FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- group_members: 本人またはグループオーナーが削除可能
CREATE POLICY "Members can leave or be removed"
    ON public.group_members FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.groups
            WHERE groups.id = group_members.group_id
            AND groups.owner_id = auth.uid()
        )
    );

-- =====================================================
-- 5. service_role 用ポリシー（バックエンド処理用）
-- =====================================================

-- groups: service_role は全操作可能
CREATE POLICY "Service role has full access to groups"
    ON public.groups FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- group_members: service_role は全操作可能
CREATE POLICY "Service role has full access to group_members"
    ON public.group_members FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
