-- PDFページ番号と印刷ページ番号カラムを追加
-- pdf_page_number: PDFビューアで表示される1始まりのページ番号
-- printed_page_number: 説明書に印刷されているページ番号（例: "26ページ"）

ALTER TABLE shared_maintenance_items
ADD COLUMN pdf_page_number INTEGER,
ADD COLUMN printed_page_number TEXT;

-- 既存データは printed_page_number に移行（source_page の値をコピー）
UPDATE shared_maintenance_items
SET printed_page_number = source_page
WHERE source_page IS NOT NULL;

-- コメント追加
COMMENT ON COLUMN shared_maintenance_items.pdf_page_number IS 'PDFビューアで表示されるページ番号（1始まり）';
COMMENT ON COLUMN shared_maintenance_items.printed_page_number IS '説明書に印刷されているページ番号';
