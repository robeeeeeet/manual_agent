# Supabase 設定手順書

このドキュメントでは、プロジェクトのSupabase環境構築手順を説明します。

## 前提条件

- Supabaseアカウント（[supabase.com](https://supabase.com)で無料作成可能）
- プロジェクトのクローン済み

## 設定手順

### Step 1: Supabaseプロジェクト作成

1. [Supabase Dashboard](https://supabase.com/dashboard) にアクセス
2. 「New Project」をクリック
3. 以下を設定：
   - **Organization**: 既存または新規作成
   - **Project name**: `manual-agent`（任意）
   - **Database Password**: 強力なパスワードを設定（**メモしておく**）
   - **Region**: `Northeast Asia (Tokyo)` 推奨
4. 「Create new project」をクリック（作成に2-3分）

### Step 2: API キー取得

プロジェクト作成後：

1. 左メニュー「Project Settings」→「API」
2. 「API Keys」タブを開く
3. 「Create new API Keys」をクリックして新しいキーを作成
4. 以下をメモ：

| 項目 | 形式 | 用途 |
|------|------|------|
| Project URL | `https://xxxxx.supabase.co` | フロント・バック共通 |
| Publishable key | `sb_publishable_...` | クライアントサイド（公開可） |
| Secret key | `sb_secret_...` | サーバーサイド専用（秘匿） |

> **注意**: `Secret key` は絶対にクライアントに露出させないこと（ブラウザで使用すると401エラー）

#### レガシーキーについて

「Legacy API Keys」タブには従来の `anon` / `service_role` キーがありますが、これらは2025年11月1日以降非推奨となります。新規プロジェクトでは新しいキー形式（`sb_publishable_...` / `sb_secret_...`）を使用してください。

参考: [Supabase API Keys ドキュメント](https://supabase.com/docs/guides/api/api-keys)

### Step 3: pgvector 拡張有効化

1. 左メニュー「Database」→「Extensions」
2. 検索で `vector` を探す
3. 「Enable」をクリック
4. スキーマ選択で **「extensions」** を選択（推奨）
5. 「Enable extension」で確定

> **用途**: Phase 6のRAG機能でマニュアル内容の類似検索に使用予定
>
> **スキーマ選択について**: `extensions`スキーマを選択することで、拡張機能がアプリのテーブルと分離され、管理しやすくなります。`public`スキーマからも問題なく使用できます。

### Step 4: マイグレーション実行

このリポジトリのDBスキーマは **複数マイグレーション（00001〜00006）** で構成されています。  
**00001だけ実行すると、実装（共有マスター方式・共有Storageポリシー）と齟齬が出ます。**

#### 推奨: Supabase CLI で一括適用

```bash
cd backend
npx supabase db push
npx supabase db seed
```

#### 手動: Dashboard の SQL Editor で順番に実行

1. 左メニュー「SQL Editor」→「New query」
2. `backend/supabase/migrations/` のSQLを **昇順で** コピーして順に実行
   - `00001_initial_schema.sql`
   - `00002_manufacturer_domains.sql`
   - `00003_storage_shared_manuals.sql`
   - `00004_shared_appliances_refactor.sql`
   - `00005_create_manuals_bucket.sql`
   - `00006_shared_maintenance_items.sql`

**作成されるテーブル:**

| テーブル | 用途 |
|---------|------|
| `users` | ユーザー設定（通知時刻等） |
| `shared_appliances` | 家電マスター（メーカー・型番・説明書情報の共有） |
| `user_appliances` | ユーザー所有関係（表示名・画像URL） |
| `shared_maintenance_items` | メンテナンス項目の共有キャッシュ |
| `maintenance_schedules` | メンテナンススケジュール |
| `maintenance_logs` | メンテナンス実施記録 |
| `push_subscriptions` | PWAプッシュ通知設定 |
| `categories` | カテゴリマスター |
| `manufacturer_domains` | メーカー公式サイトドメイン（学習） |

詳細は `backend/supabase/SCHEMA.md` を参照。

### Step 5: 初期データ投入

SQL Editorで以下を実行：

```sql
-- カテゴリ初期データ
INSERT INTO categories (name, display_order) VALUES
  ('エアコン・空調', 1),
  ('洗濯・乾燥', 2),
  ('キッチン', 3),
  ('給湯・暖房', 4),
  ('掃除', 5),
  ('住宅設備', 6),
  ('その他', 99)
ON CONFLICT (name) DO NOTHING;
```

### Step 6: Storage バケット作成

現在の実装では、PDFマニュアル保存用に **`manuals` バケット** を使用します。  
バケット作成とRLSポリシーはマイグレーションに含まれています（`00003`, `00005`）。

#### Dashboard で確認する場合

1. 左メニュー「Storage」
2. `manuals` バケットが存在することを確認

#### manuals バケット（PDFマニュアル保存用）

| オプション | 設定 | 値 |
|-----------|:----:|-----|
| Bucket name | - | `manuals` |
| Public bucket | ❌ OFF | 認証済みユーザーのみアクセス |
| Restrict file size | ✅ ON | `50` MB（マニュアルPDFは大きい場合あり） |
| Restrict MIME types | ✅ ON | `application/pdf` |

### Step 6.1: Storage RLS ポリシー（manuals共有）

ポリシーもマイグレーションに含まれています（`00003_storage_shared_manuals.sql`）。  
手動で確認/再適用する場合は SQL Editor で `00003_storage_shared_manuals.sql` を実行してください。

```sql
-- 共有PDFアクセス（認証済みユーザーのみ）
CREATE POLICY "Authenticated users can view manuals"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'manuals'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can upload manuals"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'manuals'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update manuals"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'manuals'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'manuals'
  AND auth.role() = 'authenticated'
);
```

**ファイルパス規則:**

```
manuals/{manufacturer}/{model_number}.pdf
例: manuals/panasonic/abc-123.pdf

※ 実装では Supabase Storage 内のパスは `{manufacturer}/{model_number}.pdf` です
   （バケット名 `manuals` は外側の概念）
```

### Step 7: Auth 設定

1. 左メニュー「Authentication」→「Providers」
2. **Email** が有効になっていることを確認（デフォルトで有効）
3. 「Authentication」→「URL Configuration」で設定：

**開発環境:**

| 項目 | 値 |
|------|-----|
| Site URL | `http://localhost:3000` |
| Redirect URLs | `http://localhost:3000/**` |

**本番環境（後で追加）:**

| 項目 | 値 |
|------|-----|
| Site URL | `https://your-domain.com` |
| Redirect URLs | `https://your-domain.com/**` |

### Step 8: 環境変数設定

#### バックエンド用（プロジェクトルート `.env`）

バックエンドは `backend/app/config.py` でプロジェクトルートの `.env` を参照するよう設定されています。

```bash
# Gemini / Google Search API
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CSE_API_KEY=your_cse_api_key
GOOGLE_CSE_ID=your_cse_id

# Supabase（新キー形式）
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

#### フロントエンド用（`frontend/.env.local`）

Next.js は `frontend/.env.local` を自動で読み込みます。

```bash
# Backend API
BACKEND_URL=http://localhost:8000

# Supabase（クライアントサイド用・新キー形式）
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

> **注意**:
> - `NEXT_PUBLIC_` プレフィックスはクライアントサイドで使用可能な変数を示す
> - `Secret key` はフロントエンドに設定しない（サーバーサイド専用）
> - バックエンド用は `backend/.env` ではなく、プロジェクトルートの `.env` に記載

## 設定確認チェックリスト

| # | タスク | 完了 |
|---|--------|:----:|
| 1 | Supabaseプロジェクト作成 | ⬜ |
| 2 | API キー取得・メモ | ⬜ |
| 3 | pgvector 拡張有効化 | ⬜ |
| 4 | マイグレーション実行 | ⬜ |
| 5 | カテゴリ初期データ投入 | ⬜ |
| 6 | Storage バケット作成（manuals） | ⬜ |
| 7 | Storage RLSポリシー設定 | ⬜ |
| 8 | Auth URL設定確認 | ⬜ |
| 9 | backend/.env 設定 | ⬜ |
| 10 | frontend/.env.local 設定 | ⬜ |

## 動作確認

設定完了後、以下で接続確認：

### 1. サーバー起動

```bash
# バックエンド起動
cd backend && uv run uvicorn app.main:app --reload

# フロントエンド起動（別ターミナル）
cd frontend && npm run dev
```

### 2. 基本動作確認

ブラウザで `http://localhost:3000` にアクセスし、エラーがないことを確認。

### 3. Supabase接続テスト

```bash
curl http://localhost:8000/health/supabase
```

**期待される結果:**

```json
{
    "status": "ok",
    "checks": {
        "env_configured": true,
        "connection": true,
        "categories_table": true
    },
    "details": {
        "url": "https://xxxxx.supabase.co",
        "using_secret_key": true,
        "categories_count": 7,
        "categories": [
            "エアコン・空調",
            "洗濯・乾燥",
            "キッチン",
            "給湯・暖房",
            "掃除",
            "住宅設備",
            "その他"
        ]
    }
}
```

**確認ポイント:**

| チェック項目 | 期待値 | 失敗時の対処 |
|-------------|--------|-------------|
| `status` | `"ok"` | 下記のチェック項目を確認 |
| `env_configured` | `true` | `.env` のSupabase設定を確認 |
| `connection` | `true` | URLとキーが正しいか確認 |
| `categories_table` | `true` | マイグレーションが実行されたか確認 |
| `categories_count` | `7` | 初期データ投入（Step 5）を実行 |

## トラブルシューティング

### categories_count が 0 になる

**原因**: RLSポリシーが `TO authenticated` に設定されており、未認証リクエストではデータが見えない

**確認方法**:
- `using_secret_key` が `true` になっているか確認
- `true` でも0件の場合は初期データ投入（Step 5）を実行

**補足**: これはセキュリティ上正しい動作です。ヘルスチェックではSecret Keyを使用してRLSをバイパスしています。

### RLSエラーが発生する

- テーブルのRLSが有効になっているか確認
- ポリシーが正しく設定されているか確認
- 認証状態（ログイン済みか）を確認

### Storageにアップロードできない

- バケットのRLSポリシーが設定されているか確認
- ファイルパスが `{user_id}/...` 形式になっているか確認

### 環境変数が読み込まれない

- `.env` / `.env.local` ファイルが正しい場所にあるか確認
- サーバー/開発サーバーを再起動

## 参考リンク

- [Supabase ドキュメント](https://supabase.com/docs)
- [Supabase Auth ガイド](https://supabase.com/docs/guides/auth)
- [Supabase Storage ガイド](https://supabase.com/docs/guides/storage)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
