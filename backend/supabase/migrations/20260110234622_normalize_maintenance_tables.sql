-- ============================================================
-- Migration: maintenance_schedules テーブル正規化
-- ============================================================
-- 目的:
--   shared_maintenance_items と maintenance_schedules 間の重複カラムを解消
--   - shared_maintenance_items をメンテナンス項目マスターとして拡張
--   - maintenance_schedules から重複カラムを削除
--
-- 変更内容:
--   1. shared_maintenance_items に user_appliance_id を追加（カスタム項目用）
--   2. shared_appliance_id を NULLABLE に変更
--   3. 排他制約を追加（shared_appliance_id XOR user_appliance_id）
--   4. 既存カスタム項目のデータ移行
--   5. maintenance_schedules.shared_item_id を NOT NULL に
--   6. maintenance_schedules から重複カラムを削除
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Step 1: shared_maintenance_items に user_appliance_id 追加
-- ------------------------------------------------------------
ALTER TABLE shared_maintenance_items
  ADD COLUMN user_appliance_id UUID REFERENCES user_appliances(id) ON DELETE CASCADE;

-- インデックス追加（カスタム項目の検索用）
CREATE INDEX idx_shared_maintenance_items_user_appliance
  ON shared_maintenance_items(user_appliance_id)
  WHERE user_appliance_id IS NOT NULL;

-- ------------------------------------------------------------
-- Step 2: shared_appliance_id を NULLABLE に変更
-- ------------------------------------------------------------
ALTER TABLE shared_maintenance_items
  ALTER COLUMN shared_appliance_id DROP NOT NULL;

-- ------------------------------------------------------------
-- Step 3: 排他制約を追加（shared または custom のどちらか一方のみ）
-- ------------------------------------------------------------
ALTER TABLE shared_maintenance_items
  ADD CONSTRAINT chk_shared_or_custom
  CHECK (
    (shared_appliance_id IS NOT NULL AND user_appliance_id IS NULL)
    OR
    (shared_appliance_id IS NULL AND user_appliance_id IS NOT NULL)
  );

-- ------------------------------------------------------------
-- Step 4: カスタム項目のデータ移行
-- （shared_item_id が NULL の maintenance_schedules をマスターに移行）
-- ------------------------------------------------------------
INSERT INTO shared_maintenance_items (
  user_appliance_id,
  task_name,
  description,
  recommended_interval_type,
  recommended_interval_value,
  source_page,
  importance
)
SELECT
  user_appliance_id,
  task_name,
  description,
  interval_type,
  interval_value,
  source_page,
  importance
FROM maintenance_schedules
WHERE shared_item_id IS NULL;

-- ------------------------------------------------------------
-- Step 5: shared_item_id を更新（カスタム項目）
-- ------------------------------------------------------------
UPDATE maintenance_schedules ms
SET shared_item_id = (
  SELECT smi.id
  FROM shared_maintenance_items smi
  WHERE smi.user_appliance_id = ms.user_appliance_id
    AND smi.task_name = ms.task_name
)
WHERE ms.shared_item_id IS NULL;

-- ------------------------------------------------------------
-- Step 6: shared_item_id を NOT NULL に変更
-- ------------------------------------------------------------
ALTER TABLE maintenance_schedules
  ALTER COLUMN shared_item_id SET NOT NULL;

-- ------------------------------------------------------------
-- Step 7: 重複カラムを削除
-- ------------------------------------------------------------
ALTER TABLE maintenance_schedules
  DROP COLUMN task_name,
  DROP COLUMN description,
  DROP COLUMN source_page,
  DROP COLUMN importance;

-- ------------------------------------------------------------
-- Step 8: ユニーク制約を更新
-- ------------------------------------------------------------
-- 既存の制約を削除
ALTER TABLE shared_maintenance_items
  DROP CONSTRAINT IF EXISTS uq_shared_maintenance_items_appliance_task;

-- 新しい制約を追加（shared_appliance_id または user_appliance_id + task_name でユニーク）
-- NULLS NOT DISTINCT: NULL値も重複チェックの対象に
ALTER TABLE shared_maintenance_items
  ADD CONSTRAINT uq_shared_maintenance_items_task
  UNIQUE NULLS NOT DISTINCT (shared_appliance_id, user_appliance_id, task_name);

-- ------------------------------------------------------------
-- Step 9: RLS更新（カスタム項目用）
-- ------------------------------------------------------------
-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Users can view shared maintenance items" ON shared_maintenance_items;
DROP POLICY IF EXISTS "Authenticated users can read shared maintenance items" ON shared_maintenance_items;

-- 新しいポリシーを作成
-- 共有項目: 全員がアクセス可能
-- カスタム項目: 所有者またはグループメンバーのみアクセス可能
CREATE POLICY "Users can manage maintenance items"
  ON shared_maintenance_items
  FOR ALL
  TO authenticated
  USING (
    -- 共有項目は全員アクセス可
    user_appliance_id IS NULL
    OR
    -- カスタム項目は所有者またはグループメンバーのみ
    EXISTS (
      SELECT 1 FROM user_appliances ua
      WHERE ua.id = shared_maintenance_items.user_appliance_id
      AND (
        ua.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM group_members gm
          WHERE gm.group_id = ua.group_id AND gm.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    -- 共有項目の作成は許可しない（サービス経由のみ）
    user_appliance_id IS NOT NULL
    AND
    -- カスタム項目は所有者またはグループメンバーのみ作成可能
    EXISTS (
      SELECT 1 FROM user_appliances ua
      WHERE ua.id = shared_maintenance_items.user_appliance_id
      AND (
        ua.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM group_members gm
          WHERE gm.group_id = ua.group_id AND gm.user_id = auth.uid()
        )
      )
    )
  );

COMMIT;
