-- ============================================================================
-- メーカー名→ドメイン 学習型マッピングテーブル
-- ============================================================================
-- 作成日: 2026-01-03
-- 概要: PDF取得成功時にURLからドメインを学習し、次回以降の検索精度を向上
-- ============================================================================

-- ============================================================================
-- Manufacturer Domains Table
-- ============================================================================
-- メーカー名と公式ドメインのマッピング（学習型）
CREATE TABLE manufacturer_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_normalized TEXT NOT NULL,  -- 正規化されたメーカー名（検索用）
    manufacturer_original TEXT NOT NULL,    -- 元のメーカー名（表示用）
    domain TEXT NOT NULL,                   -- ドメイン（例: panasonic.jp）
    success_count INTEGER NOT NULL DEFAULT 1,  -- 成功回数（信頼度）
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(manufacturer_normalized, domain)  -- 同一メーカー+ドメインの重複防止
);

COMMENT ON TABLE manufacturer_domains IS 'メーカー名と公式ドメインの学習マッピング';
COMMENT ON COLUMN manufacturer_domains.manufacturer_normalized IS '正規化されたメーカー名（小文字、空白除去）';
COMMENT ON COLUMN manufacturer_domains.manufacturer_original IS '元のメーカー名（表示用）';
COMMENT ON COLUMN manufacturer_domains.domain IS 'PDFが見つかったドメイン';
COMMENT ON COLUMN manufacturer_domains.success_count IS 'このドメインでPDFが見つかった回数（信頼度）';

-- インデックス
CREATE INDEX idx_manufacturer_domains_normalized ON manufacturer_domains(manufacturer_normalized);

-- ============================================================================
-- Triggers
-- ============================================================================

-- updated_at 自動更新トリガー（update_updated_at_column関数は00001で作成済み）
CREATE TRIGGER update_manufacturer_domains_updated_at
    BEFORE UPDATE ON manufacturer_domains
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- RLS を有効化
ALTER TABLE manufacturer_domains ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが読み取り可能（categoriesテーブルと同様のパターン）
CREATE POLICY "Anyone can view manufacturer_domains"
    ON manufacturer_domains
    FOR SELECT
    TO authenticated
    USING (true);

-- 注意: INSERT/UPDATE/DELETEはバックエンドからsecret_keyで直接実行
-- （RLSをバイパス）するため、ポリシー不要

-- ============================================================================
-- 完了
-- ============================================================================
-- このマイグレーションで作成されたもの:
-- - Table: manufacturer_domains
-- - Index: idx_manufacturer_domains_normalized
-- - Trigger: update_manufacturer_domains_updated_at
-- - RLS Policy: Anyone can view manufacturer_domains
-- ============================================================================
