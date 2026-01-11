# QA会話履歴対応 実装計画

## ブランチ名
`feature/qa-history`

## 概要
QA機能に会話履歴を導入し、以下を実現する：
1. 「それについてもう少し詳しく教えて」のような文脈依存の質問に対応
2. 過去の会話履歴一覧表示
3. 過去の会話から再開

## 設計方針

| 項目 | 決定 | 理由 |
|------|------|------|
| 履歴の扱い方 | プロンプト履歴埋め込み | 既存の3段階フォールバック検索と統合しやすい |
| セッション保存 | **Supabase永続化** | 6時間の履歴保持を確実に実現、過去履歴一覧機能にも対応 |
| タイムアウト | **6時間** | メンテ作業中の質問に対応 |
| セッションキー | `{user_id}:{shared_appliance_id}` | ユーザー×家電ごとに1アクティブセッション |

---

## データベース設計

### テーブル: `qa_sessions`

```sql
CREATE TABLE qa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_appliance_id UUID NOT NULL REFERENCES shared_appliances(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,  -- アクティブセッションフラグ
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ユーザー×家電ごとに1つのアクティブセッション
  UNIQUE(user_id, shared_appliance_id) WHERE is_active = true
);

-- RLS
ALTER TABLE qa_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sessions" ON qa_sessions
  FOR ALL USING (user_id = auth.uid());

-- インデックス
CREATE INDEX idx_qa_sessions_user_appliance ON qa_sessions(user_id, shared_appliance_id);
CREATE INDEX idx_qa_sessions_last_activity ON qa_sessions(last_activity_at);
```

### テーブル: `qa_session_messages`

```sql
CREATE TABLE qa_session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES qa_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE qa_session_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own session messages" ON qa_session_messages
  FOR ALL USING (
    session_id IN (SELECT id FROM qa_sessions WHERE user_id = auth.uid())
  );

-- インデックス
CREATE INDEX idx_qa_session_messages_session ON qa_session_messages(session_id, created_at);
```

### 期限切れセッション処理

```sql
-- 6時間以上アクティビティがないセッションを非アクティブ化
UPDATE qa_sessions
SET is_active = false
WHERE is_active = true AND last_activity_at < now() - INTERVAL '6 hours';
```

---

## API設計

### 新規エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/qa/{shared_appliance_id}/sessions` | 家電のセッション一覧取得 |
| GET | `/qa/sessions/{session_id}` | セッション詳細取得（メッセージ含む） |
| POST | `/qa/{shared_appliance_id}/sessions` | 新規セッション作成 |
| POST | `/qa/{shared_appliance_id}/reset-session` | アクティブセッションをリセット |

### 既存エンドポイントの変更

| メソッド | パス | 変更内容 |
|---------|------|---------|
| POST | `/qa/{shared_appliance_id}/ask-stream` | `session_id` パラメータ追加 |

---

## 実装タスク

### Phase 1: データベース準備

#### 1.1 マイグレーション作成
**ファイル**: `backend/supabase/migrations/00015_qa_sessions.sql`

- `qa_sessions` テーブル作成
- `qa_session_messages` テーブル作成
- RLSポリシー設定
- インデックス作成

---

### Phase 2: バックエンド実装

#### 2.1 スキーマ追加
**ファイル**: `backend/app/schemas/qa.py`

```python
class ChatHistoryMessage(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime

class QASessionSummary(BaseModel):
    """セッション一覧用のサマリー"""
    id: str
    shared_appliance_id: str
    is_active: bool
    message_count: int
    first_message: str | None  # 最初のユーザー質問（プレビュー用）
    created_at: datetime
    last_activity_at: datetime

class QASessionDetail(BaseModel):
    """セッション詳細（メッセージ含む）"""
    id: str
    user_id: str
    shared_appliance_id: str
    is_active: bool
    messages: list[ChatHistoryMessage]
    created_at: datetime
    last_activity_at: datetime

class QASessionListResponse(BaseModel):
    sessions: list[QASessionSummary]

# 既存スキーマの変更
class QAAskRequest(BaseModel):
    question: str
    session_id: str | None = None  # 指定時はそのセッションで継続

class QAStreamEvent(BaseModel):
    # ...既存フィールド
    session_id: str | None = None  # 新規追加

class QAResetSessionResponse(BaseModel):
    success: bool
    message: str
    new_session_id: str | None = None  # 新しいセッションID
```

#### 2.2 セッション管理サービス（新規）
**ファイル**: `backend/app/services/qa_session_service.py`

```python
# 主要関数
async def get_sessions_for_appliance(user_id: str, shared_appliance_id: str) -> list[QASessionSummary]
async def get_session_detail(session_id: str, user_id: str) -> QASessionDetail | None
async def get_or_create_active_session(user_id: str, shared_appliance_id: str) -> QASessionDetail
async def create_new_session(user_id: str, shared_appliance_id: str) -> QASessionDetail
async def add_message(session_id: str, role: str, content: str) -> None
async def get_session_messages(session_id: str, limit: int = 20) -> list[ChatHistoryMessage]
def format_history_for_prompt(messages: list[ChatHistoryMessage]) -> str
async def reset_active_session(user_id: str, shared_appliance_id: str) -> str | None  # 新セッションID返す
async def deactivate_expired_sessions() -> int  # 6時間超過セッション非アクティブ化
async def resume_session(session_id: str, user_id: str) -> QASessionDetail | None  # セッション再開
```

#### 2.3 QAチャットサービス変更
**ファイル**: `backend/app/services/qa_chat_service.py`

変更点:
- `answer_question_stream()` に `user_id`, `shared_appliance_id`, `session_id` パラメータ追加
- セッション取得・作成
- 会話履歴をプロンプトに埋め込み
- 応答後にセッションを更新
- 最終イベントに `session_id` を含める

#### 2.4 APIルート更新
**ファイル**: `backend/app/api/routes/qa.py`

追加・変更:
- `GET /{shared_appliance_id}/sessions` - セッション一覧取得
- `GET /sessions/{session_id}` - セッション詳細取得
- `POST /{shared_appliance_id}/sessions` - 新規セッション作成
- `POST /{shared_appliance_id}/reset-session` - アクティブセッションリセット
- `POST /{shared_appliance_id}/ask-stream` - session_id対応

---

### Phase 3: フロントエンド実装

#### 3.1 型定義追加
**ファイル**: `frontend/src/types/qa.ts`

```typescript
interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface QASessionSummary {
  id: string;
  shared_appliance_id: string;
  is_active: boolean;
  message_count: number;
  first_message: string | null;
  created_at: string;
  last_activity_at: string;
}

interface QASessionDetail {
  id: string;
  user_id: string;
  shared_appliance_id: string;
  is_active: boolean;
  messages: ChatHistoryMessage[];
  created_at: string;
  last_activity_at: string;
}
```

#### 3.2 BFF層追加・更新

**新規ファイル**:
- `frontend/src/app/api/qa/[sharedApplianceId]/sessions/route.ts` - 一覧取得・新規作成
- `frontend/src/app/api/qa/sessions/[sessionId]/route.ts` - 詳細取得
- `frontend/src/app/api/qa/[sharedApplianceId]/reset-session/route.ts` - リセット

**更新ファイル**:
- `frontend/src/app/api/qa/[sharedApplianceId]/ask-stream/route.ts` - session_id転送

#### 3.3 会話履歴一覧コンポーネント（新規）
**ファイル**: `frontend/src/components/qa/QASessionHistory.tsx`

```typescript
interface QASessionHistoryProps {
  sharedApplianceId: string;
  onSelectSession: (sessionId: string) => void;
  onNewConversation: () => void;
}
```

- 過去の会話セッション一覧表示
- セッション選択で再開
- 「新しい会話を始める」ボタン

#### 3.4 QAChat コンポーネント更新
**ファイル**: `frontend/src/components/qa/QAChat.tsx`

変更点:
- `sessionId` state追加
- 質問送信時に `session_id` を含める
- 応答から `session_id` を取得して保存
- 過去セッションから再開時、メッセージを読み込み
- 「会話履歴」ボタンでQASessionHistoryを表示

#### 3.5 QASection コンポーネント更新
**ファイル**: `frontend/src/components/qa/QASection.tsx`

変更点:
- QASessionHistoryとQAChatの切り替え管理
- セッション選択時の処理

---

### Phase 4: テスト・確認

#### 4.1 動作確認項目
- [ ] 「それについて詳しく」などの文脈依存質問が正しく処理されるか
- [ ] 6時間後にセッションが非アクティブになるか
- [ ] 「新しい会話を始める」でセッションがリセットされるか
- [ ] 過去の会話一覧が表示されるか
- [ ] 過去の会話から再開できるか
- [ ] SSEストリーミングが正常に動作するか

#### 4.2 テスト方法
```bash
# マイグレーション適用
cd backend && supabase db push

# バックエンド起動
cd backend && uv run uvicorn app.main:app --reload

# フロントエンド起動
cd frontend && npm run dev

# ブラウザで /appliances/[id] にアクセスしてQAセクションをテスト
```

---

## 変更ファイル一覧

| ファイル | 変更種別 |
|---------|---------|
| `backend/supabase/migrations/00015_qa_sessions.sql` | 新規作成 |
| `backend/app/schemas/qa.py` | 修正 |
| `backend/app/services/qa_session_service.py` | 新規作成 |
| `backend/app/services/qa_chat_service.py` | 修正 |
| `backend/app/api/routes/qa.py` | 修正 |
| `frontend/src/types/qa.ts` | 修正 |
| `frontend/src/components/qa/QASessionHistory.tsx` | 新規作成 |
| `frontend/src/components/qa/QAChat.tsx` | 修正 |
| `frontend/src/components/qa/QASection.tsx` | 修正 |
| `frontend/src/app/api/qa/[sharedApplianceId]/sessions/route.ts` | 新規作成 |
| `frontend/src/app/api/qa/sessions/[sessionId]/route.ts` | 新規作成 |
| `frontend/src/app/api/qa/[sharedApplianceId]/reset-session/route.ts` | 新規作成 |
| `frontend/src/app/api/qa/[sharedApplianceId]/ask-stream/route.ts` | 修正 |

---

## UI設計イメージ

### QAセクションの状態遷移

```
[QASection]
    │
    ├─ 初回表示 → QAChat（新規セッション自動作成）
    │
    ├─ 「会話履歴」ボタン押下 → QASessionHistory
    │                              │
    │                              ├─ セッション選択 → QAChat（そのセッションで継続）
    │                              │
    │                              └─ 「新しい会話」押下 → QAChat（新規セッション）
    │
    └─ 「新しい会話を始める」ボタン押下 → セッションリセット → QAChat
```

### QASessionHistory コンポーネント

```
┌─────────────────────────────────────┐
│ 会話履歴                    [×閉じる] │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🟢 フィルター掃除の頻度は？      │ │  ← アクティブセッション
│ │    3件のメッセージ • 10分前     │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ⚪ 電気代を節約する方法は？      │ │  ← 過去セッション
│ │    5件のメッセージ • 昨日       │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ⚪ 冷房と除湿の違いは？          │ │
│ │    2件のメッセージ • 3日前      │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│        [＋ 新しい会話を始める]       │
└─────────────────────────────────────┘
```

---

## 会話履歴プロンプト例

```
【会話履歴】
ユーザー: エアコンのフィルター掃除の頻度は？
アシスタント: 2週間に1回程度の掃除をおすすめします。（P.15参照）

【現在の質問】
それについてもう少し詳しく教えて

【指示】
会話の文脈を考慮して回答してください。
「それ」「これ」などの指示語は、会話履歴から何を指しているか推測してください。
```

---

## 期限切れセッション処理

Cloud Schedulerで定期実行（既存の daily-reminder を参考）：

```python
# /api/v1/cron/cleanup-qa-sessions
@router.post("/cleanup-qa-sessions")
async def cleanup_qa_sessions():
    """6時間以上アクティビティがないセッションを非アクティブ化"""
    count = await deactivate_expired_sessions()
    return {"deactivated_count": count}
```

または、QA呼び出し時に確率的に実行：
```python
import random
if random.random() < 0.01:  # 1%の確率
    await deactivate_expired_sessions()
```

---

## 関連ファイル
- `backend/app/services/qa_service.py`
- `backend/app/services/qa_chat_service.py`
- `backend/app/api/routes/qa.py`
- `frontend/src/components/qa/QAChat.tsx`
- `frontend/src/components/qa/QASection.tsx`
- `frontend/src/app/api/qa/route.ts`

## 参考
- Gemini Chat API ドキュメント
- 既存QAサービス: `backend/app/services/qa_service.py`, `qa_chat_service.py`
