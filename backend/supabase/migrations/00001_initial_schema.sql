-- ============================================================================
-- 説明書管理 & メンテナンスリマインドアプリ - Initial Schema
-- ============================================================================
-- 作成日: 2026-01-02
-- 概要: ユーザー、家電、メンテナンススケジュール、実施記録、通知設定の基本スキーマ
-- ============================================================================

-- ============================================================================
-- Extensions
-- ============================================================================
-- pgvector 拡張を有効化（Phase 6 RAG機能用）
-- 将来的に documents テーブルで使用予定
CREATE EXTENSION IF NOT EXISTS vector;

-- UUID生成用
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Users Table
-- ============================================================================
-- Supabase Auth の auth.users を参照するユーザー設定テーブル
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    notify_time TIME NOT NULL DEFAULT '09:00:00',
    timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'ユーザー設定（通知時刻、タイムゾーン）';
COMMENT ON COLUMN users.id IS 'Supabase Auth の auth.users.id を参照';
COMMENT ON COLUMN users.notify_time IS 'メンテナンス通知の送信時刻（デフォルト 09:00）';
COMMENT ON COLUMN users.timezone IS 'ユーザーのタイムゾーン（デフォルト Asia/Tokyo）';

-- ============================================================================
-- Appliances Table
-- ============================================================================
-- 家電・住宅設備の情報
CREATE TABLE appliances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    maker TEXT NOT NULL,
    model_number TEXT NOT NULL,
    category TEXT NOT NULL,
    manual_source_url TEXT NOT NULL,
    stored_pdf_path TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE appliances IS '家電・住宅設備の情報';
COMMENT ON COLUMN appliances.user_id IS '所有者のユーザーID';
COMMENT ON COLUMN appliances.name IS '家電の表示名（例: リビングのエアコン）';
COMMENT ON COLUMN appliances.maker IS 'メーカー名（例: ダイキン）';
COMMENT ON COLUMN appliances.model_number IS '型番（例: S40ZTEP）';
COMMENT ON COLUMN appliances.category IS 'カテゴリ（例: エアコン・空調）';
COMMENT ON COLUMN appliances.manual_source_url IS 'マニュアルの出典URL（必須、Google Custom Search結果など）';
COMMENT ON COLUMN appliances.stored_pdf_path IS 'Supabase Storage に保存したPDFのパス';
COMMENT ON COLUMN appliances.image_url IS '家電の画像URL';

-- インデックス
CREATE INDEX idx_appliances_user_id ON appliances(user_id);
CREATE INDEX idx_appliances_category ON appliances(category);

-- ============================================================================
-- Maintenance Schedules Table
-- ============================================================================
-- メンテナンス予定・スケジュール
CREATE TABLE maintenance_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appliance_id UUID NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    description TEXT,
    interval_type TEXT NOT NULL CHECK (interval_type IN ('days', 'months', 'manual')),
    interval_value INTEGER CHECK (
        (interval_type = 'manual' AND interval_value IS NULL) OR
        (interval_type IN ('days', 'months') AND interval_value > 0)
    ),
    last_done_at TIMESTAMPTZ,
    next_due_at TIMESTAMPTZ,
    source_page TEXT,
    importance TEXT NOT NULL DEFAULT 'medium' CHECK (importance IN ('high', 'medium', 'low')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE maintenance_schedules IS 'メンテナンススケジュール';
COMMENT ON COLUMN maintenance_schedules.appliance_id IS '対象の家電ID';
COMMENT ON COLUMN maintenance_schedules.task_name IS 'メンテナンスタスク名（例: フィルター清掃）';
COMMENT ON COLUMN maintenance_schedules.description IS 'タスクの詳細説明';
COMMENT ON COLUMN maintenance_schedules.interval_type IS '周期タイプ（days: 日数、months: 月数、manual: 手動）';
COMMENT ON COLUMN maintenance_schedules.interval_value IS '周期の値（manual の場合は null）';
COMMENT ON COLUMN maintenance_schedules.last_done_at IS '最後に実施した日時';
COMMENT ON COLUMN maintenance_schedules.next_due_at IS '次回実施予定日時';
COMMENT ON COLUMN maintenance_schedules.source_page IS '根拠となったマニュアルのページ番号';
COMMENT ON COLUMN maintenance_schedules.importance IS '重要度（high: 高、medium: 中、low: 低）';

-- インデックス
CREATE INDEX idx_maintenance_schedules_appliance_id ON maintenance_schedules(appliance_id);
CREATE INDEX idx_maintenance_schedules_next_due_at ON maintenance_schedules(next_due_at);
CREATE INDEX idx_maintenance_schedules_importance ON maintenance_schedules(importance);

-- ============================================================================
-- Maintenance Logs Table
-- ============================================================================
-- メンテナンス実施記録
CREATE TABLE maintenance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES maintenance_schedules(id) ON DELETE CASCADE,
    done_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    done_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE maintenance_logs IS 'メンテナンス実施記録';
COMMENT ON COLUMN maintenance_logs.schedule_id IS '対象のスケジュールID';
COMMENT ON COLUMN maintenance_logs.done_at IS '実施日時';
COMMENT ON COLUMN maintenance_logs.done_by_user_id IS '実施者のユーザーID';
COMMENT ON COLUMN maintenance_logs.notes IS '実施時のメモ';

-- インデックス
CREATE INDEX idx_maintenance_logs_schedule_id ON maintenance_logs(schedule_id);
CREATE INDEX idx_maintenance_logs_done_at ON maintenance_logs(done_at);

-- ============================================================================
-- Push Subscriptions Table
-- ============================================================================
-- PWA プッシュ通知の購読設定
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE push_subscriptions IS 'PWA プッシュ通知の購読設定';
COMMENT ON COLUMN push_subscriptions.user_id IS '購読者のユーザーID';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'プッシュサービスのエンドポイント（一意）';
COMMENT ON COLUMN push_subscriptions.p256dh_key IS 'P-256 公開鍵（Base64エンコード）';
COMMENT ON COLUMN push_subscriptions.auth_key IS '認証シークレット（Base64エンコード）';

-- インデックス
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- ============================================================================
-- Categories Table
-- ============================================================================
-- カテゴリマスター（事前定義カテゴリ）
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_order INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE categories IS 'カテゴリマスター（事前定義カテゴリ）';
COMMENT ON COLUMN categories.name IS 'カテゴリ名';
COMMENT ON COLUMN categories.display_order IS '表示順序';

-- ============================================================================
-- Functions
-- ============================================================================

-- updated_at を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'updated_at カラムを自動更新するトリガー関数';

-- ============================================================================
-- Triggers
-- ============================================================================

-- users テーブルの updated_at 自動更新
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- appliances テーブルの updated_at 自動更新
CREATE TRIGGER update_appliances_updated_at
    BEFORE UPDATE ON appliances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- maintenance_schedules テーブルの updated_at 自動更新
CREATE TRIGGER update_maintenance_schedules_updated_at
    BEFORE UPDATE ON maintenance_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- push_subscriptions テーブルの updated_at 自動更新
CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- RLS を有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE appliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- categories は全ユーザーが読み取り可能（管理者のみ書き込み）
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies - users
-- ============================================================================

-- users: 自分のレコードのみ参照可能
CREATE POLICY "Users can view their own record"
    ON users
    FOR SELECT
    USING (auth.uid() = id);

-- users: 自分のレコードのみ挿入可能
CREATE POLICY "Users can insert their own record"
    ON users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- users: 自分のレコードのみ更新可能
CREATE POLICY "Users can update their own record"
    ON users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- users: 自分のレコードのみ削除可能
CREATE POLICY "Users can delete their own record"
    ON users
    FOR DELETE
    USING (auth.uid() = id);

-- ============================================================================
-- RLS Policies - appliances
-- ============================================================================

-- appliances: 自分の家電のみ参照可能
CREATE POLICY "Users can view their own appliances"
    ON appliances
    FOR SELECT
    USING (auth.uid() = user_id);

-- appliances: 自分の家電のみ挿入可能
CREATE POLICY "Users can insert their own appliances"
    ON appliances
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- appliances: 自分の家電のみ更新可能
CREATE POLICY "Users can update their own appliances"
    ON appliances
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- appliances: 自分の家電のみ削除可能
CREATE POLICY "Users can delete their own appliances"
    ON appliances
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- RLS Policies - maintenance_schedules
-- ============================================================================

-- maintenance_schedules: 自分の家電のメンテナンスのみ参照可能
CREATE POLICY "Users can view maintenance schedules for their appliances"
    ON maintenance_schedules
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM appliances
            WHERE appliances.id = maintenance_schedules.appliance_id
            AND appliances.user_id = auth.uid()
        )
    );

-- maintenance_schedules: 自分の家電のメンテナンスのみ挿入可能
CREATE POLICY "Users can insert maintenance schedules for their appliances"
    ON maintenance_schedules
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM appliances
            WHERE appliances.id = maintenance_schedules.appliance_id
            AND appliances.user_id = auth.uid()
        )
    );

-- maintenance_schedules: 自分の家電のメンテナンスのみ更新可能
CREATE POLICY "Users can update maintenance schedules for their appliances"
    ON maintenance_schedules
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM appliances
            WHERE appliances.id = maintenance_schedules.appliance_id
            AND appliances.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM appliances
            WHERE appliances.id = maintenance_schedules.appliance_id
            AND appliances.user_id = auth.uid()
        )
    );

-- maintenance_schedules: 自分の家電のメンテナンスのみ削除可能
CREATE POLICY "Users can delete maintenance schedules for their appliances"
    ON maintenance_schedules
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM appliances
            WHERE appliances.id = maintenance_schedules.appliance_id
            AND appliances.user_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS Policies - maintenance_logs
-- ============================================================================

-- maintenance_logs: 自分の家電のメンテナンス記録のみ参照可能
CREATE POLICY "Users can view maintenance logs for their appliances"
    ON maintenance_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM maintenance_schedules ms
            JOIN appliances a ON a.id = ms.appliance_id
            WHERE ms.id = maintenance_logs.schedule_id
            AND a.user_id = auth.uid()
        )
    );

-- maintenance_logs: 自分の家電のメンテナンス記録のみ挿入可能
CREATE POLICY "Users can insert maintenance logs for their appliances"
    ON maintenance_logs
    FOR INSERT
    WITH CHECK (
        auth.uid() = done_by_user_id
        AND EXISTS (
            SELECT 1 FROM maintenance_schedules ms
            JOIN appliances a ON a.id = ms.appliance_id
            WHERE ms.id = maintenance_logs.schedule_id
            AND a.user_id = auth.uid()
        )
    );

-- maintenance_logs: 自分の記録のみ更新可能
CREATE POLICY "Users can update their own maintenance logs"
    ON maintenance_logs
    FOR UPDATE
    USING (auth.uid() = done_by_user_id)
    WITH CHECK (auth.uid() = done_by_user_id);

-- maintenance_logs: 自分の記録のみ削除可能
CREATE POLICY "Users can delete their own maintenance logs"
    ON maintenance_logs
    FOR DELETE
    USING (auth.uid() = done_by_user_id);

-- ============================================================================
-- RLS Policies - push_subscriptions
-- ============================================================================

-- push_subscriptions: 自分の購読設定のみ参照可能
CREATE POLICY "Users can view their own push subscriptions"
    ON push_subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- push_subscriptions: 自分の購読設定のみ挿入可能
CREATE POLICY "Users can insert their own push subscriptions"
    ON push_subscriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- push_subscriptions: 自分の購読設定のみ更新可能
CREATE POLICY "Users can update their own push subscriptions"
    ON push_subscriptions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- push_subscriptions: 自分の購読設定のみ削除可能
CREATE POLICY "Users can delete their own push subscriptions"
    ON push_subscriptions
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- RLS Policies - categories
-- ============================================================================

-- categories: 全ユーザーが読み取り可能
CREATE POLICY "Anyone can view categories"
    ON categories
    FOR SELECT
    TO authenticated
    USING (true);

-- categories: 管理者のみ挿入・更新・削除可能（将来実装）
-- 現時点では seed.sql で初期データを投入し、以降は手動管理

-- ============================================================================
-- 完了
-- ============================================================================
-- このマイグレーションで作成されたもの:
-- - Extensions: vector, uuid-ossp
-- - Tables: users, appliances, maintenance_schedules, maintenance_logs,
--           push_subscriptions, categories
-- - Indexes: user_id, category, next_due_at, importance など
-- - Functions: update_updated_at_column
-- - Triggers: updated_at 自動更新
-- - RLS Policies: 全テーブルで適切なアクセス制御
-- ============================================================================
