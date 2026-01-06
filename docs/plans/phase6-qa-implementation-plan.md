# Phase 6: QAマークダウン方式 質問応答機能 実装計画

## 概要

RAGの代わりに、製品ごとにQAマークダウンファイルを作成してLLMに読み取らせるアプローチを採用。

**メリット**:
- 誤った製品の内容を回答する可能性が0
- ベクトルDBの費用が0
- 製品ごとのデータ分離で精度低下リスクなし

**前提条件**: Phase 5（PWA/通知）完了後に着手

---

## 確定した設計方針

| 項目 | 決定事項 |
|-----|---------|
| 保存形式 | Markdownファイル（Supabase Storage） |
| 生成タイミング | 説明書確認時に自動生成 + バッチ処理 |
| PDF参照方式 | ハイブリッド（QA → テキストキャッシュ → PDF） |
| マイグレーション | Phase 6実装時に既存PDFを一括移行 |

---

## 1. 新ストレージ構造

```
manuals/
└── mfr_[ハッシュ]/           # メーカー名のハッシュ
    └── [型番]/               # 型番（フォルダ）
        ├── manual.pdf        # 説明書PDF
        ├── qa.md             # QAマークダウン
        └── text_cache.md     # テキストキャッシュ
```

**変更点**: 現在の `mfr_xxx/model.pdf` → `mfr_xxx/model/manual.pdf`

---

## 2. QAマークダウンフォーマット

```markdown
---
appliance_id: {uuid}
manufacturer: {maker}
model_number: {model}
generated_at: {ISO timestamp}
last_updated_at: {ISO timestamp}
---

# {maker} {model} よくある質問

## 操作・設定
### Q: [質問]
**A**: [回答]
**参照**: P.{page}

## お手入れ・メンテナンス
...

## トラブルシューティング
...

## ユーザー追加QA
### Q: [ユーザー質問] (追加: {date})
**A**: [AI回答]
**ソース**: {text_cache | pdf}
```

---

## 3. 質問応答フロー

```
質問 → QAマークダウン検索 → 解決？
                            ├─ Yes → 完了
                            └─ No → テキストキャッシュ参照 → 解決？
                                                            ├─ Yes → QAに追記 → 完了
                                                            └─ No → PDF読み込み → 回答
                                                                     └─ 解決後QAに追記
```

---

## 4. 実装ステップ

### Step 1: ストレージ移行準備 (0.5日)

**修正ファイル**:
- `backend/app/services/pdf_storage.py`

**作成ファイル**:
- `scripts/migrate_pdf_storage.py`

**タスク**:
- 新パス生成関数の追加
- `get_folder_path()`, `get_qa_path()`, `get_text_cache_path()`
- マイグレーションスクリプト作成

---

### Step 2: テキストキャッシュサービス (1日)

**作成ファイル**:
- `backend/app/services/text_cache_service.py`

**関数**:
```python
async def extract_text_from_pdf(pdf_bytes: bytes) -> str
async def get_or_create_text_cache(storage_folder: str, pdf_bytes: bytes) -> str
async def save_text_cache(storage_folder: str, text: str) -> str
async def get_text_cache(storage_folder: str) -> str | None
```

---

### Step 3: QA生成サービス (1.5日)

**作成ファイル**:
- `backend/app/services/qa_service.py`
- `backend/app/schemas/qa.py`

**関数**:
```python
async def generate_qa_markdown(pdf_bytes, manufacturer, model_number, category, shared_appliance_id) -> str
async def get_qa_markdown(storage_folder: str) -> str | None
async def save_qa_markdown(storage_folder: str, content: str) -> str
async def append_qa_to_markdown(storage_folder: str, question: str, answer: str, source: str) -> str
async def parse_qa_markdown(content: str) -> dict
```

---

### Step 4: QAチャットサービス (1.5日)

**作成ファイル**:
- `backend/app/services/qa_chat_service.py`

**関数**:
```python
async def answer_question(question, storage_folder, manufacturer, model_number, category) -> dict
async def search_qa_markdown(qa_content: str, question: str) -> dict | None
async def ask_text_cache(text_cache: str, question: str) -> dict | None
async def ask_pdf_directly(pdf_bytes: bytes, question: str) -> dict
```

---

### Step 5: バックエンドAPI (1日)

**作成ファイル**:
- `backend/app/api/routes/qa.py`

**修正ファイル**:
- `backend/app/main.py` (ルーター追加)
- `backend/app/api/routes/manuals.py` (QA生成トリガー追加)

**エンドポイント**:
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/qa/generate/{shared_appliance_id}` | QA生成 |
| GET | `/qa/{shared_appliance_id}` | QA取得 |
| POST | `/qa/{shared_appliance_id}/ask` | 質問送信 |
| POST | `/qa/{shared_appliance_id}/feedback` | フィードバック送信 |
| POST | `/qa/batch-generate` | バッチ生成 |

---

### Step 6: ストレージ移行実行 (0.5日)

**タスク**:
- 本番環境でマイグレーション実行
- `shared_appliances.stored_pdf_path` 更新
- 動作確認

---

### Step 7: フロントエンドコンポーネント (2日)

**作成ファイル**:
- `frontend/src/components/qa/QAChat.tsx` - チャットUI
- `frontend/src/components/qa/QAChatMessage.tsx` - メッセージ表示
- `frontend/src/components/qa/QAFeedbackButtons.tsx` - フィードバックUI
- `frontend/src/components/qa/QASection.tsx` - セクションラッパー
- `frontend/src/types/qa.ts` - 型定義

**修正ファイル**:
- `frontend/src/app/appliances/[id]/page.tsx` (QAセクション追加)

---

### Step 8: フロントエンドBFF (0.5日)

**作成ファイル**:
- `frontend/src/app/api/qa/[sharedApplianceId]/route.ts`
- `frontend/src/app/api/qa/[sharedApplianceId]/ask/route.ts`
- `frontend/src/app/api/qa/[sharedApplianceId]/feedback/route.ts`

---

### Step 9: バッチ処理スクリプト (0.5日)

**作成ファイル**:
- `scripts/batch_generate_qa.py`

**機能**:
- 既存PDFに対するQA一括生成
- レート制限
- 進捗レポート

---

### Step 10: テスト・調整 (1日)

**タスク**:
- Playwright E2Eテスト
- プロンプト調整
- UIポリッシュ

---

## 5. 工数見積もり

| ステップ | 工数 |
|---------|------|
| Step 1: ストレージ移行準備 | 0.5日 |
| Step 2: テキストキャッシュサービス | 1日 |
| Step 3: QA生成サービス | 1.5日 |
| Step 4: QAチャットサービス | 1.5日 |
| Step 5: バックエンドAPI | 1日 |
| Step 6: ストレージ移行実行 | 0.5日 |
| Step 7: フロントエンドコンポーネント | 2日 |
| Step 8: BFFルート | 0.5日 |
| Step 9: バッチ処理 | 0.5日 |
| Step 10: テスト・調整 | 1日 |
| **合計** | **約10日** |

---

## 6. 主要ファイル一覧

### バックエンド（新規）
- `backend/app/services/text_cache_service.py`
- `backend/app/services/qa_service.py`
- `backend/app/services/qa_chat_service.py`
- `backend/app/api/routes/qa.py`
- `backend/app/schemas/qa.py`

### バックエンド（修正）
- `backend/app/services/pdf_storage.py`
- `backend/app/api/routes/manuals.py`
- `backend/app/main.py`

### フロントエンド（新規）
- `frontend/src/components/qa/QAChat.tsx`
- `frontend/src/components/qa/QAChatMessage.tsx`
- `frontend/src/components/qa/QAFeedbackButtons.tsx`
- `frontend/src/components/qa/QASection.tsx`
- `frontend/src/types/qa.ts`
- `frontend/src/app/api/qa/[sharedApplianceId]/route.ts`
- `frontend/src/app/api/qa/[sharedApplianceId]/ask/route.ts`
- `frontend/src/app/api/qa/[sharedApplianceId]/feedback/route.ts`

### フロントエンド（修正）
- `frontend/src/app/appliances/[id]/page.tsx`

### スクリプト（新規）
- `scripts/migrate_pdf_storage.py`
- `scripts/batch_generate_qa.py`

---

## 7. リスクと対策

| リスク | 対策 |
|-------|------|
| 大容量PDF処理時間 | 非同期生成、進捗表示 |
| バッチ処理のLLMコスト | レート制限、優先度付け |
| マイグレーション失敗 | 旧パス保持、ロールバック機能 |
| QA品質の問題 | プロンプト調整、ユーザーフィードバック |
| チャット応答遅延 | タイピングインジケーター、キャッシュ最適化 |

---

## 8. 依存関係

### 必要なライブラリ（追加予定）
- なし（既存のgoogle-genai、Supabaseクライアントで実装可能）

### 外部サービス
- Gemini API（QA生成、質問応答）
- Supabase Storage（ファイル保存）

---

## 変更履歴

| 日付 | 内容 |
|-----|------|
| 2026-01-04 | 初版作成。RAG代替としてQAマークダウン方式を採用決定 |
