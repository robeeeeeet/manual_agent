# QA会話履歴対応

## ブランチ名
`feature/qa-history`

## 背景
現在のQA機能は会話履歴を考慮しておらず、文脈依存の質問に対応できない。
例: 「それについてもう少し詳しく教えて」→ 何の話か分からない

## タスク

### 1. バックエンド: Geminiチャットセッション活用
- `backend/app/services/qa_chat_service.py` を修正
- Gemini APIの `ChatSession` 機能を使用
  ```python
  from google.generativeai import GenerativeModel

  model = GenerativeModel('gemini-pro')
  chat = model.start_chat(history=[])
  response = chat.send_message("質問")
  # chat.history に会話履歴が蓄積される
  ```

### 2. セッション管理
- ユーザー×家電ごとにセッションを管理
- Redisまたはインメモリキャッシュでセッション保持
- セッションタイムアウト（例: 30分）

### 3. API設計
- 既存: `POST /api/v1/qa/ask`
- 追加パラメータ: `session_id` (optional)
- レスポンスに `session_id` を含める

### 4. フロントエンド
- セッションIDをstateで保持
- 会話履歴の表示（既存のQAChatコンポーネントを拡張）
- 「新しい会話を始める」ボタン

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

## 確認事項
- 「それについて詳しく」などの文脈依存質問が正しく処理されるか
- セッションタイムアウト後に新しいセッションが開始されるか
