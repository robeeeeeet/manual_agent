# データベーススキーマ設計書

## 概要

このドキュメントは、説明書管理 & メンテナンスリマインドアプリのデータベーススキーマを視覚的に説明します。

## ER図（テキスト版）

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           auth.users (Supabase Auth)                             │
│                                     ↓                                            │
│                              ┌──────────────┐                                   │
│                              │    users     │                                   │
│                              ├──────────────┤                                   │
│                              │ id (PK)      │←──────────────┐                   │
│                              │ email        │               │                   │
│                              │ notify_time  │               │                   │
│                              │ timezone     │               │                   │
│                              └──────────────┘               │                   │
│                                     │                       │                   │
│           ┌─────────────────────────┼───────────────────────┘                   │
│           │                         │                                           │
│           ↓                         ↓                                           │
│  ┌─────────────────────┐   ┌────────────────────┐                              │
│  │  shared_appliances  │   │  user_appliances   │                              │
│  │    (家電マスター)     │   │   (所有関係)        │                              │
│  ├─────────────────────┤   ├────────────────────┤                              │
│  │ id (PK)             │←──│ shared_appliance_id│                              │
│  │ maker               │   │ id (PK)            │                              │
│  │ model_number        │   │ user_id (FK)       │──→ users.id                  │
│  │ category            │   │ name               │                              │
│  │ manual_source_url   │   │ image_url          │                              │
│  │ stored_pdf_path     │   └────────────────────┘                              │
│  └─────────────────────┘            │                                           │
│           │                         │                                           │
│           ↓                         ↓                                           │
│  ┌─────────────────────────────────┐   ┌────────────────────────────────┐    │
│  │   shared_maintenance_items     │   │   maintenance_schedules        │    │
│  │  (メンテ項目マスター)            │   │   (ユーザースケジュール)         │    │
│  ├─────────────────────────────────┤   ├────────────────────────────────┤    │
│  │ id (PK)                        │←──│ shared_item_id (FK, NOT NULL)  │    │
│  │ shared_appliance_id (FK, null) │   │ id (PK)                        │    │
│  │ user_appliance_id (FK, null)   │   │ user_appliance_id (FK)         │    │
│  │ task_name                      │   │ interval_type                  │    │
│  │ description                    │   │ interval_value                 │    │
│  │ recommended_interval_type      │   │ next_due_at                    │    │
│  │ recommended_interval_value     │   │ last_done_at                   │    │
│  │ source_page                    │   └────────────────────────────────┘    │
│  │ importance                     │            │                            │
│  │ extracted_at                   │            │                            │
│  └─────────────────────────────────┘            │                            │
│                                           ↓                                     │
│                           ┌───────────────────────────────┐                     │
│                           │   maintenance_logs            │                     │
│                           ├───────────────────────────────┤                     │
│                           │ id (PK)                       │                     │
│                           │ schedule_id (FK)              │                     │
│                           │ done_at                       │                     │
│                           │ done_by_user_id (FK → users)  │                     │
│                           │ notes                         │                     │
│                           └───────────────────────────────┘                     │
│                                                                                  │
│                           ┌───────────────────────────────┐                     │
│                           │   push_subscriptions          │                     │
│                           ├───────────────────────────────┤                     │
│                           │ id (PK)                       │                     │
│                           │ user_id (FK → users)          │                     │
│                           │ endpoint (UNIQUE)             │                     │
│                           │ p256dh_key                    │                     │
│                           │ auth_key                      │                     │
│                           └───────────────────────────────┘                     │
│                                                                                  │
│                           ┌───────────────────────────────┐                     │
│                           │   categories (master)         │                     │
│                           ├───────────────────────────────┤                     │
│                           │ id (PK, SERIAL)               │                     │
│                           │ name (UNIQUE)                 │                     │
│                           │ display_order                 │                     │
│                           └───────────────────────────────┘                     │
│                                                                                  │
│                           ┌───────────────────────────────┐                     │
│                           │   qa_violations               │                     │
│                           ├───────────────────────────────┤                     │
│                           │ id (PK)                       │                     │
│                           │ user_id (FK → users)          │                     │
│                           │ shared_appliance_id (FK)      │                     │
│                           │ question                      │                     │
│                           │ violation_type                │                     │
│                           │ detection_method              │                     │
│                           │ created_at                    │                     │
│                           └───────────────────────────────┘                     │
│                                                                                  │
│                           ┌───────────────────────────────┐                     │
│                           │   qa_restrictions             │                     │
│                           ├───────────────────────────────┤                     │
│                           │ id (PK)                       │                     │
│                           │ user_id (FK → users, UNIQUE)  │                     │
│                           │ violation_count               │                     │
│                           │ restricted_until              │                     │
│                           │ last_violation_at             │                     │
│                           │ created_at, updated_at        │                     │
│                           └───────────────────────────────┘                     │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         Family Sharing (Phase 7)                            ││
│  │                                                                             ││
│  │   ┌───────────────────────────────┐                                         ││
│  │   │         groups                │                                         ││
│  │   ├───────────────────────────────┤                                         ││
│  │   │ id (PK)                       │                                         ││
│  │   │ name                          │                                         ││
│  │   │ invite_code (UNIQUE)          │                                         ││
│  │   │ owner_id (FK → users)         │                                         ││
│  │   └───────────────────────────────┘                                         ││
│  │              │                                                              ││
│  │              ↓                                                              ││
│  │   ┌───────────────────────────────┐                                         ││
│  │   │     group_members             │                                         ││
│  │   ├───────────────────────────────┤                                         ││
│  │   │ id (PK)                       │                                         ││
│  │   │ group_id (FK → groups)        │                                         ││
│  │   │ user_id (FK → users)          │                                         ││
│  │   │ joined_at                     │                                         ││
│  │   └───────────────────────────────┘                                         ││
│  │                                                                             ││
│  │   user_appliances.group_id → groups.id （グループ所有の場合）                  ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
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

### 2. shared_appliances（家電マスター）

家電の共有マスターデータを管理するテーブル。同じメーカー・型番の家電は1レコードのみ。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | gen_random_uuid() | 家電マスターID（PK） |
| `maker` | TEXT | NOT NULL | - | メーカー名（例: ダイキン） |
| `model_number` | TEXT | NOT NULL | - | 型番（例: S40ZTEP） |
| `category` | TEXT | NOT NULL | - | カテゴリ（例: エアコン・空調） |
| `manual_source_url` | TEXT | NULL | - | マニュアルの出典URL |
| `stored_pdf_path` | TEXT | NULL | - | Supabase Storage のパス |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新日時 |

**制約**: `(maker, model_number)` はUNIQUE

**インデックス**: `maker`, `category`, `model_number`

**RLS**: 全認証済みユーザーが閲覧可能、挿入・更新可能

### 3. user_appliances（ユーザー所有関係）

ユーザーまたはグループと家電マスターの所有関係を管理するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | gen_random_uuid() | 所有関係ID（PK） |
| `user_id` | UUID | NULL | - | 所有者のユーザーID（個人所有の場合、FK → users） |
| `group_id` | UUID | NULL | - | 所有グループID（グループ所有の場合、FK → groups） |
| `shared_appliance_id` | UUID | NOT NULL | - | 家電マスターID（FK → shared_appliances） |
| `name` | TEXT | NOT NULL | - | ユーザー固有の表示名（例: リビングのエアコン） |
| `image_url` | TEXT | NULL | - | ユーザーがアップロードした画像URL |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新日時 |

**制約**:
- `(user_id, name)` は条件付きUNIQUE（個人所有の場合）
- `(group_id, name)` は条件付きUNIQUE（グループ所有の場合）
- `chk_user_appliances_owner`: `user_id` と `group_id` のいずれか一方のみ設定

**インデックス**: `user_id`, `group_id`, `shared_appliance_id`

**RLS**: 個人所有 OR グループメンバーとして参照・更新・削除可能

### 4. shared_maintenance_items（メンテナンス項目マスター）

メンテナンス項目のマスターテーブル。共有項目（LLM抽出）とカスタム項目（ユーザー追加）の両方を管理。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | gen_random_uuid() | 項目ID（PK） |
| `shared_appliance_id` | UUID | NULL | - | 共有項目の場合: 家電マスターID（FK → shared_appliances） |
| `user_appliance_id` | UUID | NULL | - | カスタム項目の場合: ユーザー家電ID（FK → user_appliances） |
| `task_name` | TEXT | NOT NULL | - | タスク名（例: フィルター清掃） |
| `description` | TEXT | NULL | - | タスクの詳細説明（HTML形式） |
| `recommended_interval_type` | TEXT | NOT NULL | - | 推奨周期タイプ: 'days', 'months', 'manual' |
| `recommended_interval_value` | INTEGER | NULL | - | 推奨周期の値（manual の場合は null） |
| `source_page` | TEXT | NULL | - | 根拠ページ番号 |
| `importance` | TEXT | NOT NULL | 'medium' | 'high', 'medium', 'low' |
| `extracted_at` | TIMESTAMPTZ | NOT NULL | NOW() | LLMで抽出した日時 |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |

**制約**:
- `recommended_interval_type` は 'days', 'months', 'manual' のいずれか
- `importance` は 'high', 'medium', 'low' のいずれか
- `chk_shared_or_custom`: `shared_appliance_id` と `user_appliance_id` は排他的（どちらか一方のみ設定）
- `(shared_appliance_id, user_appliance_id, task_name)` はUNIQUE（重複防止）

**インデックス**: `shared_appliance_id`, `user_appliance_id`, `importance`

**RLS**:
- 共有項目（`user_appliance_id` = NULL）: 全認証済みユーザーが閲覧可能
- カスタム項目: 家電所有者またはグループメンバーのみアクセス可能

**設計メモ**:
このテーブルは2種類のメンテナンス項目を管理します：
1. **共有項目**（`shared_appliance_id` 設定）: LLM抽出結果のキャッシュ。同じ家電を持つ全ユーザーで共有。
2. **カスタム項目**（`user_appliance_id` 設定）: ユーザーが手動で追加した項目。

### 5. maintenance_schedules

ユーザーのメンテナンススケジュールを管理するテーブル。`shared_maintenance_items` へのFKを持ち、項目詳細はJOINで取得。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | gen_random_uuid() | スケジュールID（PK） |
| `user_appliance_id` | UUID | NOT NULL | - | 対象の所有関係ID（FK → user_appliances） |
| `shared_item_id` | UUID | NOT NULL | - | メンテナンス項目マスターへの参照（FK → shared_maintenance_items） |
| `interval_type` | TEXT | NOT NULL | - | 'days', 'months', 'manual'（カスタマイズ可能） |
| `interval_value` | INTEGER | NULL | - | 周期の値（カスタマイズ可能、manual の場合は null） |
| `last_done_at` | TIMESTAMPTZ | NULL | - | 最後に実施した日時 |
| `next_due_at` | TIMESTAMPTZ | NULL | - | 次回実施予定日時 |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新日時 |

**制約**:
- `shared_item_id` は NOT NULL（全スケジュールはマスター項目への参照を持つ）
- `interval_type` は 'days', 'months', 'manual' のいずれか
- `interval_type = 'manual'` の場合、`interval_value` は NULL
- `interval_type IN ('days', 'months')` の場合、`interval_value` は正の整数

**インデックス**: `user_appliance_id`, `shared_item_id`, `next_due_at`

**RLS**: 自分の家電のメンテナンスのみ参照・更新・削除可能

**設計メモ**:
- `task_name`, `description`, `source_page`, `importance` は `shared_maintenance_items` から JOIN で取得
- `interval_type`, `interval_value` はユーザーがカスタマイズ可能（推奨周期と異なる周期を設定可能）
- 共有項目: `shared_item_id` → `shared_maintenance_items`（`shared_appliance_id` 設定）
- カスタム項目: `shared_item_id` → `shared_maintenance_items`（`user_appliance_id` 設定）

### 6. maintenance_logs

メンテナンス実施記録を管理するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | gen_random_uuid() | 記録ID（PK） |
| `schedule_id` | UUID | NOT NULL | - | 対象のスケジュールID（FK → maintenance_schedules） |
| `done_at` | TIMESTAMPTZ | NOT NULL | NOW() | 実施日時 |
| `done_by_user_id` | UUID | NOT NULL | - | 実施者のユーザーID（FK → users） |
| `notes` | TEXT | NULL | - | 実施時のメモ |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |

**インデックス**: `schedule_id`, `done_at`

**RLS**: 自分の記録のみ参照・更新・削除可能

### 7. push_subscriptions

PWA プッシュ通知の購読設定を管理するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | gen_random_uuid() | 購読ID（PK） |
| `user_id` | UUID | NOT NULL | - | 購読者のユーザーID（FK → users） |
| `endpoint` | TEXT | NOT NULL | - | プッシュサービスのエンドポイント（UNIQUE） |
| `p256dh_key` | TEXT | NOT NULL | - | P-256 公開鍵（Base64） |
| `auth_key` | TEXT | NOT NULL | - | 認証シークレット（Base64） |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新日時 |

**制約**: `endpoint` は UNIQUE

**インデックス**: `user_id`

**RLS**: 自分の購読設定のみ参照・更新・削除可能

### 8. categories

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

### 9. qa_violations（QA違反記録）

QA機能に対する違反（不適切な質問）を記録するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | gen_random_uuid() | 違反記録ID（PK） |
| `user_id` | UUID | NOT NULL | - | 違反したユーザーID（FK → users） |
| `shared_appliance_id` | UUID | NOT NULL | - | 質問対象の製品ID（FK → shared_appliances） |
| `question` | TEXT | NOT NULL | - | 違反した質問内容 |
| `violation_type` | TEXT | NOT NULL | - | 違反タイプ: 'off_topic', 'inappropriate', 'attack' |
| `detection_method` | TEXT | NOT NULL | - | 検出方法: 'rule_based', 'llm' |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 違反日時 |

**制約**:
- `violation_type` は 'off_topic', 'inappropriate', 'attack' のいずれか
- `detection_method` は 'rule_based', 'llm' のいずれか

**インデックス**: `user_id`, `shared_appliance_id`, `violation_type`

**RLS**: 自分の違反記録のみ閲覧可能、INSERT/UPDATE/DELETEはservice_roleのみ

### 10. qa_restrictions（QA利用制限）

ユーザーのQA機能利用制限状態を管理するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | gen_random_uuid() | 制限ID（PK） |
| `user_id` | UUID | NOT NULL | - | ユーザーID（UNIQUE、FK → users） |
| `violation_count` | INTEGER | NOT NULL | 0 | 累計違反回数 |
| `restricted_until` | TIMESTAMPTZ | NULL | - | 制限解除日時（NULLなら制限なし） |
| `last_violation_at` | TIMESTAMPTZ | NULL | - | 最終違反日時 |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新日時 |

**制約**: `user_id` は UNIQUE（1ユーザー1レコード）

**インデックス**: `user_id`, `restricted_until`（制限中ユーザー一覧用）

**RLS**: 自分の制限状態のみ閲覧可能、INSERT/UPDATE/DELETEはservice_roleのみ

**制限時間設定**（バックエンド実装で制御）:
- 1回目: 制限なし（拒否するが即時再利用可能）
- 2回目: 1時間
- 3回目: 24時間
- 4回目以降: 7日間

### 11. groups（グループ）

家族グループを管理するテーブル（Phase 7）。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | gen_random_uuid() | グループID（PK） |
| `name` | TEXT | NOT NULL | - | グループ名 |
| `invite_code` | TEXT | NOT NULL | - | 招待コード（6-8文字英数字、UNIQUE） |
| `owner_id` | UUID | NOT NULL | - | グループオーナーのユーザーID（FK → users） |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | 更新日時 |

**制約**: `invite_code` は UNIQUE

**インデックス**: `invite_code`, `owner_id`

**RLS**: グループメンバーのみ閲覧可能、オーナーのみ更新・削除可能

**特記事項**:
- グループ削除時、グループ家電はオーナーの個人所有に自動移管（トリガー）

### 12. group_members（グループメンバー）

グループのメンバーシップを管理するテーブル（Phase 7）。
オーナー情報は `groups.owner_id` で管理（正規化済み）。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | UUID | NOT NULL | gen_random_uuid() | メンバーシップID（PK） |
| `group_id` | UUID | NOT NULL | - | 所属グループID（FK → groups） |
| `user_id` | UUID | NOT NULL | - | メンバーのユーザーID（FK → users） |
| `joined_at` | TIMESTAMPTZ | NOT NULL | NOW() | 参加日時 |

**制約**: `(group_id, user_id)` は UNIQUE（同一グループに同一ユーザーは1回のみ）

**インデックス**: `group_id`, `user_id`

**RLS**: 同グループメンバーのみ閲覧可能、本人またはオーナーが削除可能

## Row Level Security (RLS) ポリシー

### users

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Users can view their own record | `auth.uid() = id` |
| INSERT | Users can insert their own record | `auth.uid() = id` |
| UPDATE | Users can update their own record | `auth.uid() = id` |
| DELETE | Users can delete their own record | `auth.uid() = id` |

### shared_appliances

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Anyone can view shared appliances | `true`（認証済みユーザー） |
| INSERT | Authenticated users can insert | `true`（認証済みユーザー） |
| UPDATE | Authenticated users can update | `true`（認証済みユーザー） |
| DELETE | - | 削除禁止（他ユーザー参照の可能性） |

### user_appliances

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Users can view user_appliances | `user_id = auth.uid()` OR グループメンバー |
| INSERT | Users can insert user_appliances | `user_id = auth.uid()` OR グループメンバー |
| UPDATE | Users can update user_appliances | `user_id = auth.uid()` OR グループメンバー |
| DELETE | Users can delete user_appliances | `user_id = auth.uid()` OR グループメンバー |

**グループメンバー判定**:
```sql
EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = user_appliances.group_id
    AND group_members.user_id = auth.uid()
)
```

### maintenance_schedules

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Users can view maintenance schedules | 家電所有者 OR グループメンバー |
| INSERT | Users can insert maintenance schedules | 家電所有者 OR グループメンバー |
| UPDATE | Users can update maintenance schedules | 家電所有者 OR グループメンバー |
| DELETE | Users can delete maintenance schedules | 家電所有者 OR グループメンバー |

**判定条件**: `user_appliances.user_id = auth.uid()` OR グループメンバー

### maintenance_logs

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Users can view maintenance logs | 家電所有者 OR グループメンバー |
| INSERT | Users can insert maintenance logs | `done_by_user_id = auth.uid()` かつ (家電所有者 OR グループメンバー) |

### groups

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Members can view their groups | グループメンバーのみ |
| INSERT | Authenticated users can create groups | `owner_id = auth.uid()` |
| UPDATE | Owners can update their groups | `owner_id = auth.uid()` |
| DELETE | Owners can delete their groups | `owner_id = auth.uid()` |

### group_members

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Members can view group members | 同グループメンバーのみ |
| INSERT | Users can join groups | `user_id = auth.uid()` |
| DELETE | Members can leave or be removed | 本人 OR グループオーナー |

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

### qa_violations

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Users can view own violations | `auth.uid() = user_id` |
| INSERT | - | service_roleのみ（バックエンド経由） |
| UPDATE | - | 禁止 |
| DELETE | - | 禁止 |

### qa_restrictions

| 操作 | ポリシー名 | 条件 |
|-----|----------|------|
| SELECT | Users can view own restrictions | `auth.uid() = user_id` |
| INSERT | - | service_roleのみ（バックエンド経由） |
| UPDATE | - | service_roleのみ（バックエンド経由） |
| DELETE | - | 禁止 |

## インデックス戦略

### 作成済みインデックス

| テーブル | カラム | 理由 |
|---------|--------|------|
| `shared_appliances` | `maker` | メーカーでの検索を高速化 |
| `shared_appliances` | `category` | カテゴリでのフィルタリングを高速化 |
| `shared_appliances` | `model_number` | 型番での検索を高速化 |
| `user_appliances` | `user_id` | ユーザーごとの家電一覧取得を高速化 |
| `user_appliances` | `shared_appliance_id` | 家電マスターとの結合を高速化 |
| `maintenance_schedules` | `user_appliance_id` | 家電ごとのメンテナンス一覧取得を高速化 |
| `maintenance_schedules` | `next_due_at` | 期限が近いメンテナンスの検索を高速化 |
| `maintenance_schedules` | `importance` | 重要度でのフィルタリングを高速化 |
| `maintenance_logs` | `schedule_id` | スケジュールごとの実施記録取得を高速化 |
| `maintenance_logs` | `done_at` | 実施日時でのソート・検索を高速化 |
| `push_subscriptions` | `user_id` | ユーザーごとの購読設定取得を高速化 |

## トリガー

### updated_at 自動更新

以下のテーブルで `UPDATE` 時に `updated_at` を自動更新：

- `users`
- `shared_appliances`
- `user_appliances`
- `maintenance_schedules`
- `push_subscriptions`
- `qa_restrictions`

**トリガー関数**: `update_updated_at_column()`

## 拡張機能

| 拡張名 | 用途 |
|-------|------|
| `vector` | pgvector - Phase 6 RAG機能で使用予定 |

**注意**: UUID生成には `gen_random_uuid()` を使用（PostgreSQL 13+標準機能、拡張不要）

## 設計の変更履歴

### 2026-01-11: メンテナンステーブル正規化

**変更内容**:
- `shared_maintenance_items` に `user_appliance_id` カラムを追加（カスタム項目用）
- `shared_maintenance_items.shared_appliance_id` を NULL 許可に変更
- 排他制約 `chk_shared_or_custom` を追加（shared_appliance_id XOR user_appliance_id）
- `maintenance_schedules.shared_item_id` を NOT NULL に変更
- `maintenance_schedules` から重複カラムを削除: `task_name`, `description`, `source_page`, `importance`

**設計意図**:
- `shared_maintenance_items` と `maintenance_schedules` 間の重複カラムを解消
- `shared_maintenance_items` をメンテナンス項目のマスターテーブルとして拡張
- 共有項目（LLM抽出）とカスタム項目（ユーザー追加）を同一テーブルで管理
- `maintenance_schedules` は JOIN で項目詳細を取得

**影響**:
- バックエンドサービスで SELECT 時に `shared_maintenance_items` への JOIN が必要
- API レスポンス形式は変更なし（バックエンドでフラット化して返す）

### 2026-01-09: Phase 7 家族グループ共有機能追加

**追加されたもの**:
- `groups` テーブル: 家族グループを管理
- `group_members` テーブル: グループメンバーシップを管理
- `user_appliances.group_id` カラム: グループ所有の場合に設定

**設計意図**:
- 家族など複数人で家電とメンテナンススケジュールを共有
- グループ所有モデル: グループとして家電を登録、全メンバーが編集・削除可能
- 共有スケジュール: 誰かが完了すると全員に反映
- 招待コード方式: 6-8文字英数字で簡単に参加
- 個人通知設定を維持: 各メンバーの `notify_time` を尊重

**RLSポリシー変更**:
- `user_appliances`: 個人所有 OR グループメンバーとしてアクセス可能
- `maintenance_schedules`: グループ家電のスケジュールも共有
- `maintenance_logs`: グループメンバーが完了記録を閲覧可能

**トリガー**:
- `transfer_group_appliances_to_owner`: グループ削除時に家電をオーナーの個人所有に移管

### 2026-01-07: QA不正利用防止機能追加

**追加されたもの**:
- `qa_violations` テーブル: QA機能への違反（不適切な質問）を記録
- `qa_restrictions` テーブル: ユーザーのQA機能利用制限状態を管理

**設計意図**:
- 製品に関係ない質問、攻撃的な質問、プロンプトインジェクションを検出して拒否
- 繰り返し違反したユーザーに対して段階的な利用制限を適用
- ルールベース判定（高速・無料）+ LLM判定（精度重視）のハイブリッド方式

**制限時間設定**:
- 1回目: 制限なし（拒否するが即時再利用可能）
- 2回目: 1時間
- 3回目: 24時間
- 4回目以降: 7日間

### 2026-01-03: メンテナンス項目キャッシュ機能追加

**追加されたもの**:
- `shared_maintenance_items` テーブル: LLM抽出結果のキャッシュ
- `maintenance_schedules.shared_item_id` カラム: 元の共有項目への参照

**設計意図**:
- 同じ家電のメンテナンス項目を複数ユーザーで共有
- LLMコストの大幅削減（1家電1回のみ抽出）
- 処理時間の短縮（2人目以降は即座に項目取得可能）

### 2026-01-03: 共有マスター方式への移行

**変更前**:
- `appliances` テーブル: ユーザーごとに家電データを重複保持

**変更後**:
- `shared_appliances` テーブル: 家電マスターデータ（メーカー・型番・説明書情報）
- `user_appliances` テーブル: ユーザーの所有関係（表示名・画像）

**メリット**:
- 同じ家電（同一メーカー・型番）の説明書PDFを複数ユーザーで共有可能
- ストレージ容量の削減
- 説明書更新時に全ユーザーに反映

## 将来の拡張予定

### Phase 6: RAG機能

```sql
-- documents テーブル（将来実装）
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_appliance_id UUID NOT NULL REFERENCES shared_appliances(id) ON DELETE CASCADE,
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

4. **Storage セキュリティ**
   - `manuals/` バケット: 共有PDF保存用
   - `images/` バケット: ユーザー画像保存用

## 参考資料

- [Supabase ドキュメント](https://supabase.com/docs)
- [PostgreSQL ドキュメント](https://www.postgresql.org/docs/)
- [プロジェクト要件定義書](/home/robert/applications/manual_agent/docs/requirements.md)
