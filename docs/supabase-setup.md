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

1. 左メニュー「SQL Editor」→「New query」
2. `backend/supabase/migrations/00001_initial_schema.sql` の内容をコピー
3. SQL Editorに貼り付けて「Run」をクリック

**作成されるテーブル:**

| テーブル | 用途 |
|---------|------|
| `users` | ユーザー設定（通知時刻等） |
| `appliances` | 家電・設備情報 |
| `maintenance_schedules` | メンテナンススケジュール |
| `maintenance_logs` | メンテナンス実施記録 |
| `push_subscriptions` | PWAプッシュ通知設定 |
| `categories` | カテゴリマスター |

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

1. 左メニュー「Storage」
2. 「New bucket」で以下を作成：

#### manuals バケット（PDFマニュアル保存用）

| オプション | 設定 | 値 |
|-----------|:----:|-----|
| Bucket name | - | `manuals` |
| Public bucket | ❌ OFF | 認証済みユーザーのみアクセス |
| Restrict file size | ✅ ON | `50` MB（マニュアルPDFは大きい場合あり） |
| Restrict MIME types | ✅ ON | `application/pdf` |

#### images バケット（家電画像保存用）

家電の識別写真やラベル写真を保存。家電一覧画面でのサムネイル表示に使用。

| オプション | 設定 | 値 |
|-----------|:----:|-----|
| Bucket name | - | `images` |
| Public bucket | ❌ OFF | 認証済みユーザーのみアクセス |
| Restrict file size | ✅ ON | `10` MB |
| Restrict MIME types | ✅ ON | `image/jpeg, image/png, image/gif, image/webp, image/heic, image/heif` |

3. 各バケットの「Policies」タブでRLSポリシーを追加

**manuals バケット用ポリシー:**

SQL Editorで以下を実行：

```sql
-- SELECT ポリシー: ユーザーは自分のファイルのみ閲覧可能
CREATE POLICY "Users can view own manuals"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'manuals'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- INSERT ポリシー: ユーザーは自分のフォルダにのみアップロード可能
CREATE POLICY "Users can upload own manuals"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'manuals'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE ポリシー: ユーザーは自分のファイルのみ削除可能
CREATE POLICY "Users can delete own manuals"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'manuals'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**images バケット用ポリシー:**

```sql
-- SELECT ポリシー
CREATE POLICY "Users can view own images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- INSERT ポリシー
CREATE POLICY "Users can upload own images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE ポリシー
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**ファイルパス規則:**

```
{bucket_name}/{user_id}/{appliance_id}/filename.ext
例: manuals/550e8400-e29b-41d4-a716-446655440000/abc123/manual.pdf
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
| 6 | Storage バケット作成（manuals, images） | ⬜ |
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
