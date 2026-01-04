# CLAUDE.md - AI向けプロジェクトガイド

このファイルはAIアシスタント（Claude等）がプロジェクトを理解するためのガイドです。

## プロジェクト概要

**説明書管理 & メンテナンスリマインドアプリ**

家電や住宅設備の説明書を管理し、メンテナンス項目をリマインドするWebアプリ。
AIを活用して商品認識・説明書取得・メンテナンス項目抽出を自動化する。

## ドキュメント構成

| ファイル | 内容 |
|---------|------|
| `docs/requirements.md` | 要件定義書（機能要件、技術スタック、データモデル） |
| `docs/development-plan.md` | 開発計画書（フェーズ、タスク管理） |
| `docs/deploy-setup.md` | デプロイ手順書（Vercel, Cloud Run, CI/CD） |
| `docs/supabase-setup.md` | Supabase設定手順書 |
| `CHANGELOG.md` | 変更履歴 |
| `CLAUDE.md` | このファイル（AI向けガイド） |

## アーキテクチャ

**ハイブリッド構成**: Next.js（フロントエンド）+ Python（AIバックエンド）

```
クライアント（ブラウザ/PWA）
        ↓
Next.js 16+ (TypeScript) - UI/BFF層
        ↓ REST API
FastAPI (Python) - AIバックエンド
   ├── LangChain (RAG)
   ├── LangGraph (エージェント)
   └── Gemini API
        ↓
Supabase (PostgreSQL/pgvector/Auth/Storage)
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 16+, TypeScript, Tailwind CSS 4, React 19, PWA |
| BFF層 | Next.js API Routes |
| AIバックエンド | FastAPI, LangChain, LangGraph, Gemini API (google-genai) |
| データベース | Supabase PostgreSQL, pgvector |
| 認証 | Supabase Auth |
| ストレージ | Supabase Storage |
| パッケージ管理 | uv (Python), npm (Node.js) |
| デプロイ（フロント） | Vercel |
| デプロイ（バック） | Google Cloud Run |
| CI/CD | GitHub Actions |

## ディレクトリ構造

```
manual_agent/
├── CLAUDE.md              # AI向けガイド（このファイル）
├── CHANGELOG.md           # 変更履歴
├── docs/                  # ドキュメント
│   ├── requirements.md    # 要件定義書
│   ├── development-plan.md # 開発計画書
│   ├── deploy-setup.md    # デプロイ手順書
│   ├── supabase-setup.md  # Supabase設定手順書
│   └── notes/             # 技術メモ
├── .github/workflows/     # GitHub Actions
│   └── deploy.yml         # CI/CD パイプライン
├── frontend/              # Next.js アプリケーション
│   ├── src/app/           # App Router（ページ、APIルート）
│   │   ├── api/           # BFF層 API Routes
│   │   │   └── appliances/# 家電関連API（CRUD、説明書、メンテナンス）
│   │   ├── auth/callback/ # 認証コールバック
│   │   ├── login/         # ログインページ
│   │   ├── signup/        # 新規登録ページ
│   │   ├── register/      # 家電登録ページ
│   │   └── appliances/    # 家電一覧ページ
│   ├── src/components/    # UIコンポーネント
│   │   ├── auth/          # 認証関連（AuthForm）
│   │   ├── layout/        # Header, Footer
│   │   └── ui/            # Button, Card, Modal
│   ├── src/types/         # 型定義（appliance.ts）
│   ├── src/contexts/      # React Context（AuthContext）
│   ├── src/lib/           # ユーティリティ
│   │   ├── supabase/      # Supabaseクライアント
│   │   └── api.ts         # バックエンドAPIクライアント
│   ├── src/middleware.ts  # Next.js ミドルウェア（ルート保護）
│   └── package.json
├── backend/               # FastAPI アプリケーション
│   ├── app/
│   │   ├── api/routes/    # APIルート（appliances, manuals）
│   │   ├── schemas/       # Pydanticスキーマ
│   │   ├── services/      # ビジネスロジック
│   │   │   ├── image_recognition.py     # 画像認識
│   │   │   ├── manual_search.py         # 説明書検索
│   │   │   ├── maintenance_extraction.py # メンテナンス抽出
│   │   │   ├── appliance_service.py     # 家電CRUD
│   │   │   ├── pdf_storage.py           # PDFストレージ
│   │   │   ├── maintenance_cache_service.py # メンテナンスキャッシュ
│   │   │   ├── supabase_client.py       # Supabaseクライアント
│   │   │   └── manufacturer_domain.py   # メーカードメイン
│   │   └── main.py
│   ├── supabase/          # DBスキーマ・マイグレーション
│   │   ├── SCHEMA.md      # データベーススキーマ設計書
│   │   └── migrations/    # マイグレーションファイル
│   ├── Dockerfile         # Cloud Run 用
│   └── pyproject.toml
├── tests/phase0/          # Phase 0 検証スクリプト（Python）
│   ├── scripts/
│   ├── reports/
│   └── test_pdfs/
└── .env                   # 環境変数（git管理外）
```

## コマンド

```bash
# バックエンド
cd backend && uv sync                              # 依存関係インストール
cd backend && uv run uvicorn app.main:app --reload # 開発サーバー起動 → http://localhost:8000
cd backend && uv run pytest                        # テスト実行
cd backend && uv run ruff check app/               # Lint実行
cd backend && uv run ruff format app/              # フォーマット

# フロントエンド
cd frontend && npm install   # 依存関係インストール
cd frontend && npm run dev   # 開発サーバー起動 → http://localhost:3000
cd frontend && npm run lint  # Lint実行
cd frontend && npm run build # ビルド

# Phase 0 検証スクリプト（ルートから実行）
uv run python tests/phase0/scripts/test_image_recognition.py <画像>
uv run python tests/phase0/scripts/test_custom_search_api.py
uv run python tests/phase0/scripts/test_maintenance_extraction.py

# デプロイ（プロジェクトルートから実行）
./scripts/deploy-backend.sh          # ビルド & Cloud Run デプロイ
./scripts/deploy-backend.sh build    # ビルドのみ
./scripts/deploy-backend.sh deploy   # デプロイのみ
./scripts/setup-secrets.sh           # Secret Manager にシークレット登録
./scripts/setup-secrets.sh --list    # シークレット一覧表示
```

## 環境変数

```bash
# プロジェクトルート .env に設定（バックエンド用）
GEMINI_API_KEY=              # Gemini API キー（必須）
GOOGLE_CSE_API_KEY=          # Google Custom Search API キー
GOOGLE_CSE_ID=               # Google 検索エンジン ID
SUPABASE_URL=                # Supabase URL
SUPABASE_PUBLISHABLE_KEY=    # Supabase Publishable Key（sb_publishable_...）
SUPABASE_SECRET_KEY=         # Supabase Secret Key（sb_secret_...）

# frontend/.env.local に設定（フロントエンド用）
BACKEND_URL=                         # バックエンドAPI URL（http://localhost:8000）
NEXT_PUBLIC_SUPABASE_URL=            # Supabase URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= # Supabase Publishable Key
```

## 開発規約

### コミットメッセージ

```
<type>: <subject>

<body>
```

**type**:
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `refactor`: リファクタリング
- `test`: テスト
- `chore`: その他

### ブランチ戦略

- `master`: 本番ブランチ
- `feature/*`: 機能開発ブランチ
- `fix/*`: バグ修正ブランチ

### フロントエンド開発

フロントエンドの開発を行う場合は、skills の `frontend-design` を活用すること。
このスキルには、プロダクショングレードのUI実装パターンとデザインガイドラインが含まれている。

**スキルの動作:**
- スキルはコマンドではなく、会話の文脈から**自動的にトリガー**される
- 「コンポーネントを作成」「ページを実装」「UIを構築」などのリクエストで発動
- 発動条件は各スキルの `SKILL.md` の `description` フィールドで定義

### 実装後のテスト

フロントエンド機能の実装後は、**Playwright MCP** を使用してブラウザ上での動作確認を行うこと。
詳細なテストパターンは skills の `webapp-testing` を参照。

**スキルの発動条件:**
- 「動作確認して」「テストして」「ブラウザで確認」などのリクエストで自動発動

**テスト時の注意点:**
- HEICなど特殊フォーマットのファイルアップロードもテスト対象に含める
- API連携を含むE2Eフローを確認する
- エラーケース（API失敗、バリデーションエラー等）も確認する

## 現在のステータス

**Phase 3: 家電登録・説明書取得** 🚧 進行中

### 完了済み
- ✅ Phase 0〜2: 基盤構築、デプロイ、認証
- ✅ データベース設計リファクタリング（共有マスター方式）
  - `shared_appliances`（家電マスター）+ `user_appliances`（所有関係）
  - `shared_maintenance_items`（メンテナンス項目キャッシュ）
- ✅ バックエンドAPI実装（家電CRUD、PDFストレージ、メンテナンスキャッシュ）
- ✅ フロントエンドBFF層（家電登録・説明書・メンテナンス全フロー）
- ✅ 家電一覧ページ、Modalコンポーネント、型定義

### 進行中
- ⚪ 家電登録画面のUI完成（ラベル位置ガイド、手動入力、カテゴリ選択）
- ⚪ 家電詳細画面
- ⚪ メンテナンス項目選択UI

**本番URL:** https://manual-agent-seven.vercel.app/

詳細は `docs/development-plan.md` および `backend/supabase/SCHEMA.md` を参照。

## 重要な設計判断

1. **ハイブリッドアーキテクチャ**: フロントエンドは TypeScript (Next.js)、AIバックエンドは Python (LangChain/LangGraph)
2. **AI優先アプローチ**: 手動入力よりAI自動認識を優先
3. **PDF保存方式**: リンク保存ではなくPDFダウンロード保存（Supabase Storage）
4. **カテゴリ**: 事前定義リスト + 自由入力の両対応
5. **Supabase採用**: 認証・DB・ストレージを一元管理、pgvector対応
6. **LangChain/LangGraph採用**: 将来のRAG機能・複雑なエージェントフローに対応
7. **デプロイ構成**: Vercel（Next.js最適化）+ Cloud Run（無料枠大、自動スケール）+ GitHub Actions（CI/CD）
8. **共有マスター方式**: 同一メーカー・型番の家電は`shared_appliances`で共有し、ユーザー所有関係は`user_appliances`で管理
9. **メンテナンスキャッシュ**: LLM抽出結果を`shared_maintenance_items`にキャッシュし、2人目以降のLLMコスト・処理時間を削減
