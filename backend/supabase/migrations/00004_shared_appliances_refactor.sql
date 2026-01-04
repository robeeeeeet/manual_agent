-- ============================================================================
-- 説明書管理 & メンテナンスリマインドアプリ - Shared Appliances Refactor
-- ============================================================================
-- 作成日: 2026-01-03
-- 概要: appliancesテーブルを shared_appliances と user_appliances に分離
--       家電マスターデータの共有と所有関係の分離を実現
-- ============================================================================

-- ============================================================================
-- 注意: このマイグレーションは破壊的変更を含みます
-- 既存の appliances データがある場合は事前にバックアップしてください
-- ============================================================================

-- ============================================================================
-- Step 1: 新しいテーブル作成
-- ============================================================================

-- ----------------------------------------------------------------------------
-- shared_appliances: 家電マスターテーブル（メーカー・型番・説明書情報）
-- ----------------------------------------------------------------------------
CREATE TABLE shared_appliances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maker TEXT NOT NULL,
    model_number TEXT NOT NULL,
    category TEXT NOT NULL,
    manual_source_url TEXT,
    stored_pdf_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 同一メーカー・型番の重複を防止
    CONSTRAINT uq_shared_appliances_maker_model UNIQUE (maker, model_number)
);

COMMENT ON TABLE shared_appliances IS '家電マスター（メーカー・型番・説明書情報）';
COMMENT ON COLUMN shared_appliances.maker IS 'メーカー名（例: ダイキン）';
COMMENT ON COLUMN shared_appliances.model_number IS '型番（例: S40ZTEP）';
COMMENT ON COLUMN shared_appliances.category IS 'カテゴリ（例: エアコン・空調）';
COMMENT ON COLUMN shared_appliances.manual_source_url IS 'マニュアルの出典URL（Google Custom Search結果など）';
COMMENT ON COLUMN shared_appliances.stored_pdf_path IS 'Supabase Storage に保存したPDFのパス（共有）';

-- インデックス
CREATE INDEX idx_shared_appliances_maker ON shared_appliances(maker);
CREATE INDEX idx_shared_appliances_category ON shared_appliances(category);
CREATE INDEX idx_shared_appliances_model_number ON shared_appliances(model_number);

-- updated_at トリガー
CREATE TRIGGER update_shared_appliances_updated_at
    BEFORE UPDATE ON shared_appliances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- user_appliances: ユーザー所有関係テーブル
-- ----------------------------------------------------------------------------
CREATE TABLE user_appliances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_appliance_id UUID NOT NULL REFERENCES shared_appliances(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 同一ユーザーが同じ家電を複数回登録可能（例: 複数台のエアコン）
    -- 重複防止が必要な場合は以下のコメントを解除
    -- CONSTRAINT uq_user_appliances_user_shared UNIQUE (user_id, shared_appliance_id)

    -- 同一ユーザーが同じ表示名を使用することは防止
    CONSTRAINT uq_user_appliances_user_name UNIQUE (user_id, name)
);

COMMENT ON TABLE user_appliances IS 'ユーザーの家電所有関係';
COMMENT ON COLUMN user_appliances.user_id IS '所有者のユーザーID';
COMMENT ON COLUMN user_appliances.shared_appliance_id IS '家電マスターへの参照';
COMMENT ON COLUMN user_appliances.name IS 'ユーザー固有の表示名（例: リビングのエアコン）';
COMMENT ON COLUMN user_appliances.image_url IS 'ユーザーがアップロードした画像URL';

-- インデックス
CREATE INDEX idx_user_appliances_user_id ON user_appliances(user_id);
CREATE INDEX idx_user_appliances_shared_appliance_id ON user_appliances(shared_appliance_id);

-- updated_at トリガー
CREATE TRIGGER update_user_appliances_updated_at
    BEFORE UPDATE ON user_appliances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Step 2: maintenance_schedules の参照先を変更
-- ============================================================================

-- 既存の外部キー制約を削除
ALTER TABLE maintenance_schedules
    DROP CONSTRAINT IF EXISTS maintenance_schedules_appliance_id_fkey;

-- カラム名を変更
ALTER TABLE maintenance_schedules
    RENAME COLUMN appliance_id TO user_appliance_id;

-- 新しい外部キー制約を追加
ALTER TABLE maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_user_appliance_id_fkey
    FOREIGN KEY (user_appliance_id) REFERENCES user_appliances(id) ON DELETE CASCADE;

-- インデックスを再作成
DROP INDEX IF EXISTS idx_maintenance_schedules_appliance_id;
CREATE INDEX idx_maintenance_schedules_user_appliance_id ON maintenance_schedules(user_appliance_id);

-- ============================================================================
-- Step 3: 既存の appliances テーブルを削除（データ移行後）
-- ============================================================================
-- 注意: 既存データがある場合は先にデータ移行スクリプトを実行してください

-- まず、appliances を参照している maintenance_schedules の RLS ポリシーを削除
DROP POLICY IF EXISTS "Users can view maintenance schedules for their appliances" ON maintenance_schedules;
DROP POLICY IF EXISTS "Users can insert maintenance schedules for their appliances" ON maintenance_schedules;
DROP POLICY IF EXISTS "Users can update maintenance schedules for their appliances" ON maintenance_schedules;
DROP POLICY IF EXISTS "Users can delete maintenance schedules for their appliances" ON maintenance_schedules;

-- appliances を参照している maintenance_logs の RLS ポリシーを削除
DROP POLICY IF EXISTS "Users can view maintenance logs for their appliances" ON maintenance_logs;
DROP POLICY IF EXISTS "Users can insert maintenance logs for their appliances" ON maintenance_logs;

-- 既存のRLSポリシーを削除
DROP POLICY IF EXISTS "Users can view their own appliances" ON appliances;
DROP POLICY IF EXISTS "Users can insert their own appliances" ON appliances;
DROP POLICY IF EXISTS "Users can update their own appliances" ON appliances;
DROP POLICY IF EXISTS "Users can delete their own appliances" ON appliances;

-- 既存のトリガーを削除
DROP TRIGGER IF EXISTS update_appliances_updated_at ON appliances;

-- 既存のインデックスを削除
DROP INDEX IF EXISTS idx_appliances_user_id;
DROP INDEX IF EXISTS idx_appliances_category;

-- テーブルを削除
DROP TABLE IF EXISTS appliances;

-- ============================================================================
-- Step 4: RLS の設定
-- ============================================================================

-- RLS を有効化
ALTER TABLE shared_appliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_appliances ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- shared_appliances の RLS ポリシー
-- ----------------------------------------------------------------------------
-- 全ユーザーが閲覧可能（共有マスターデータのため）
CREATE POLICY "Anyone can view shared appliances"
    ON shared_appliances
    FOR SELECT
    TO authenticated
    USING (true);

-- 認証済みユーザーは挿入可能（新しい家電を登録する際に自動作成）
CREATE POLICY "Authenticated users can insert shared appliances"
    ON shared_appliances
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 更新は制限（将来的に管理者のみに制限する可能性）
-- 現時点では認証済みユーザーが更新可能
CREATE POLICY "Authenticated users can update shared appliances"
    ON shared_appliances
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 削除は禁止（他のユーザーが参照している可能性があるため）
-- 必要に応じて管理者権限で削除

-- ----------------------------------------------------------------------------
-- user_appliances の RLS ポリシー
-- ----------------------------------------------------------------------------
-- 自分の所有関係のみ閲覧可能
CREATE POLICY "Users can view their own user_appliances"
    ON user_appliances
    FOR SELECT
    USING (auth.uid() = user_id);

-- 自分の所有関係のみ挿入可能
CREATE POLICY "Users can insert their own user_appliances"
    ON user_appliances
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 自分の所有関係のみ更新可能
CREATE POLICY "Users can update their own user_appliances"
    ON user_appliances
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 自分の所有関係のみ削除可能
CREATE POLICY "Users can delete their own user_appliances"
    ON user_appliances
    FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- maintenance_schedules の RLS ポリシーを更新
-- ----------------------------------------------------------------------------
-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can view maintenance schedules for their appliances" ON maintenance_schedules;
DROP POLICY IF EXISTS "Users can insert maintenance schedules for their appliances" ON maintenance_schedules;
DROP POLICY IF EXISTS "Users can update maintenance schedules for their appliances" ON maintenance_schedules;
DROP POLICY IF EXISTS "Users can delete maintenance schedules for their appliances" ON maintenance_schedules;

-- 新しいポリシーを作成（user_appliances を参照）
CREATE POLICY "Users can view maintenance schedules for their appliances"
    ON maintenance_schedules
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_appliances
            WHERE user_appliances.id = maintenance_schedules.user_appliance_id
            AND user_appliances.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert maintenance schedules for their appliances"
    ON maintenance_schedules
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_appliances
            WHERE user_appliances.id = maintenance_schedules.user_appliance_id
            AND user_appliances.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update maintenance schedules for their appliances"
    ON maintenance_schedules
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_appliances
            WHERE user_appliances.id = maintenance_schedules.user_appliance_id
            AND user_appliances.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_appliances
            WHERE user_appliances.id = maintenance_schedules.user_appliance_id
            AND user_appliances.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete maintenance schedules for their appliances"
    ON maintenance_schedules
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_appliances
            WHERE user_appliances.id = maintenance_schedules.user_appliance_id
            AND user_appliances.user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- maintenance_logs の RLS ポリシーを更新
-- ----------------------------------------------------------------------------
-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can view maintenance logs for their appliances" ON maintenance_logs;
DROP POLICY IF EXISTS "Users can insert maintenance logs for their appliances" ON maintenance_logs;

-- 新しいポリシーを作成（user_appliances を参照）
CREATE POLICY "Users can view maintenance logs for their appliances"
    ON maintenance_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM maintenance_schedules ms
            JOIN user_appliances ua ON ua.id = ms.user_appliance_id
            WHERE ms.id = maintenance_logs.schedule_id
            AND ua.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert maintenance logs for their appliances"
    ON maintenance_logs
    FOR INSERT
    WITH CHECK (
        auth.uid() = done_by_user_id
        AND EXISTS (
            SELECT 1 FROM maintenance_schedules ms
            JOIN user_appliances ua ON ua.id = ms.user_appliance_id
            WHERE ms.id = maintenance_logs.schedule_id
            AND ua.user_id = auth.uid()
        )
    );

-- ============================================================================
-- 完了
-- ============================================================================
-- このマイグレーションで作成されたもの:
-- - Tables: shared_appliances, user_appliances
-- - Indexes: maker, category, model_number, user_id, shared_appliance_id
-- - Triggers: updated_at 自動更新
-- - RLS Policies: 適切なアクセス制御
--
-- 変更されたもの:
-- - maintenance_schedules.appliance_id → user_appliance_id
-- - maintenance_schedules の RLS ポリシー
-- - maintenance_logs の RLS ポリシー
--
-- 削除されたもの:
-- - appliances テーブル（および関連インデックス、トリガー、RLSポリシー）
-- ============================================================================
