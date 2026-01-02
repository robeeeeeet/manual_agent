# Supabase スキーマ管理

このディレクトリは Supabase データベースのマイグレーションとシードデータを管理します。

## ディレクトリ構成

```
backend/supabase/
├── README.md                          # このファイル
├── migrations/
│   └── 00001_initial_schema.sql      # 初期スキーマ
└── seed.sql                          # 初期カテゴリデータ
```

## マイグレーション実行方法

### 1. Supabase CLI のインストール

```bash
# macOS / Linux
brew install supabase/tap/supabase

# Windows
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### 2. Supabase プロジェクトへのログイン

```bash
supabase login
```

### 3. プロジェクトのリンク

```bash
cd /home/robert/applications/manual_agent/backend
supabase link --project-ref <YOUR_PROJECT_REF>
```

### 4. マイグレーション実行

```bash
# マイグレーションを適用
supabase db push

# または、個別にマイグレーションファイルを実行
supabase db execute -f supabase/migrations/00001_initial_schema.sql
```

### 5. シードデータ投入

```bash
supabase db execute -f supabase/seed.sql
```

## ローカル開発環境でのテスト

```bash
# ローカル Supabase 環境を起動
supabase start

# マイグレーション適用
supabase db reset

# ローカル環境停止
supabase stop
```

## スキーマ概要

### テーブル一覧

| テーブル名 | 説明 | RLS |
|-----------|------|-----|
| `users` | ユーザー設定（通知時刻、タイムゾーン） | ✅ 自分のみ |
| `appliances` | 家電・住宅設備の情報 | ✅ 自分の家電のみ |
| `maintenance_schedules` | メンテナンススケジュール | ✅ 自分の家電のメンテナンスのみ |
| `maintenance_logs` | メンテナンス実施記録 | ✅ 自分の記録のみ |
| `push_subscriptions` | プッシュ通知購読設定 | ✅ 自分の購読のみ |
| `categories` | カテゴリマスター | ✅ 全員読取可 |

### RLS（Row Level Security）ポリシー

**原則: 全テーブルで RLS を有効化**

#### users
- 自分のレコードのみ参照・挿入・更新・削除可能
- `auth.uid() = id` で制御

#### appliances
- 自分の家電のみ参照・挿入・更新・削除可能
- `auth.uid() = user_id` で制御

#### maintenance_schedules
- 自分の家電のメンテナンスのみ操作可能
- `appliances.user_id = auth.uid()` で制御

#### maintenance_logs
- 自分の記録のみ操作可能
- `done_by_user_id = auth.uid()` で制御

#### push_subscriptions
- 自分の購読設定のみ操作可能
- `auth.uid() = user_id` で制御

#### categories
- 全認証済みユーザーが読み取り可能
- 管理者のみ書き込み可能（将来実装予定）

## セキュリティチェックリスト

実装前に確認：

- [x] **`SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドのみで使用**
  - クライアントには絶対に露出させない
  - `.env` ファイルに記載し、`.gitignore` に追加済み

- [x] **全テーブルで RLS を有効化**
  - `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` を実行

- [x] **適切な RLS ポリシーを設定**
  - 各テーブルで SELECT, INSERT, UPDATE, DELETE のポリシーを定義

- [x] **Supabase Auth と連携**
  - `auth.uid()` を使用してユーザー識別

- [ ] **Storage バケットにアクセスポリシーを設定**
  - Phase 1 以降で実装予定
  - `temp/` と `manuals/` バケットを作成
  - RLS ポリシーで自分のファイルのみアクセス可能にする

## 環境変数

```bash
# 公開可（クライアント用）
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>

# サーバー専用（絶対にクライアントに露出させない）
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
```

## 完了条件（DoD）

- [x] 未認証でSELECTできない（RLS有効）
- [x] 自分の行のみ取得/更新できる
- [ ] Storageのパス制約が効く（Phase 1 以降）
- [ ] マイグレーションがエラーなく実行できる（要テスト）

## トラブルシューティング

### マイグレーション実行時のエラー

```
Error: relation "auth.users" does not exist
```

→ Supabase プロジェクトで Auth が有効になっているか確認してください。

### RLS ポリシーが効かない

```sql
-- RLS が有効か確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- ポリシー一覧を確認
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

### ローカル環境でのテスト

```bash
# ローカル環境のログを確認
supabase status

# データベース接続
psql postgresql://postgres:postgres@localhost:54322/postgres
```

## 関連ドキュメント

- [Supabase ドキュメント](https://supabase.com/docs)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [プロジェクト要件定義書](/home/robert/applications/manual_agent/docs/requirements.md)

## 次のステップ

1. Supabase プロジェクトを作成
2. このマイグレーションを実行
3. 環境変数を `.env` に設定
4. フロントエンド・バックエンドで Supabase Client を初期化
5. Storage バケット設定（Phase 1 以降）
