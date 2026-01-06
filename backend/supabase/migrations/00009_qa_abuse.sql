-- ============================================================================
-- Migration: 00009_qa_abuse.sql
-- Description: QA不正利用防止テーブルの作成
-- ============================================================================
--
-- 目的:
--   QA機能に対する不正利用（製品に関係ない質問、攻撃的質問）を防止する。
--   違反記録を管理し、繰り返し違反したユーザーに対して利用制限を適用する。
--
-- 設計:
--   - qa_violations: 違反した質問を記録（off_topic/inappropriate/attack）
--   - qa_restrictions: ユーザーごとの利用制限状態を管理
--   - 制限時間: 1回目=警告のみ, 2回目=1時間, 3回目=24時間, 4回目以降=7日間
--   - RLS: 管理者以外は閲覧のみ可能（自分の記録のみ）
--
-- ============================================================================

-- ============================================================================
-- Step 1: qa_violations テーブル作成（違反記録）
-- ============================================================================

CREATE TABLE qa_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_appliance_id UUID NOT NULL REFERENCES shared_appliances(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    violation_type TEXT NOT NULL CHECK (violation_type IN ('off_topic', 'inappropriate', 'attack')),
    detection_method TEXT NOT NULL CHECK (detection_method IN ('rule_based', 'llm')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE qa_violations IS 'QA機能の違反記録テーブル（不適切な質問の履歴）';
COMMENT ON COLUMN qa_violations.user_id IS '違反したユーザーID';
COMMENT ON COLUMN qa_violations.shared_appliance_id IS '質問対象の製品ID';
COMMENT ON COLUMN qa_violations.question IS '違反した質問内容';
COMMENT ON COLUMN qa_violations.violation_type IS '違反タイプ: off_topic（製品無関係）, inappropriate（不適切）, attack（攻撃的）';
COMMENT ON COLUMN qa_violations.detection_method IS '検出方法: rule_based（ルールベース）, llm（LLM判定）';
COMMENT ON COLUMN qa_violations.created_at IS '違反日時';

-- ============================================================================
-- Step 2: qa_restrictions テーブル作成（利用制限状態）
-- ============================================================================

CREATE TABLE qa_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    violation_count INTEGER NOT NULL DEFAULT 0,
    restricted_until TIMESTAMPTZ,
    last_violation_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE qa_restrictions IS 'QA機能の利用制限状態テーブル';
COMMENT ON COLUMN qa_restrictions.user_id IS 'ユーザーID（一意制約）';
COMMENT ON COLUMN qa_restrictions.violation_count IS '累計違反回数';
COMMENT ON COLUMN qa_restrictions.restricted_until IS '制限解除日時（NULLなら制限なし）';
COMMENT ON COLUMN qa_restrictions.last_violation_at IS '最終違反日時';
COMMENT ON COLUMN qa_restrictions.created_at IS '作成日時';
COMMENT ON COLUMN qa_restrictions.updated_at IS '更新日時';

-- ============================================================================
-- Step 3: インデックス作成
-- ============================================================================

-- ユーザーごとの違反履歴取得用
CREATE INDEX idx_qa_violations_user ON qa_violations(user_id, created_at DESC);

-- 製品ごとの違反分析用
CREATE INDEX idx_qa_violations_appliance ON qa_violations(shared_appliance_id);

-- 違反タイプ別の集計用
CREATE INDEX idx_qa_violations_type ON qa_violations(violation_type);

-- ユーザーの制限状態確認用（UNIQUE制約があるためインデックス不要だが、パフォーマンス向上のため作成）
CREATE INDEX idx_qa_restrictions_user ON qa_restrictions(user_id);

-- 制限中ユーザーの一覧取得用
CREATE INDEX idx_qa_restrictions_active ON qa_restrictions(restricted_until) WHERE restricted_until IS NOT NULL;

-- ============================================================================
-- Step 4: Row Level Security (RLS) 設定
-- ============================================================================

ALTER TABLE qa_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_restrictions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------
-- qa_violations のポリシー
-- ------------------------------------

-- ユーザーは自分の違反記録のみ閲覧可能
CREATE POLICY "Users can view own violations"
    ON qa_violations
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 違反記録の作成はバックエンドサービス（service_role）のみ
-- （RLSポリシーなし = service_roleのみ可能）

-- ------------------------------------
-- qa_restrictions のポリシー
-- ------------------------------------

-- ユーザーは自分の制限状態のみ閲覧可能
CREATE POLICY "Users can view own restrictions"
    ON qa_restrictions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 制限状態の更新はバックエンドサービス（service_role）のみ
-- （RLSポリシーなし = service_roleのみ可能）

-- ============================================================================
-- Step 5: updated_at 自動更新トリガー
-- ============================================================================

-- トリガー関数（既存の場合はスキップ）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- qa_restrictions の updated_at を自動更新
CREATE TRIGGER update_qa_restrictions_updated_at
    BEFORE UPDATE ON qa_restrictions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 完了
-- ============================================================================
-- このマイグレーションで作成されたもの:
-- - Tables:
--   - qa_violations（違反記録）
--   - qa_restrictions（利用制限状態）
-- - Indexes:
--   - idx_qa_violations_user（ユーザー履歴用）
--   - idx_qa_violations_appliance（製品別分析用）
--   - idx_qa_violations_type（違反タイプ別集計用）
--   - idx_qa_restrictions_user（制限確認用）
--   - idx_qa_restrictions_active（制限中ユーザー一覧用）
-- - RLS Policies:
--   - qa_violations: SELECT（自分の記録のみ閲覧可）
--   - qa_restrictions: SELECT（自分の制限状態のみ閲覧可）
-- - Triggers:
--   - update_qa_restrictions_updated_at（updated_at自動更新）
--
-- 制限時間設定（バックエンド実装側で制御）:
-- - 1回目: 拒否のみ（制限なし）
-- - 2回目: 1時間
-- - 3回目: 24時間
-- - 4回目以降: 7日間
-- ============================================================================
