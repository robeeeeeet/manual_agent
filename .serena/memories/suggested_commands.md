# 開発コマンド一覧

## バックエンド (Python/FastAPI)

```bash
# 依存関係インストール
cd backend && uv sync

# 開発サーバー起動
cd backend && uv run uvicorn app.main:app --reload
# → http://localhost:8000

# テスト実行
cd backend && uv run pytest

# パッケージ追加
cd backend && uv add <package-name>
```

## フロントエンド (Next.js)

```bash
# 依存関係インストール
cd frontend && npm install

# 開発サーバー起動
cd frontend && npm run dev
# → http://localhost:3000

# ビルド
cd frontend && npm run build

# 本番サーバー起動
cd frontend && npm start

# Lint
cd frontend && npm run lint
```

## Phase 0 検証スクリプト（ルートから実行）

```bash
# 画像認識テスト
uv run python tests/phase0/scripts/test_image_recognition.py <画像パス>

# 説明書検索テスト
uv run python tests/phase0/scripts/test_custom_search_api.py

# メンテナンス抽出テスト
uv run python tests/phase0/scripts/test_maintenance_extraction.py
```

## Git

```bash
# ステータス確認
git status

# 差分確認
git diff

# コミット（規約に従う）
git commit -m "<type>: <subject>"
# type: feat, fix, docs, refactor, test, chore
```

## 環境変数

プロジェクトルートの `.env` に設定（`.env.example` を参照）:
- `GEMINI_API_KEY` - Gemini API キー（必須）
- `GOOGLE_CSE_API_KEY` - Google Custom Search API キー
- `GOOGLE_CSE_ID` - Google 検索エンジン ID
- `SUPABASE_URL` - Supabase URL
- `SUPABASE_PUBLISHABLE_KEY` - Supabase Publishable Key
- `SUPABASE_SECRET_KEY` - Supabase Secret Key

フロントエンドは `frontend/.env.local` を使用。
