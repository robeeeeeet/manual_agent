-- Migration: 00012_update_rls_for_groups
-- Description: Update RLS policies for user_appliances, maintenance_schedules, maintenance_logs to support group ownership
-- Phase: 7

-- =====================================================
-- 1. user_appliances RLS ポリシー更新
-- =====================================================

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Users can view their own user_appliances" ON public.user_appliances;
DROP POLICY IF EXISTS "Users can insert their own user_appliances" ON public.user_appliances;
DROP POLICY IF EXISTS "Users can update their own user_appliances" ON public.user_appliances;
DROP POLICY IF EXISTS "Users can delete their own user_appliances" ON public.user_appliances;

-- SELECT: 個人所有 OR グループメンバーとして閲覧可能
CREATE POLICY "Users can view user_appliances"
    ON public.user_appliances FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = user_appliances.group_id
            AND group_members.user_id = auth.uid()
        )
    );

-- INSERT: 個人所有 OR グループメンバーとして登録可能
CREATE POLICY "Users can insert user_appliances"
    ON public.user_appliances FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = user_appliances.group_id
            AND group_members.user_id = auth.uid()
        )
    );

-- UPDATE: 個人所有 OR グループメンバーとして更新可能
CREATE POLICY "Users can update user_appliances"
    ON public.user_appliances FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = user_appliances.group_id
            AND group_members.user_id = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = user_appliances.group_id
            AND group_members.user_id = auth.uid()
        )
    );

-- DELETE: 個人所有 OR グループメンバーとして削除可能
CREATE POLICY "Users can delete user_appliances"
    ON public.user_appliances FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = user_appliances.group_id
            AND group_members.user_id = auth.uid()
        )
    );

-- =====================================================
-- 2. maintenance_schedules RLS ポリシー更新
-- =====================================================

-- 既存ポリシーを削除（00004で作成されたもの）
DROP POLICY IF EXISTS "Users can view maintenance schedules" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Users can insert maintenance schedules" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Users can update maintenance schedules" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Users can delete maintenance schedules" ON public.maintenance_schedules;

-- SELECT: 個人家電 OR グループ家電のスケジュールを閲覧可能
CREATE POLICY "Users can view maintenance schedules"
    ON public.maintenance_schedules FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_appliances ua
            WHERE ua.id = maintenance_schedules.user_appliance_id
            AND (
                ua.user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.group_members gm
                    WHERE gm.group_id = ua.group_id
                    AND gm.user_id = auth.uid()
                )
            )
        )
    );

-- INSERT: 個人家電 OR グループ家電にスケジュール追加可能
CREATE POLICY "Users can insert maintenance schedules"
    ON public.maintenance_schedules FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_appliances ua
            WHERE ua.id = maintenance_schedules.user_appliance_id
            AND (
                ua.user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.group_members gm
                    WHERE gm.group_id = ua.group_id
                    AND gm.user_id = auth.uid()
                )
            )
        )
    );

-- UPDATE: 個人家電 OR グループ家電のスケジュールを更新可能
CREATE POLICY "Users can update maintenance schedules"
    ON public.maintenance_schedules FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_appliances ua
            WHERE ua.id = maintenance_schedules.user_appliance_id
            AND (
                ua.user_id = auth.uid() OR
                EXISTS (
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
                ua.user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.group_members gm
                    WHERE gm.group_id = ua.group_id
                    AND gm.user_id = auth.uid()
                )
            )
        )
    );

-- DELETE: 個人家電 OR グループ家電のスケジュールを削除可能
CREATE POLICY "Users can delete maintenance schedules"
    ON public.maintenance_schedules FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_appliances ua
            WHERE ua.id = maintenance_schedules.user_appliance_id
            AND (
                ua.user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.group_members gm
                    WHERE gm.group_id = ua.group_id
                    AND gm.user_id = auth.uid()
                )
            )
        )
    );

-- =====================================================
-- 3. maintenance_logs RLS ポリシー更新
-- =====================================================

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Users can view maintenance logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Users can insert maintenance logs" ON public.maintenance_logs;

-- SELECT: 個人家電 OR グループ家電の完了記録を閲覧可能
CREATE POLICY "Users can view maintenance logs"
    ON public.maintenance_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.maintenance_schedules ms
            JOIN public.user_appliances ua ON ua.id = ms.user_appliance_id
            WHERE ms.id = maintenance_logs.schedule_id
            AND (
                ua.user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.group_members gm
                    WHERE gm.group_id = ua.group_id
                    AND gm.user_id = auth.uid()
                )
            )
        )
    );

-- INSERT: 自分が実施者として完了記録を追加可能（グループ家電含む）
CREATE POLICY "Users can insert maintenance logs"
    ON public.maintenance_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        done_by_user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.maintenance_schedules ms
            JOIN public.user_appliances ua ON ua.id = ms.user_appliance_id
            WHERE ms.id = maintenance_logs.schedule_id
            AND (
                ua.user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.group_members gm
                    WHERE gm.group_id = ua.group_id
                    AND gm.user_id = auth.uid()
                )
            )
        )
    );
