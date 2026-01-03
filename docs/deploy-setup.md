# デプロイセットアップガイド

このドキュメントでは、Vercel（フロントエンド）と Google Cloud Run（バックエンド）へのデプロイ手順を説明します。

---

## 目次

1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [前提条件](#前提条件)
3. [バックエンド: Google Cloud Run](#バックエンド-google-cloud-run)
4. [フロントエンド: Vercel](#フロントエンド-vercel)
5. [CI/CD: GitHub Actions](#cicd-github-actions)
6. [動作確認](#動作確認)
7. [トラブルシューティング](#トラブルシューティング)

---

## アーキテクチャ概要

```
┌──────────────────────────────────────────────────────────────────┐
│                         ユーザー（ブラウザ/PWA）                    │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Vercel（フロントエンド）                       │
│  ┌─────────────────┐    ┌─────────────────┐                      │
│  │   Next.js       │    │   API Routes    │                      │
│  │   (React/SSR)   │    │   (BFF層)       │                      │
│  └─────────────────┘    └────────┬────────┘                      │
│                                  │                               │
│  URL: https://your-app.vercel.app                                │
└──────────────────────────────────┼───────────────────────────────┘
                                   │ REST API
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Google Cloud Run（バックエンド）                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      FastAPI                                │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐               │ │
│  │  │ 画像認識   │  │ PDF検索   │  │ メンテ抽出 │               │ │
│  │  │ /recognize│  │ /search   │  │ /extract  │               │ │
│  │  └───────────┘  └───────────┘  └───────────┘               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  URL: https://manual-agent-api-xxxxx-an.a.run.app               │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│        Gemini API           │   │         Supabase            │
│   (AI処理: 認識/抽出)        │   │   (DB/Auth/Storage)         │
└─────────────────────────────┘   └─────────────────────────────┘
```

### 選定理由

| コンポーネント | サービス | 理由 |
|---------------|----------|------|
| フロントエンド | Vercel | Next.js開発元、最適化済み、無料枠十分 |
| バックエンド | Cloud Run | 無料枠大きい、自動スケール、GCP連携 |
| DB/Auth | Supabase | 既存利用、PostgreSQL + Auth + Storage |

### コスト見積もり

| サービス | 無料枠 | 想定月額 |
|----------|--------|---------|
| Vercel | 100GB帯域、6000分ビルド | $0 |
| Cloud Run | 200万リクエスト、360,000 GB-秒 | $0 |
| Supabase | 500MB DB、1GB Storage | $0 |
| **合計** | - | **$0/月**（開発〜小規模運用） |

---

## 前提条件

### 必要なアカウント

- [ ] GitHub アカウント（リポジトリをホスト）
- [ ] Google Cloud アカウント（Cloud Run 用）
- [ ] Vercel アカウント（フロントエンド用）
- [ ] Supabase アカウント（既存）

### 必要なツール

```bash
# Google Cloud CLI
# macOS
brew install google-cloud-sdk

# Linux (Debian/Ubuntu)
curl https://sdk.cloud.google.com | bash

# Windows
# https://cloud.google.com/sdk/docs/install からインストーラーをダウンロード

# 初期設定
gcloud init
gcloud auth login
```

---

## バックエンド: Google Cloud Run

### ステップ 1: GCP プロジェクト作成

```bash
# プロジェクト作成
gcloud projects create manual-agent-prod --name="Manual Agent"

# プロジェクトを選択
gcloud config set project manual-agent-prod

# 課金を有効化（無料枠内でも必要）
# https://console.cloud.google.com/billing でプロジェクトにリンク
```

### ステップ 2: 必要な API を有効化

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

### ステップ 3: Dockerfile 作成

`backend/Dockerfile` を作成:

```dockerfile
# Python 3.12 slim イメージ
FROM python:3.12-slim

# 作業ディレクトリ
WORKDIR /app

# システム依存関係（PDF処理等に必要な場合）
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# uv をインストール
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# 依存関係ファイルをコピー
COPY pyproject.toml uv.lock ./

# 依存関係をインストール（--system で仮想環境を使わない）
RUN uv sync --frozen --no-dev --no-editable

# アプリケーションコードをコピー
COPY app ./app

# ポート設定（Cloud Run は PORT 環境変数を使用）
ENV PORT=8080
EXPOSE 8080

# FastAPI 起動
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### ステップ 4: .dockerignore 作成

`backend/.dockerignore` を作成:

```
__pycache__
*.pyc
*.pyo
.git
.gitignore
.env
.env.*
*.md
tests/
.pytest_cache/
.mypy_cache/
.ruff_cache/
```

### ステップ 5: Artifact Registry リポジトリ作成

```bash
# リポジトリ作成（東京リージョン）
gcloud artifacts repositories create manual-agent-repo \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="Manual Agent Docker images"

# Docker 認証設定
gcloud auth configure-docker asia-northeast1-docker.pkg.dev
```

### ステップ 6: イメージをビルド＆プッシュ

```bash
cd backend

# イメージをビルド
docker build -t asia-northeast1-docker.pkg.dev/manual-agent-prod/manual-agent-repo/api:latest .

# イメージをプッシュ
docker push asia-northeast1-docker.pkg.dev/manual-agent-prod/manual-agent-repo/api:latest
```

**Cloud Build を使う場合（ローカル Docker 不要）:**

```bash
cd backend

gcloud builds submit \
  --tag asia-northeast1-docker.pkg.dev/manual-agent-prod/manual-agent-repo/api:latest
```

### ステップ 7: Secret Manager に機密情報を登録

```bash
# シークレット作成
echo -n "<REDACTED_GEMINI_API_KEY>" | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n "<REDACTED_GOOGLE_CSE_API_KEY>" | gcloud secrets create GOOGLE_CSE_API_KEY --data-file=-
echo -n "<REDACTED_GOOGLE_CSE_ID>" | gcloud secrets create GOOGLE_CSE_ID --data-file=-
echo -n "https://<YOUR_PROJECT_REF>.supabase.co" | gcloud secrets create SUPABASE_URL --data-file=-
echo -n "sb_publishable_..." | gcloud secrets create SUPABASE_PUBLISHABLE_KEY --data-file=-
echo -n "sb_secret_..." | gcloud secrets create SUPABASE_SECRET_KEY --data-file=-
```

### ステップ 8: Cloud Run サービスをデプロイ

```bash
gcloud run deploy manual-agent-api \
  --image asia-northeast1-docker.pkg.dev/manual-agent-prod/manual-agent-repo/api:latest \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,GOOGLE_CSE_API_KEY=GOOGLE_CSE_API_KEY:latest,GOOGLE_CSE_ID=GOOGLE_CSE_ID:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_PUBLISHABLE_KEY=SUPABASE_PUBLISHABLE_KEY:latest,SUPABASE_SECRET_KEY=SUPABASE_SECRET_KEY:latest"
```

デプロイ完了後、URL が表示されます:
```
Service URL: https://manual-agent-api-xxxxx-an.a.run.app
```

### ステップ 9: CORS 設定

`backend/app/main.py` の CORS 設定を更新:

```python
from fastapi.middleware.cors import CORSMiddleware

# 本番環境用 CORS 設定
origins = [
    "http://localhost:3000",  # ローカル開発
    "https://your-app.vercel.app",  # Vercel 本番
    "https://*.vercel.app",  # Vercel プレビュー
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## フロントエンド: Vercel

### ステップ 1: Vercel アカウント作成

1. https://vercel.com にアクセス
2. 「Sign Up」→「Continue with GitHub」
3. GitHub 連携を承認

### ステップ 2: プロジェクトをインポート

1. Vercel ダッシュボードで「Add New...」→「Project」
2. GitHub リポジトリ「manual_agent」を選択
3. 以下を設定:
   - **Framework Preset**: Next.js（自動検出）
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`（デフォルト）
   - **Output Directory**: `.next`（デフォルト）

### ステップ 3: 環境変数を設定

Vercel プロジェクト設定 → Environment Variables:

| 変数名 | 値 | Environment |
|--------|-----|-------------|
| `BACKEND_URL` | `https://manual-agent-api-xxxxx-an.a.run.app` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable Key | Production, Preview, Development |

### ステップ 4: デプロイ

1. 「Deploy」をクリック
2. ビルドログを確認
3. 完了後、URL が発行される: `https://your-app.vercel.app`

### ステップ 5: プレビューデプロイ確認

- PR を作成すると、自動的にプレビュー URL が生成される
- 例: `https://manual-agent-git-feature-xxx-username.vercel.app`

---

## CI/CD: GitHub Actions

### ワークフロー作成

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

env:
  GCP_PROJECT_ID: manual-agent-prod
  GCP_REGION: asia-northeast1
  SERVICE_NAME: manual-agent-api
  IMAGE_NAME: asia-northeast1-docker.pkg.dev/manual-agent-prod/manual-agent-repo/api

jobs:
  # フロントエンド: Lint & Type Check
  frontend-check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run build

  # バックエンド: Lint & Test
  backend-check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv sync --dev
      - run: uv run ruff check app/
      - run: uv run ruff format --check app/
      # - run: uv run pytest  # テストがある場合

  # バックエンド: Cloud Run デプロイ（main ブランチのみ）
  deploy-backend:
    needs: [frontend-check, backend-check]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: ${{ env.GCP_PROJECT_ID }}

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.GCP_REGION }}-docker.pkg.dev

      - name: Build and Push
        working-directory: backend
        run: |
          docker build -t ${{ env.IMAGE_NAME }}:${{ github.sha }} .
          docker push ${{ env.IMAGE_NAME }}:${{ github.sha }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image ${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --region ${{ env.GCP_REGION }} \
            --platform managed
```

### GitHub Secrets 設定

リポジトリ Settings → Secrets and variables → Actions:

| Secret 名 | 説明 |
|-----------|------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity プロバイダー |
| `GCP_SERVICE_ACCOUNT` | サービスアカウントのメールアドレス |

### Workload Identity Federation 設定（推奨）

サービスアカウントキーの代わりに Workload Identity を使用:

```bash
# サービスアカウント作成
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# 権限付与
gcloud projects add-iam-policy-binding manual-agent-prod \
  --member="serviceAccount:github-actions@manual-agent-prod.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding manual-agent-prod \
  --member="serviceAccount:github-actions@manual-agent-prod.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding manual-agent-prod \
  --member="serviceAccount:github-actions@manual-agent-prod.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Workload Identity Pool 作成
gcloud iam workload-identity-pools create github-pool \
  --location="global" \
  --display-name="GitHub Pool"

# プロバイダー作成
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# サービスアカウントへのバインディング
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@manual-agent-prod.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_USERNAME/manual_agent"
```

---

## 動作確認

### 1. Cloud Run ヘルスチェック

```bash
curl https://manual-agent-api-xxxxx-an.a.run.app/health
# {"status": "healthy"}

curl https://manual-agent-api-xxxxx-an.a.run.app/health/supabase
# {"status": "connected", "timestamp": "..."}
```

### 2. Vercel → Cloud Run 疎通確認

ブラウザで Vercel URL にアクセスし、家電登録画面で画像をアップロード。
API 呼び出しが成功すれば OK。

### 3. コンソールログ確認

**Cloud Run:**
```bash
gcloud run services logs read manual-agent-api --region asia-northeast1
```

**Vercel:**
Vercel ダッシュボード → プロジェクト → Logs

---

## トラブルシューティング

### Cloud Run がデプロイできない

```bash
# ビルドログ確認
gcloud builds list --limit=5

# 詳細ログ
gcloud builds log BUILD_ID
```

### CORS エラー

1. Cloud Run の CORS 設定を確認
2. Vercel のドメインが許可リストに含まれているか確認
3. プレビュー URL（`*.vercel.app`）もワイルドカードで許可

### コールドスタートが遅い

Cloud Run は `min-instances=0` だとコールドスタートが発生:

```bash
# 最小インスタンス数を 1 に設定（課金が発生）
gcloud run services update manual-agent-api \
  --min-instances 1 \
  --region asia-northeast1
```

### Secret Manager のエラー

```bash
# シークレットが存在するか確認
gcloud secrets list

# シークレットの値を確認（注意: 本番では避ける）
gcloud secrets versions access latest --secret=GEMINI_API_KEY
```

---

## 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [GitHub Actions for GCP](https://github.com/google-github-actions)
