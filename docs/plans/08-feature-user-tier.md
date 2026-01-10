# ユーザーランク＆制限機能

## ブランチ名
`feature/user-tier`

## 背景
ユーザーをランク分けし、登録できる家電数や1日の検索・QA回数に制限をかけたい。

## タスク

### 1. DB設計

#### 新規テーブル: `user_tiers`
```sql
CREATE TABLE user_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- 'free', 'basic', 'premium'
  display_name TEXT NOT NULL, -- '無料', 'ベーシック', 'プレミアム'
  max_appliances INT NOT NULL DEFAULT 3,
  max_manual_searches_per_day INT NOT NULL DEFAULT 5,
  max_qa_questions_per_day INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期データ
INSERT INTO user_tiers (name, display_name, max_appliances, max_manual_searches_per_day, max_qa_questions_per_day) VALUES
('free', '無料プラン', 3, 5, 10),
('basic', 'ベーシック', 10, 20, 50),
('premium', 'プレミアム', -1, -1, -1); -- -1 = 無制限
```

#### `users` テーブルに追加
```sql
ALTER TABLE users ADD COLUMN tier_id UUID REFERENCES user_tiers(id);
-- デフォルトはfreeプラン
```

#### 使用量追跡: `user_daily_usage`
```sql
CREATE TABLE user_daily_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  manual_searches INT DEFAULT 0,
  qa_questions INT DEFAULT 0,
  UNIQUE(user_id, date)
);
```

### 2. バックエンド実装

#### 制限チェックサービス
- `backend/app/services/tier_service.py`
```python
async def check_can_add_appliance(user_id: str) -> bool:
    """家電登録可能か確認"""

async def check_can_search_manual(user_id: str) -> bool:
    """説明書検索可能か確認、使用量+1"""

async def check_can_ask_qa(user_id: str) -> bool:
    """QA質問可能か確認、使用量+1"""
```

#### APIに制限チェック追加
- 家電登録API: 登録前にチェック
- 説明書検索API: 検索前にチェック
- QA API: 質問前にチェック

#### エラーレスポンス
```json
{
  "error": "TIER_LIMIT_EXCEEDED",
  "message": "本日の説明書検索回数が上限に達しました",
  "current_usage": 5,
  "limit": 5,
  "tier": "free"
}
```

### 3. フロントエンド実装

#### 制限エラーハンドリング
- 制限超過時にモーダルまたはトースト表示
- 「プランをアップグレード」への誘導（将来の課金機能用）

#### マイページに使用量表示
- 今日の使用量 / 上限
- 現在のプラン表示

## 関連ファイル
- `backend/supabase/migrations/` (新規マイグレーション)
- `backend/app/services/tier_service.py` (新規作成)
- `backend/app/api/routes/appliances.py`
- `backend/app/api/routes/qa.py`
- `frontend/src/app/mypage/page.tsx`
- `frontend/src/types/user.ts`

## 確認事項
- 無料プランで制限に達した時のエラー表示
- 使用量カウントが正しく増加するか
- 日付が変わるとリセットされるか
