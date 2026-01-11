-- qa_sessions に summary カラムを追加
-- 最初の質問をLLMで要約したセッションタイトルを保持

ALTER TABLE qa_sessions
ADD COLUMN summary TEXT;

-- 既存セッションにはNULLが入る（first_messageでフォールバック表示）
