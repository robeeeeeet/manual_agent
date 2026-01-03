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

## Lint / Format

```bash
# バックエンド（ruff）
cd backend && uv run ruff check app/       # Lint
cd backend && uv run ruff format app/      # Format
cd backend && uv run ruff check app/ --fix # 自動修正

# フロントエンド（ESLint）
cd frontend && npm run lint
```

## デプロイ

```bash
# バックエンド（Cloud Run）- プロジェクトルートから実行
./scripts/deploy-backend.sh          # ビルド & デプロイ
./scripts/deploy-backend.sh build    # ビルドのみ
./scripts/deploy-backend.sh deploy   # デプロイのみ

# シークレット管理
./scripts/setup-secrets.sh           # Secret Manager に登録
./scripts/setup-secrets.sh --list    # シークレット一覧表示

# Workload Identity Federation（初回のみ）
GITHUB_ORG=<username> ./scripts/setup-workload-identity.sh
```
