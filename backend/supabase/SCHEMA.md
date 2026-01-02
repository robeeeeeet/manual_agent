# データベーススキーマ設計書

## 概要

このドキュメントは、説明書管理 & メンテナンスリマインドアプリのデータベーススキーマを視覚的に説明します。

## ER図（テキスト版）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           auth.users (Supabase Auth)                     │
│                                     ↓                                     │
│                              ┌──────────────┐                            │
│                              │    users     │                            │
│                              ├──────────────┤                            │
│                              │ id (PK)      │←─────┐                     │
│                              │ email        │      │                     │
│                              │ notify_time  │      │                     │
│                              │ timezone     │      │                     │
│                              └──────────────┘      │                     │
│                                     ↓              │                     │
│                              ┌──────────────┐      │                     │
│                              │  appliances  │      │                     │
│                              ├──────────────┤      │                     │
│                              │ id (PK)      │      │                     │
│                              │ user_id (FK) │──────┘                     │
│                              │ name         │                            │
│                              │ maker        │                            │
│                              │ model_number │                            │
│                              │ category     │                            │
│                              │ manual_source_url │                       │
│                              │ stored_pdf_path  │                        │
│                              │ image_url    │                            │
│                              └──────────────┘                            │
│                                     ↓                                     │
│                     ┌───────────────────────────────┐                    │
│                     │   maintenance_schedules       │                    │
│                     ├───────────────────────────────┤                    │
│                     │ id (PK)                       │                    │
│                     │ appliance_id (FK)             │                    │
│                     │ task_name                     │                    │
│                     │ description                   │                    │
│                     │ interval_type (days/months/   │                    │
│                     │                manual)        │                    │
│                     │ interval_value                │                    │
│                     │ last_done_at                  │                    │
│                     │ next_due_at                   │                    │
│                     │ source_page                   │                    │
│                     │ importance (high/medium/low)  │                    │
│                     └───────────────────────────────┘                    │
│                                     ↓                                     │
│                     ┌───────────────────────────────┐                    │
│                     │   maintenance_logs            │                    │
│                     ├───────────────────────────────┤                    │
│                     │ id (PK)                       │                    │
│                     │ schedule_id (FK)              │                    │
│                     │ done_at                       │                    │
│                     │ done_by_user_id (FK → users)  │                    │
│                     │ notes                         │                    │
│                     └───────────────────────────────┘                    │
│                                                                           │
│                     ┌───────────────────────────────┐                    │
│                     │   push_subscriptions          │                    │
│                     ├───────────────────────────────┤                    │
│                     │ id (PK)                       │                    │
│                     │ user_id (FK → users)          │                    │
│                     │ endpoint (UNIQUE)             │                    │
│                     │ p256dh_key                    │                    │
│                     │ auth_key                      │                    │
│                     └───────────────────────────────┘                    │
│                                                                           │
│                     ┌───────────────────────────────┐                    │
│                     │   categories (master)         │                    │
│                     ├───────────────────────────────┤                    │
│                     │ id (PK, SERIAL)               │                    │
│                     │ name (UNIQUE)                 │                    │
│                     │ display_order                 │                    │
│                     └───────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## テーブル詳細

### 1. users

ユーザーの設定情報を管理するテーブル。Supabase Auth の `auth.users` を参照します。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | - | ユーザーID（PK、auth.users参照） |
| `email` | TEXT | NOT NULL | - | メールアドレス |
| `notify_time` | TIME | NOT NULL | '09:00:00' | 通知時刻 |
| `timezone` | TEXT | NOT NULL | 'Asia/Tokyo' | タイムゾーン |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新日時 |

**インデックス**: なし（PKのみ）

**RLS**: 自分のレコードのみ参照・更新可能

### 2. appliances

家電・住宅設備の情報を管理するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | uuid_generate_v4() | 家電ID（PK） |
| `user_id` | UUID | NOT NULL | - | 所有者のユーザーID（FK → users） |
| `name` | TEXT | NOT NULL | - | 家電の表示名（例: リビングのエアコン） |
| `maker` | TEXT | NOT NULL | - | メーカー名（例: ダイキン） |
| `model_number` | TEXT | NOT NULL | - | 型番（例: S40ZTEP） |
| `category` | TEXT | NOT NULL | - | カテゴリ（例: エアコン・空調） |
| `manual_source_url` | TEXT | NOT NULL | - | マニュアルの出典URL |
| `stored_pdf_path` | TEXT | NULL | - | Supabase Storage のパス |
| `image_url` | TEXT | NULL | - | 家電の画像URL |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新日時 |

**インデックス**: `user_id`, `category`

**RLS**: 自分の家電のみ参照・更新・削除可能

### 3. maintenance_schedules

メンテナンススケジュールを管理するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | uuid_generate_v4() | スケジュールID（PK） |
| `appliance_id` | UUID | NOT NULL | - | 対象の家電ID（FK → appliances） |
| `task_name` | TEXT | NOT NULL | - | タスク名（例: フィルター清掃） |
| `description` | TEXT | NULL | - | タスクの詳細説明 |
| `interval_type` | TEXT | NOT NULL | - | 'days', 'months', 'manual' |
| `interval_value` | INTEGER | NULL | - | 周期の値（manual の場合は null） |
| `last_done_at` | TIMESTAMPTZ | NULL | - | 最後に実施した日時 |
| `next_due_at` | TIMESTAMPTZ | NULL | - | 次回実施予定日時 |
| `source_page` | TEXT | NULL | - | 根拠ページ番号 |
| `importance` | TEXT | NOT NULL | 'medium' | 'high', 'medium', 'low' |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新日時 |

**制約**:
- `interval_type` は 'days', 'months', 'manual' のいずれか
- `importance` は 'high', 'medium', 'low' のいずれか
- `interval_type = 'manual'` の場合、`interval_value` は NULL
- `interval_type IN ('days', 'months')` の場合、`interval_value` は正の整数

**インデックス**: `appliance_id`, `next_due_at`, `importance`

**RLS**: 自分の家電のメンテナンスのみ参照・更新・削除可能

### 4. maintenance_logs

メンテナンス実施記録を管理するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | uuid_generate_v4() | 記録ID（PK） |
| `schedule_id` | UUID | NOT NULL | - | 対象のスケジュールID（FK → maintenance_schedules） |
| `done_at` | TIMESTAMPTZ | NOT NULL | NOW() | 実施日時 |
| `done_by_user_id` | UUID | NOT NULL | - | 実施者のユーザーID（FK → users） |
| `notes` | TEXT | NULL | - | 実施時のメモ |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |

**インデックス**: `schedule_id`, `done_at`

**RLS**: 自分の記録のみ参照・更新・削除可能

### 5. push_subscriptions

PWA プッシュ通知の購読設定を管理するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | uuid_generate_v4() | 購読ID（PK） |
| `user_id` | UUID | NOT NULL | - | 購読者のユーザーID（FK → users） |
| `endpoint` | TEXT | NOT NULL | - | プッシュサービスのエンドポイント（UNIQUE） |
| `p256dh_key` | TEXT | NOT NULL | - | P-256 公開鍵（Base64） |
| `auth_key` | TEXT | NOT NULL | - | 認証シークレット（Base64） |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新日時 |

**制約**: `endpoint` は UNIQUE

**インデックス**: `user_id`

**RLS**: 自分の購読設定のみ参照・更新・削除可能

### 6. categories

カテゴリマスターテーブル（事前定義カテゴリ）。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | SERIAL | NOT NULL | auto | カテゴリID（PK） |
| `name` | TEXT | NOT NULL | - | カテゴリ名（UNIQUE） |
| `display_order` | INTEGER | NOT NULL | 0 | 表示順序 |

**制約**: `name` は UNIQUE

**RLS**: 全認証済みユーザーが読み取り可能

**初期データ**:
1. エアコン・空調
2. 洗濯・乾燥
3. キッチン
4. 給湯・暖房
5. 掃除
6. 住宅設備
7. その他

## Row Level Security (RLS) ポリシー

### users

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Users can view their own record | `auth.uid() = id` |
| INSERT | Users can insert their own record | `auth.uid() = id` |
| UPDATE | Users can update their own record | `auth.uid() = id` |
| DELETE | Users can delete their own record | `auth.uid() = id` |

### appliances

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Users can view their own appliances | `auth.uid() = user_id` |
| INSERT | Users can insert their own appliances | `auth.uid() = user_id` |
| UPDATE | Users can update their own appliances | `auth.uid() = user_id` |
| DELETE | Users can delete their own appliances | `auth.uid() = user_id` |

### maintenance_schedules

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Users can view maintenance schedules for their appliances | `appliances.user_id = auth.uid()` |
| INSERT | Users can insert maintenance schedules for their appliances | `appliances.user_id = auth.uid()` |
| UPDATE | Users can update maintenance schedules for their appliances | `appliances.user_id = auth.uid()` |
| DELETE | Users can delete maintenance schedules for their appliances | `appliances.user_id = auth.uid()` |

### maintenance_logs

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Users can view maintenance logs for their appliances | `appliances.user_id = auth.uid()` |
| INSERT | Users can insert maintenance logs for their appliances | `done_by_user_id = auth.uid()` かつ `appliances.user_id = auth.uid()` |
| UPDATE | Users can update their own maintenance logs | `done_by_user_id = auth.uid()` |
| DELETE | Users can delete their own maintenance logs | `done_by_user_id = auth.uid()` |

### push_subscriptions

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Users can view their own push subscriptions | `auth.uid() = user_id` |
| INSERT | Users can insert their own push subscriptions | `auth.uid() = user_id` |
| UPDATE | Users can update their own push subscriptions | `auth.uid() = user_id` |
| DELETE | Users can delete their own push subscriptions | `auth.uid() = user_id` |

### categories

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Anyone can view categories | `true` (認証済みユーザーのみ) |
| INSERT | - | 管理者のみ（将来実装） |
| UPDATE | - | 管理者のみ（将来実装） |
| DELETE | - | 管理者のみ（将来実装） |

## インデックス戦略

### 作成済みインデックス

| テーブル | カラム | 理由 |
|---------|--------|------|
| `appliances` | `user_id` | ユーザーごとの家電一覧取得を高速化 |
| `appliances` | `category` | カテゴリでのフィルタリングを高速化 |
| `maintenance_schedules` | `appliance_id` | 家電ごとのメンテナンス一覧取得を高速化 |
| `maintenance_schedules` | `next_due_at` | 期限が近いメンテナンスの検索を高速化 |
| `maintenance_schedules` | `importance` | 重要度でのフィルタリングを高速化 |
| `maintenance_logs` | `schedule_id` | スケジュールごとの実施記録取得を高速化 |
| `maintenance_logs` | `done_at` | 実施日時でのソート・検索を高速化 |
| `push_subscriptions` | `user_id` | ユーザーごとの購読設定取得を高速化 |

## トリガー

### updated_at 自動更新

以下のテーブルで `UPDATE` 時に `updated_at` を自動更新：

- `users`
- `appliances`
- `maintenance_schedules`
- `push_subscriptions`

**トリガー関数**: `update_updated_at_column()`

## 拡張機能

| 拡張名 | 用途 |
|-------|------|
| `vector` | pgvector - Phase 6 RAG機能で使用予定 |
| `uuid-ossp` | UUID生成（uuid_generate_v4()） |

## 将来の拡張予定

### Phase 6: RAG機能

```sql
-- documents テーブル（将来実装）
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appliance_id UUID NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),  -- OpenAI Embeddings
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ベクトル検索用インデックス
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);
```

## セキュリティ考慮事項

1. **サービスロールキーの管理**
   - `SUPABASE_SERVICE_ROLE_KEY` は絶対にクライアントに露出させない
   - サーバーサイド（FastAPI）でのみ使用

2. **RLS の徹底**
   - 全テーブルで RLS を有効化
   - 各テーブルで適切なポリシーを設定

3. **認証の確認**
   - `auth.uid()` を使用してユーザー識別
   - 未認証ユーザーはデータにアクセスできない

4. **Storage セキュリティ**（Phase 1 以降）
   - `temp/` と `manuals/` バケットにRLSポリシーを設定
   - ユーザーごとにディレクトリを分離

## 参考資料

- [Supabase ドキュメント](https://supabase.com/docs)
- [PostgreSQL ドキュメント](https://www.postgresql.org/docs/)
- [プロジェクト要件定義書](/home/robert/applications/manual_agent/docs/requirements.md)
