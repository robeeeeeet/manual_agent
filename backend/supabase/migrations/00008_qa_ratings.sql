-- ============================================================================
-- Migration: 00008_qa_ratings.sql
-- Description: QA評価テーブル（qa_ratings）の作成
-- ============================================================================
--
-- 目的:
--   製品QAの質問に対するユーザー評価（helpful/not helpful）を記録する。
--   評価データは将来的にQA改善・優先度付けに活用される。
--
-- 設計:
--   - question_hash: 質問テキストのSHA256ハッシュ（先頭32文字）で識別
--   - 同一ユーザーが同じ質問に複数回評価可能（UNIQUE制約なし）
--   - RLS: 全ユーザーが評価閲覧可、自分の評価のみ作成・削除可
--
-- ============================================================================

-- ============================================================================
-- Step 1: qa_ratings テーブル作成
-- ============================================================================

CREATE TABLE qa_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_appliance_id UUID NOT NULL REFERENCES shared_appliances(id) ON DELETE CASCADE,
    question_hash TEXT NOT NULL,  -- 質問テキストのSHA256ハッシュ（先頭32文字）
    question_text TEXT NOT NULL,  -- デバッグ用に元テキスト保持
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE qa_ratings IS 'QA質問の評価テーブル（helpful/not helpful）';
COMMENT ON COLUMN qa_ratings.shared_appliance_id IS '評価対象のQAが属する製品ID';
COMMENT ON COLUMN qa_ratings.question_hash IS '質問テキストのSHA256ハッシュ（先頭32文字、集計用キー）';
COMMENT ON COLUMN qa_ratings.question_text IS '質問の元テキスト（デバッグ・分析用）';
COMMENT ON COLUMN qa_ratings.user_id IS '評価したユーザーID';
COMMENT ON COLUMN qa_ratings.is_helpful IS 'true: helpful, false: not helpful';
COMMENT ON COLUMN qa_ratings.created_at IS '評価日時';

-- ============================================================================
-- Step 2: インデックス作成
-- ============================================================================

-- 製品×質問ごとの評価集計用
CREATE INDEX idx_qa_ratings_appliance_question ON qa_ratings(shared_appliance_id, question_hash);

-- ユーザーの評価履歴取得用
CREATE INDEX idx_qa_ratings_user ON qa_ratings(user_id);

-- ユーザーが特定質問を評価済みか確認用
CREATE INDEX idx_qa_ratings_user_question ON qa_ratings(shared_appliance_id, question_hash, user_id);

-- ============================================================================
-- Step 3: Row Level Security (RLS) 設定
-- ============================================================================

ALTER TABLE qa_ratings ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザーが評価データを閲覧可能
CREATE POLICY "Anyone can view qa ratings"
    ON qa_ratings
    FOR SELECT
    TO authenticated
    USING (true);

-- ユーザーは自分の評価のみ作成可能
CREATE POLICY "Users can insert own ratings"
    ON qa_ratings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分の評価のみ削除可能
CREATE POLICY "Users can delete own ratings"
    ON qa_ratings
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ============================================================================
-- 完了
-- ============================================================================
-- このマイグレーションで作成されたもの:
-- - Table: qa_ratings
-- - Indexes:
--   - idx_qa_ratings_appliance_question (集計用)
--   - idx_qa_ratings_user (ユーザー履歴用)
--   - idx_qa_ratings_user_question (評価済み確認用)
-- - RLS Policies:
--   - SELECT: 全認証ユーザーが閲覧可
--   - INSERT: 自分の評価のみ作成可
--   - DELETE: 自分の評価のみ削除可
--
-- 使用例:
-- - QA回答表示時に helpful/not helpful カウントを集計
-- - ユーザーが既に評価済みかを確認して UI 制御
-- - 評価の多い質問を優先的に改善
-- ============================================================================
