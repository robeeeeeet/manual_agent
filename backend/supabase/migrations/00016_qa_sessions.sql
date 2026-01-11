-- QA会話履歴機能用のテーブル
-- ユーザーが家電ごとに複数の会話セッションを持ち、過去の会話から再開できる

CREATE TABLE qa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_appliance_id UUID NOT NULL REFERENCES shared_appliances(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- アクティブセッションのみの部分一意インデックス（ユーザー×家電ごとに1つのアクティブセッション）
CREATE UNIQUE INDEX idx_qa_sessions_active_unique
ON qa_sessions(user_id, shared_appliance_id)
WHERE is_active = true;

CREATE TABLE qa_session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES qa_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE qa_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sessions" ON qa_sessions
  FOR ALL USING (user_id = auth.uid());

ALTER TABLE qa_session_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own session messages" ON qa_session_messages
  FOR ALL USING (
    session_id IN (SELECT id FROM qa_sessions WHERE user_id = auth.uid())
  );

-- インデックス
CREATE INDEX idx_qa_sessions_user_appliance ON qa_sessions(user_id, shared_appliance_id);
CREATE INDEX idx_qa_sessions_last_activity ON qa_sessions(last_activity_at);
CREATE INDEX idx_qa_session_messages_session ON qa_session_messages(session_id, created_at);
