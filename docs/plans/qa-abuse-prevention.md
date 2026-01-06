# QA機能 不正利用防止機能 設計書

## 概要

QA機能（製品説明書に関する質問応答）に対して、以下の不正利用防止機能を実装する：

1. **質問バリデーション**: 製品に関係ない質問を検出して拒否
2. **違反記録管理**: 不適切な質問をデータベースに記録
3. **利用制限**: 繰り返し違反したユーザーへのQA機能制限
4. **認証必須化**: ログインユーザーのみQA機能を利用可能に

## 設計判断

| 項目 | 決定 |
|------|------|
| 初回違反時の対応 | **拒否**（回答せず、警告メッセージを表示） |
| 制限の厳しさ | **緩め**: 1回目=警告+拒否, 2回目=1時間, 3回目=24時間, 4回目以降=7日間 |
| 認証要件 | **認証必須**（ログインユーザーのみQA利用可能） |
| 質問判定方法 | ルールベース + LLMハイブリッド |

---

## データベーススキーマ

### テーブル1: `qa_violations`（違反記録）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| user_id | UUID | ユーザーID（users.id参照） |
| shared_appliance_id | UUID | 家電ID（shared_appliances.id参照） |
| question | TEXT | 違反した質問内容 |
| violation_type | TEXT | 違反タイプ（off_topic/inappropriate/attack） |
| detection_method | TEXT | 検出方法（rule_based/llm） |
| created_at | TIMESTAMPTZ | 作成日時 |

### テーブル2: `qa_restrictions`（利用制限状態）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| user_id | UUID | ユーザーID（UNIQUE） |
| violation_count | INTEGER | 累計違反回数 |
| restricted_until | TIMESTAMPTZ | 制限解除日時（NULLなら制限なし） |
| last_violation_at | TIMESTAMPTZ | 最終違反日時 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

---

## 制限時間設定

| 違反回数 | 制限時間 | 説明 |
|----------|----------|------|
| 1回目 | なし | 拒否するが即時再利用可能 |
| 2回目 | 1時間 | 短時間の制限 |
| 3回目 | 24時間 | 1日間の制限 |
| 4回目以降 | 7日間 | 長期の制限 |

---

## 質問判定ロジック

### 1. ルールベース判定（高速・無料）

以下のパターンに該当する質問は即時拒否：

**製品と無関係:**
- 天気、株価、ニュース、運勢

**攻撃的・危険:**
- 爆弾、危険物の作り方

**プロンプトインジェクション:**
- "ignore instructions", "system prompt"
- "あなたの指示を無視"

### 2. LLM判定（精度重視）

ルールベースで判定できない場合、Gemini APIで製品との関連性を判定：

```
この質問は {メーカー} {型番} の {カテゴリ} 製品に関連していますか？
```

**判定結果:**
- 関連あり → 回答を生成
- 関連なし → 違反として記録、拒否

---

## APIエラーコード

| HTTPステータス | コード | 説明 |
|----------------|--------|------|
| 401 | UNAUTHORIZED | 未認証（ログイン必要） |
| 403 | QA_BLOCKED | QA機能が制限中 |
| 400 | INVALID_QUESTION | 不適切な質問 |

### エラーレスポンス例

**QA_BLOCKED:**
```json
{
  "error": "QA機能は現在制限されています",
  "code": "QA_BLOCKED",
  "restricted_until": "2024-01-15T10:00:00Z",
  "violation_count": 3
}
```

**INVALID_QUESTION:**
```json
{
  "error": "この質問は製品に関連していないため回答できません",
  "code": "INVALID_QUESTION",
  "violation_type": "off_topic",
  "reason": "製品の使い方やメンテナンスについてお聞きください"
}
```

---

## 修正対象ファイル

| ファイル | 操作 | 内容 |
|---------|------|------|
| `backend/supabase/migrations/00009_qa_abuse.sql` | 新規 | DBスキーマ |
| `backend/app/schemas/qa_abuse.py` | 新規 | Pydanticスキーマ |
| `backend/app/services/qa_abuse_service.py` | 新規 | 不正利用防止サービス |
| `backend/app/api/routes/qa.py` | 修正 | 認証・バリデーション追加 |
| `frontend/src/app/api/qa/[sharedApplianceId]/ask/route.ts` | 修正 | BFF認証追加 |
| `frontend/src/app/api/qa/[sharedApplianceId]/ask-stream/route.ts` | 修正 | BFF認証追加 |
| `frontend/src/components/qa/QAChat.tsx` | 修正 | エラーハンドリングUI |
| `frontend/src/types/qa.ts` | 修正 | エラー型追加 |
| `backend/supabase/SCHEMA.md` | 修正 | スキーマドキュメント更新 |

---

## 注意事項

- LLM判定でパース失敗時は**許可**（誤ブロック防止）
- 初回違反でも回答は**返さない**
- 既存のQA機能に認証が追加されるため、未ログインユーザーはQAを使えなくなる
