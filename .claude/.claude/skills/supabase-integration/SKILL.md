---
name: supabase-integration
description: Supabase統合（PostgreSQL, Auth, Storage, pgvector）。"テーブル作成", "スキーマ設計", "認証設定", "ストレージバケット", "ベクトル検索", "RLS設定", "マイグレーション", "Supabase client", "supabase CLI", "db push", "migration"などで使用。データベース設計とバックエンド連携パターンを参照。
---

# Supabase 統合

Supabase（PostgreSQL, Auth, Storage, pgvector）の統合開発ガイド。

## 前提条件

- [ ] Supabaseプロジェクト作成済み
- [ ] 環境変数: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] pgvector拡張の有効化（RAG機能使用時）

## 完了条件（DoD）

- [ ] 未認証でSELECTできない（RLS有効）
- [ ] 自分の行のみ取得/更新できる
- [ ] Storageのパス制約が効く
- [ ] マイグレーションがエラーなく実行できる

## セキュリティ必須チェック

- [ ] **`SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドのみ。クライアントに絶対出さない**
- [ ] 全テーブルでRLSを有効化
- [ ] Storageバケットにアクセスポリシーを設定

## SQL実行手順（順序）

スキーマ変更時は以下の順序で実行：

```
1. Extensions  → 2. Functions  → 3. Tables  → 4. Indexes  → 5. Triggers  → 6. Policies
```

> ⚠️ 順序を間違えると依存関係エラーが発生します

## RLS対象テーブル一覧

**原則: 本プロジェクトでは全テーブルでRLSを有効化**

| テーブル | ポリシー概要 |
|---------|-------------|
| `users` | 自分の行のみ読み書き可 |
| `appliances` | 自分の家電のみ操作可 |
| `maintenance_schedules` | 自分の家電に紐づくもののみ |
| `push_subscriptions` | 自分の購読のみ |
| `documents` | 自分の家電に紐づくもののみ |

## プロジェクト設定

### 環境変数

```bash
# .env
# プロジェクトURL（公開可）
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co

# Anonymous Key - クライアント用（公開可、RLS適用）
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Service Role Key - サーバー専用（公開禁止、RLSバイパス）
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` は絶対にクライアントに露出させないこと

## データベーススキーマ

### 本プロジェクトのテーブル

```sql
-- ユーザー設定
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  notify_time TIME DEFAULT '09:00',
  timezone TEXT DEFAULT 'Asia/Tokyo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 家電
CREATE TABLE appliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  maker TEXT NOT NULL,
  model_number TEXT NOT NULL,
  category TEXT NOT NULL,
  manual_source_url TEXT,
  stored_pdf_path TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- メンテナンススケジュール
CREATE TABLE maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appliance_id UUID REFERENCES appliances(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  interval_type TEXT CHECK (interval_type IN ('days', 'months', 'manual')),
  interval_value INT,
  last_done_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  source_page TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS（Row Level Security）

**全テーブル共通パターン:**

```sql
-- RLS有効化（全テーブルで実行）
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE appliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
```

**appliances（基本パターン）:**

```sql
CREATE POLICY "Users can CRUD own appliances"
  ON appliances FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**maintenance_schedules（親テーブル経由）:**

```sql
CREATE POLICY "Users can CRUD own schedules"
  ON maintenance_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM appliances
      WHERE appliances.id = maintenance_schedules.appliance_id
        AND appliances.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appliances
      WHERE appliances.id = maintenance_schedules.appliance_id
        AND appliances.user_id = auth.uid()
    )
  );
```

**push_subscriptions（ユーザー直接紐付け）:**

```sql
CREATE POLICY "Users can CRUD own subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**users（自分のプロフィールのみ）:**

```sql
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

**documents（親テーブル経由）:**

```sql
CREATE POLICY "Users can CRUD own documents"
  ON documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM appliances
      WHERE appliances.id = documents.appliance_id
        AND appliances.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appliances
      WHERE appliances.id = documents.appliance_id
        AND appliances.user_id = auth.uid()
    )
  );
```

## Storage

```sql
-- バケット作成
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('temp', 'temp', false),      -- 一時保存
  ('manuals', 'manuals', false); -- 正式版

-- Storage RLS
CREATE POLICY "Users can upload to temp"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'temp' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## pgvector（RAG用）

```sql
-- 拡張有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- ドキュメントテーブル
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appliance_id UUID REFERENCES appliances(id),
  content TEXT NOT NULL,
  embedding VECTOR(768),  -- Gemini embedding
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 検索関数
CREATE FUNCTION match_documents(
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (id UUID, content TEXT, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## 詳細リファレンス

- [スキーマ設計](references/schema-design.md) - テーブル設計詳細
- [認証パターン](references/auth-patterns.md) - Auth設定、セッション管理
- [pgvectorセットアップ](references/pgvector-setup.md) - ベクトル検索設定

## クライアント使用例

```python
# Python (FastAPI)
from supabase import create_client

supabase = create_client(url, key)

# 取得
result = supabase.table("appliances").select("*").eq("user_id", user_id).execute()

# 挿入
supabase.table("appliances").insert({"name": "エアコン", ...}).execute()
```

```typescript
// TypeScript (Next.js)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

const { data, error } = await supabase
  .from('appliances')
  .select('*')
  .order('next_due_at')
```

## Supabase CLI

### セットアップ

本プロジェクトでは `npx` 経由でSupabase CLIを使用（グローバルインストール不要）。

```bash
# バージョン確認
npx supabase --version

# ログイン（ブラウザ認証）
npx supabase login

# プロジェクト初期化（初回のみ）
cd backend && npx supabase init

# リモートプロジェクトにリンク
npx supabase link --project-ref <project-ref>
```

### プロジェクト情報

```
プロジェクト名: manual-agent
Reference ID: nuuukueocvvdoynqkmol
リージョン: Northeast Asia (Tokyo)
```

### マイグレーション管理

```bash
# マイグレーション状況確認
npx supabase migration list

# 新しいマイグレーション作成
npx supabase migration new <name>
# → supabase/migrations/<timestamp>_<name>.sql が作成される

# リモートDBにマイグレーション適用
npx supabase db push

# 特定マイグレーションを「適用済み」としてマーク
# （ダッシュボードで直接SQL実行した場合に使用）
npx supabase migration repair <version> --status applied

# リモートDBとの差分確認
npx supabase db diff
```

### マイグレーションファイル規約

```
supabase/migrations/
├── 00001_initial_schema.sql      # 初期スキーマ
├── 00002_manufacturer_domains.sql # 機能追加
└── ...
```

**命名規則:** `<番号>_<機能名>.sql`

**テンプレート:**

```sql
-- ============================================================================
-- <機能名>
-- ============================================================================
-- 作成日: YYYY-MM-DD
-- 概要: <概要説明>
-- ============================================================================

-- テーブル作成
CREATE TABLE example (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ⚠️ uuid_generate_v4() ではなく gen_random_uuid() を使用
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_example_name ON example(name);

-- トリガー（updated_at自動更新）
CREATE TRIGGER update_example_updated_at
    BEFORE UPDATE ON example
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE example ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Policy name"
    ON example FOR SELECT
    TO authenticated
    USING (true);
```

### その他のコマンド

```bash
# プロジェクト一覧
npx supabase projects list

# シークレット管理
npx supabase secrets list
npx supabase secrets set KEY=value

# Edge Functions
npx supabase functions new <name>
npx supabase functions deploy <name>

# ローカル開発（Docker必要）
npx supabase start
npx supabase stop
npx supabase status
```

### トラブルシューティング

| エラー | 原因 | 解決策 |
|-------|------|--------|
| `uuid_generate_v4() does not exist` | uuid-ossp拡張の問題 | `gen_random_uuid()` を使用 |
| `relation already exists` | テーブルが既存 | `migration repair` で適用済みマーク |
| `Cannot find project ref` | リンク未設定 | `supabase link` を実行 |
| `permission denied` | RLS違反 | ポリシー確認、または secret_key 使用 |
