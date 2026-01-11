# ユーザーランク＆制限機能 実装計画

## ブランチ名
`feature/user-tier`

## 概要
ユーザーをランク分け（free/basic/premium）し、登録家電数・1日の検索回数・QA回数に制限を設ける。

### 制限対象
| 制限種別 | 対象 | 判定基準 |
|----------|------|----------|
| 個人家電数 | user_appliances (group_id IS NULL) | ユーザー自身のtier |
| グループ家電数 | user_appliances (group_id IS NOT NULL) | **グループオーナー**のtier |
| 説明書検索回数 | /day | ユーザー自身のtier |
| QA質問回数 | /day | ユーザー自身のtier |

## 設計方針

| 項目 | 決定 | 理由 |
|------|------|------|
| 制限チェック | Dict-based returns | QA abuse serviceと同じパターン、エラー情報を柔軟に返せる |
| 説明書検索制限 | BFF層で事前チェック | バックエンドに新エンドポイント追加して呼び出し |
| カウント増加 | Atomic check-and-increment | 競合防止のため1回のDB操作で実行 |
| アップグレードCTA | 表示のみ | 「サポートにお問い合わせ」メッセージ（課金機能は将来対応） |

---

## 実装ステップ

### Step 1: DBマイグレーション

#### 00019_create_user_tiers.sql
- `user_tiers` テーブル作成
- 初期データ: free（3/5/10）, basic（10/20/50）, premium（無制限: -1）

#### 00020_add_tier_to_users.sql
- `users.tier_id` カラム追加（FK → user_tiers）
- 新規ユーザーのデフォルト: freeプラン
- **既存ユーザー: basicプランに設定**（早期利用者優遇）

#### 00021_create_user_daily_usage.sql
- `user_daily_usage` テーブル作成（user_id, date, manual_searches, qa_questions）
- RLSポリシー設定

### Step 2: バックエンド実装

#### 新規ファイル
| ファイル | 内容 |
|----------|------|
| `backend/app/schemas/tier.py` | Pydanticスキーマ（UserTier, TierCheckResult, TierLimitExceededError等） |
| `backend/app/services/tier_service.py` | 制限チェック・使用量管理サービス |
| `backend/app/api/routes/tiers.py` | /api/v1/tiers/* エンドポイント |

#### tier_service.py 主要関数
```python
async def get_user_tier(user_id: str) -> dict | None
async def get_or_create_daily_usage(user_id: str) -> dict
async def check_can_add_appliance(user_id: str) -> dict  # 個人家電用
async def check_can_add_group_appliance(group_id: str) -> dict  # グループ家電用（オーナーのtierで判定）
async def check_and_increment_manual_search(user_id: str) -> dict
async def check_and_increment_qa_question(user_id: str) -> dict
async def get_user_usage_stats(user_id: str) -> dict  # マイページ表示用
```

#### グループ家電チェックの流れ
1. `group_id` からグループ情報取得
2. `groups.owner_id` からオーナーのtier取得
3. グループ内の家電数をカウント
4. オーナーのtier制限と比較

#### 既存ファイル修正
| ファイル | 変更内容 |
|----------|----------|
| `backend/app/api/routes/appliances.py` | `register_appliance` に家電数チェック追加（個人 or グループで分岐） |
| `backend/app/api/routes/qa.py` | `ask_question_stream` にQA回数チェック追加 |
| `backend/app/main.py` | tiersルーター登録 |

#### 新規APIエンドポイント
| エンドポイント | メソッド | 用途 |
|----------------|----------|------|
| `/api/v1/tiers/check-manual-search` | POST | 検索可否チェック＆カウント増加 |
| `/api/v1/tiers/usage` | GET | 使用状況取得（マイページ用） |

### Step 3: フロントエンド実装

#### 新規ファイル
| ファイル | 内容 |
|----------|------|
| `frontend/src/app/api/user/usage/route.ts` | BFF: 使用状況取得 |
| `frontend/src/components/tier/UsageBar.tsx` | 使用量プログレスバー |
| `frontend/src/components/tier/TierLimitModal.tsx` | 制限超過モーダル |

#### 既存ファイル修正
| ファイル | 変更内容 |
|----------|----------|
| `frontend/src/types/user.ts` | UserTier, DailyUsage, TierLimitError 型追加 |
| `frontend/src/app/api/appliances/search-manual-stream/route.ts` | 検索前に制限チェックAPI呼び出し |
| `frontend/src/app/mypage/page.tsx` | プラン＆利用状況セクション追加 |
| `frontend/src/app/register/page.tsx` | TIER_LIMIT_EXCEEDED エラーハンドリング |
| `frontend/src/components/qa/QAChat.tsx` | TIER_LIMIT_EXCEEDED エラーハンドリング |

### Step 4: エラーレスポンス形式

```json
{
  "error": "TIER_LIMIT_EXCEEDED",
  "message": "本日の説明書検索回数が上限に達しました",
  "current_usage": 5,
  "limit": 5,
  "tier": "free",
  "tier_display_name": "無料プラン"
}
```

---

## 重要な実装ポイント

### 1. 家電登録時の制限チェック（個人 or グループで分岐）
```python
# appliances.py の register_appliance 内
if appliance.group_id:
    # グループ家電 → オーナーのtierで判定
    tier_check = await check_can_add_group_appliance(str(appliance.group_id))
else:
    # 個人家電 → ユーザー自身のtierで判定
    tier_check = await check_can_add_appliance(str(user_id))

if not tier_check["allowed"]:
    return JSONResponse(status_code=403, content=...)
```

### 2. グループ家電数チェック（オーナーのtier参照）
```python
async def check_can_add_group_appliance(group_id: str) -> dict:
    # 1. グループのオーナーID取得
    group = supabase.table("groups").select("owner_id").eq("id", group_id).single().execute()
    owner_id = group.data["owner_id"]

    # 2. オーナーのtier取得
    tier = await get_user_tier(owner_id)

    # 3. グループ内の家電数カウント
    count = supabase.table("user_appliances").select("id", count="exact").eq("group_id", group_id).execute()

    # 4. 制限チェック
    limit = tier.get("max_appliances", 3)
    return {"allowed": limit == -1 or count.count < limit, ...}
```

### 3. Atomic upsert for daily usage
```python
supabase.table("user_daily_usage").upsert(
    {"user_id": user_id, "date": str(today)},
    on_conflict="user_id,date"
).execute()
```

### 4. 無制限判定
```python
if limit == -1:
    return {"allowed": True, ...}  # Premiumは常に許可
```

---

## 検証方法

### バックエンド
```bash
# マイグレーション確認
SELECT * FROM user_tiers;
SELECT id, email, tier_id FROM users;

# API テスト
curl -X POST http://localhost:8000/api/v1/tiers/check-manual-search \
  -H "X-User-ID: <user-id>"

curl http://localhost:8000/api/v1/tiers/usage \
  -H "X-User-ID: <user-id>"
```

### フロントエンド（Playwright MCP）
1. freeプランユーザーで4台目の個人家電登録 → エラーモーダル表示
2. freeプランオーナーのグループで4台目のグループ家電登録 → エラーモーダル表示
3. basicプランオーナーのグループで11台目のグループ家電登録 → エラーモーダル表示
4. 6回目の説明書検索 → エラーモーダル表示
5. 11回目のQA質問 → エラーモーダル表示
6. マイページで使用量バーが正しく表示されること
7. 日付変更後にカウントがリセットされること

---

## ファイル一覧

### 新規作成
- `backend/supabase/migrations/00019_create_user_tiers.sql`
- `backend/supabase/migrations/00020_add_tier_to_users.sql`
- `backend/supabase/migrations/00021_create_user_daily_usage.sql`
- `backend/app/schemas/tier.py`
- `backend/app/services/tier_service.py`
- `backend/app/api/routes/tiers.py`
- `frontend/src/app/api/user/usage/route.ts`
- `frontend/src/components/tier/UsageBar.tsx`
- `frontend/src/components/tier/TierLimitModal.tsx`

### 修正
- `backend/app/main.py` (ルーター登録)
- `backend/app/api/routes/appliances.py` (制限チェック追加)
- `backend/app/api/routes/qa.py` (制限チェック追加)
- `frontend/src/types/user.ts` (型定義追加)
- `frontend/src/app/mypage/page.tsx` (使用状況表示追加)
- `frontend/src/app/api/appliances/search-manual-stream/route.ts` (制限チェック追加)
- `frontend/src/app/register/page.tsx` (エラーハンドリング)
- `frontend/src/components/qa/QAChat.tsx` (エラーハンドリング)
