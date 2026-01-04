-- ============================================================================
-- 説明書管理 & メンテナンスリマインドアプリ - Shared Maintenance Items
-- ============================================================================
-- 作成日: 2026-01-03
-- 概要: 家電マスターごとにメンテナンス項目を共有するためのテーブルを追加
--       LLMで抽出したメンテナンス項目をキャッシュし、複数ユーザーで再利用
-- ============================================================================

-- ============================================================================
-- Step 1: shared_maintenance_items テーブル作成
-- ============================================================================

-- ----------------------------------------------------------------------------
-- shared_maintenance_items: 家電マスターごとのメンテナンス項目（LLM抽出結果キャッシュ）
-- ----------------------------------------------------------------------------
CREATE TABLE shared_maintenance_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_appliance_id UUID NOT NULL REFERENCES shared_appliances(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    description TEXT,
    recommended_interval_type TEXT NOT NULL,
    recommended_interval_value INTEGER,
    source_page TEXT,
    importance TEXT NOT NULL DEFAULT 'medium',
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 周期タイプの制約
    CONSTRAINT chk_shared_maintenance_items_interval_type
        CHECK (recommended_interval_type IN ('days', 'months', 'manual')),

    -- 重要度の制約
    CONSTRAINT chk_shared_maintenance_items_importance
        CHECK (importance IN ('high', 'medium', 'low')),

    -- interval_type が manual の場合、interval_value は NULL
    -- interval_type が days/months の場合、interval_value は正の整数
    CONSTRAINT chk_shared_maintenance_items_interval_value
        CHECK (
            (recommended_interval_type = 'manual' AND recommended_interval_value IS NULL)
            OR
            (recommended_interval_type IN ('days', 'months') AND recommended_interval_value > 0)
        ),

    -- 同一家電で同じタスク名は禁止（重複抽出防止）
    CONSTRAINT uq_shared_maintenance_items_appliance_task
        UNIQUE (shared_appliance_id, task_name)
);

COMMENT ON TABLE shared_maintenance_items IS '家電マスターごとのメンテナンス項目（LLM抽出結果のキャッシュ）';
COMMENT ON COLUMN shared_maintenance_items.shared_appliance_id IS '対象の家電マスターID';
COMMENT ON COLUMN shared_maintenance_items.task_name IS 'タスク名（例: フィルター清掃）';
COMMENT ON COLUMN shared_maintenance_items.description IS 'タスクの詳細説明';
COMMENT ON COLUMN shared_maintenance_items.recommended_interval_type IS '推奨周期タイプ: days, months, manual';
COMMENT ON COLUMN shared_maintenance_items.recommended_interval_value IS '推奨周期の値（manual の場合は NULL）';
COMMENT ON COLUMN shared_maintenance_items.source_page IS '根拠ページ番号';
COMMENT ON COLUMN shared_maintenance_items.importance IS '重要度: high, medium, low';
COMMENT ON COLUMN shared_maintenance_items.extracted_at IS 'LLMで抽出した日時';

-- インデックス
CREATE INDEX idx_shared_maintenance_items_appliance_id
    ON shared_maintenance_items(shared_appliance_id);
CREATE INDEX idx_shared_maintenance_items_importance
    ON shared_maintenance_items(importance);

-- ============================================================================
-- Step 2: maintenance_schedules に shared_item_id カラム追加
-- ============================================================================

-- 共有メンテナンス項目への参照カラムを追加
-- NULL許容：ユーザーが独自に追加したカスタム項目の場合はNULL
ALTER TABLE maintenance_schedules
    ADD COLUMN shared_item_id UUID REFERENCES shared_maintenance_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN maintenance_schedules.shared_item_id IS '元の共有メンテナンス項目への参照（カスタム項目の場合はNULL）';

-- インデックス
CREATE INDEX idx_maintenance_schedules_shared_item_id
    ON maintenance_schedules(shared_item_id);

-- ============================================================================
-- Step 3: RLS の設定
-- ============================================================================

-- RLS を有効化
ALTER TABLE shared_maintenance_items ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- shared_maintenance_items の RLS ポリシー
-- ----------------------------------------------------------------------------

-- 全認証済みユーザーが閲覧可能（共有キャッシュのため）
CREATE POLICY "Anyone can view shared maintenance items"
    ON shared_maintenance_items
    FOR SELECT
    TO authenticated
    USING (true);

-- 認証済みユーザーは挿入可能（LLM抽出時に自動作成）
CREATE POLICY "Authenticated users can insert shared maintenance items"
    ON shared_maintenance_items
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 更新は制限（将来的に管理者のみに制限する可能性）
CREATE POLICY "Authenticated users can update shared maintenance items"
    ON shared_maintenance_items
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 削除は禁止（他のユーザーが参照している可能性があるため）
-- 必要に応じて管理者権限で削除

-- ============================================================================
-- 完了
-- ============================================================================
-- このマイグレーションで作成されたもの:
-- - Tables: shared_maintenance_items
-- - Columns: maintenance_schedules.shared_item_id
-- - Indexes: shared_appliance_id, importance, shared_item_id
-- - Constraints: interval_type, importance, interval_value の整合性チェック
-- - RLS Policies: 認証済みユーザーのアクセス制御
--
-- 設計メモ:
-- - shared_maintenance_items は家電マスター（shared_appliances）ごとに
--   LLMで抽出したメンテナンス項目をキャッシュするテーブル
-- - ユーザーは shared_maintenance_items から項目を選択し、
--   maintenance_schedules に自分用のスケジュールとして登録する
-- - maintenance_schedules.shared_item_id で元の項目への参照を保持
--   （ユーザーがカスタマイズした場合も元情報を追跡可能）
-- ============================================================================
