-- Add is_pdf_encrypted flag to shared_appliances table
-- TRUE = PDFは暗号化されていてreact-pdfで表示不可（ブラウザで開く）
-- FALSE/NULL = react-pdfで表示可能

ALTER TABLE shared_appliances
ADD COLUMN IF NOT EXISTS is_pdf_encrypted BOOLEAN DEFAULT FALSE;

-- コメント追加
COMMENT ON COLUMN shared_appliances.is_pdf_encrypted IS
  'TRUE if PDF is encrypted and cannot be displayed in react-pdf viewer';

-- インデックス追加（暗号化PDFの検索用）
CREATE INDEX IF NOT EXISTS idx_shared_appliances_is_pdf_encrypted
ON shared_appliances (is_pdf_encrypted)
WHERE is_pdf_encrypted = TRUE;
