-- qa_session_messages に source と reference カラムを追加
-- 回答のソース（qa, text_cache, pdf, none）と参照ページを保持

ALTER TABLE qa_session_messages
ADD COLUMN source TEXT,
ADD COLUMN reference TEXT;
