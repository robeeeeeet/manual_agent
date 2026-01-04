-- ============================================================================
-- 共有PDFマニュアル用 Storage RLSポリシー
-- ============================================================================
-- 作成日: 2026-01-03
-- 概要: manuals バケットを共有アクセスに変更（同じメーカー・型番のPDFを再利用）
-- ============================================================================

-- ============================================================================
-- 既存のストレージポリシーを削除（存在する場合）
-- ============================================================================
-- 注意: これらのポリシーがまだ作成されていない場合はエラーになりますが、
-- IF EXISTSで安全に処理されます

DROP POLICY IF EXISTS "Users can view own manuals" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own manuals" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own manuals" ON storage.objects;

-- ============================================================================
-- 共有PDFアクセス用の新しいポリシー
-- ============================================================================
-- 設計方針:
-- - 同じメーカー・型番のPDFは全ユーザーで共有
-- - パス形式: {manufacturer}/{model_number}.pdf
-- - 認証済みユーザーのみアクセス可能

-- SELECT: 認証済みユーザーは全てのマニュアルを閲覧可能
CREATE POLICY "Authenticated users can view manuals"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'manuals'
  AND auth.role() = 'authenticated'
);

-- INSERT: 認証済みユーザーはマニュアルをアップロード可能
CREATE POLICY "Authenticated users can upload manuals"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'manuals'
  AND auth.role() = 'authenticated'
);

-- UPDATE: 認証済みユーザーはマニュアルを更新可能（再アップロード用）
CREATE POLICY "Authenticated users can update manuals"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'manuals'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'manuals'
  AND auth.role() = 'authenticated'
);

-- ============================================================================
-- 完了
-- ============================================================================
-- このマイグレーションで変更されたもの:
-- - 削除: ユーザー単位のRLSポリシー（Users can view/upload/delete own manuals）
-- - 追加: 共有アクセス用RLSポリシー（Authenticated users can view/upload/update manuals）
--
-- 注意: DELETE権限は付与していません（一度保存したPDFは他ユーザーも使用する可能性があるため）
-- ============================================================================
