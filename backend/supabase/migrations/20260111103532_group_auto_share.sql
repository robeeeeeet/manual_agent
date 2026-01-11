-- ============================================================================
-- Migration: 00025_group_auto_share.sql
-- Purpose: グループ内全自動共有への変更
--          - グループ参加中のユーザーの個人家電をグループ家電に変換
--          - QAセッションにgroup_idを追加（グループ内共有用）
--          - RLSポリシーの簡略化
-- ============================================================================

-- ============================================================================
-- Phase 1: 既存データの移行（グループ参加者の個人家電をグループ家電に変換）
-- ============================================================================

-- グループに参加しているユーザーの個人所有家電を、そのグループの家電に変換
UPDATE public.user_appliances ua
SET group_id = gm.group_id,
    updated_at = NOW()
FROM public.group_members gm
WHERE ua.user_id = gm.user_id
  AND ua.group_id IS NULL;

-- ============================================================================
-- Phase 2: qa_sessions テーブルに group_id カラム追加
-- ============================================================================

ALTER TABLE public.qa_sessions
    ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- インデックス追加
CREATE INDEX idx_qa_sessions_group_id ON public.qa_sessions(group_id);

COMMENT ON COLUMN public.qa_sessions.group_id IS 'グループID（グループ共有の場合に設定）';

-- 既存のセッションをグループに紐づける（ユーザーがグループに参加している場合）
UPDATE public.qa_sessions qs
SET group_id = gm.group_id
FROM public.group_members gm
WHERE qs.user_id = gm.user_id
  AND qs.group_id IS NULL;

-- ============================================================================
-- Phase 3: qa_sessions のRLSポリシーを更新（グループ内共有対応）
-- ============================================================================

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Users can manage own sessions" ON public.qa_sessions;

-- 新しいポリシー：個人セッション OR グループセッション
CREATE POLICY "Users can access own or group sessions" ON public.qa_sessions
    FOR ALL
    TO authenticated
    USING (
        -- 自分のセッション
        user_id = auth.uid()
        OR
        -- グループメンバーとして共有セッション
        (group_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = qa_sessions.group_id
              AND gm.user_id = auth.uid()
        ))
    )
    WITH CHECK (
        -- 作成は自分のセッションのみ
        user_id = auth.uid()
    );

-- qa_session_messages のポリシーも更新
DROP POLICY IF EXISTS "Users can manage own session messages" ON public.qa_session_messages;

CREATE POLICY "Users can access session messages" ON public.qa_session_messages
    FOR ALL
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM public.qa_sessions
            WHERE user_id = auth.uid()
               OR (group_id IS NOT NULL AND EXISTS (
                   SELECT 1 FROM public.group_members gm
                   WHERE gm.group_id = qa_sessions.group_id
                     AND gm.user_id = auth.uid()
               ))
        )
    )
    WITH CHECK (
        session_id IN (
            SELECT id FROM public.qa_sessions
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- Phase 4: アクティブセッションのユニーク制約を更新
-- ============================================================================

-- 既存のインデックスを削除
DROP INDEX IF EXISTS idx_qa_sessions_active_unique;

-- 新しいユニークインデックス：
-- 個人の場合: user_id + shared_appliance_id でユニーク
-- グループの場合: group_id + shared_appliance_id でユニーク
CREATE UNIQUE INDEX idx_qa_sessions_active_user_unique
ON public.qa_sessions(user_id, shared_appliance_id)
WHERE is_active = true AND group_id IS NULL;

CREATE UNIQUE INDEX idx_qa_sessions_active_group_unique
ON public.qa_sessions(group_id, shared_appliance_id)
WHERE is_active = true AND group_id IS NOT NULL;

-- ============================================================================
-- Phase 5: user_appliances のRLSを簡略化（グループ内は全員アクセス可能）
-- ============================================================================

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Users can view their own user_appliances" ON public.user_appliances;
DROP POLICY IF EXISTS "Users can insert their own user_appliances" ON public.user_appliances;
DROP POLICY IF EXISTS "Users can update their own user_appliances" ON public.user_appliances;
DROP POLICY IF EXISTS "Users can delete their own user_appliances" ON public.user_appliances;
DROP POLICY IF EXISTS "Users can view own and group appliances" ON public.user_appliances;
DROP POLICY IF EXISTS "Users can manage own and group appliances" ON public.user_appliances;

-- 新しいシンプルなポリシー
-- SELECT: 個人所有 OR グループメンバー
CREATE POLICY "Users can view appliances"
    ON public.user_appliances
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR
        (group_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = user_appliances.group_id
              AND gm.user_id = auth.uid()
        ))
    );

-- INSERT: 個人所有として挿入（グループ設定はサービス層で行う）
CREATE POLICY "Users can insert appliances"
    ON public.user_appliances
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
    );

-- UPDATE: 個人所有 OR グループメンバー（全員が編集可能）
CREATE POLICY "Users can update appliances"
    ON public.user_appliances
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR
        (group_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = user_appliances.group_id
              AND gm.user_id = auth.uid()
        ))
    )
    WITH CHECK (
        user_id = auth.uid()
        OR
        (group_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = user_appliances.group_id
              AND gm.user_id = auth.uid()
        ))
    );

-- DELETE: 個人所有 OR グループメンバー（全員が削除可能）
CREATE POLICY "Users can delete appliances"
    ON public.user_appliances
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR
        (group_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = user_appliances.group_id
              AND gm.user_id = auth.uid()
        ))
    );

-- ============================================================================
-- Phase 6: maintenance_schedules のRLSを更新（グループ対応）
-- ============================================================================

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Users can view maintenance schedules for their appliances" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Users can insert maintenance schedules for their appliances" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Users can update maintenance schedules for their appliances" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Users can delete maintenance schedules for their appliances" ON public.maintenance_schedules;

-- 新しいポリシー（グループメンバーもアクセス可能）
CREATE POLICY "Users can view maintenance schedules"
    ON public.maintenance_schedules
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_appliances ua
            WHERE ua.id = maintenance_schedules.user_appliance_id
              AND (
                  ua.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.group_members gm
                      WHERE gm.group_id = ua.group_id
                        AND gm.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY "Users can insert maintenance schedules"
    ON public.maintenance_schedules
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_appliances ua
            WHERE ua.id = maintenance_schedules.user_appliance_id
              AND (
                  ua.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.group_members gm
                      WHERE gm.group_id = ua.group_id
                        AND gm.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY "Users can update maintenance schedules"
    ON public.maintenance_schedules
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_appliances ua
            WHERE ua.id = maintenance_schedules.user_appliance_id
              AND (
                  ua.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.group_members gm
                      WHERE gm.group_id = ua.group_id
                        AND gm.user_id = auth.uid()
                  )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_appliances ua
            WHERE ua.id = maintenance_schedules.user_appliance_id
              AND (
                  ua.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.group_members gm
                      WHERE gm.group_id = ua.group_id
                        AND gm.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY "Users can delete maintenance schedules"
    ON public.maintenance_schedules
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_appliances ua
            WHERE ua.id = maintenance_schedules.user_appliance_id
              AND (
                  ua.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.group_members gm
                      WHERE gm.group_id = ua.group_id
                        AND gm.user_id = auth.uid()
                  )
              )
        )
    );

-- ============================================================================
-- Phase 7: maintenance_logs のRLSを更新（グループ対応）
-- ============================================================================

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Users can view maintenance logs for their appliances" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Users can insert maintenance logs for their appliances" ON public.maintenance_logs;

-- 新しいポリシー（グループメンバーもアクセス可能）
CREATE POLICY "Users can view maintenance logs"
    ON public.maintenance_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.maintenance_schedules ms
            JOIN public.user_appliances ua ON ua.id = ms.user_appliance_id
            WHERE ms.id = maintenance_logs.schedule_id
              AND (
                  ua.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.group_members gm
                      WHERE gm.group_id = ua.group_id
                        AND gm.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY "Users can insert maintenance logs"
    ON public.maintenance_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = done_by_user_id
        AND EXISTS (
            SELECT 1 FROM public.maintenance_schedules ms
            JOIN public.user_appliances ua ON ua.id = ms.user_appliance_id
            WHERE ms.id = maintenance_logs.schedule_id
              AND (
                  ua.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.group_members gm
                      WHERE gm.group_id = ua.group_id
                        AND gm.user_id = auth.uid()
                  )
              )
        )
    );

-- ============================================================================
-- 完了
-- ============================================================================
-- このマイグレーションで変更されたもの:
-- 1. グループ参加者の個人家電をグループ家電に変換
-- 2. qa_sessions に group_id カラム追加
-- 3. RLSポリシーをグループ対応に更新
