-- 旧カラムを削除（データ移行完了後に実行）
-- 注意: このマイグレーションは pdf_page_number へのデータ移行が完了し、
-- フロントエンド・バックエンドが新カラムを使用するように更新された後に適用すること

ALTER TABLE shared_maintenance_items
DROP COLUMN source_page;
