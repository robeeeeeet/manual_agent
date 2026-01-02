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

## ディレクトリ構造

```
manual_agent/
├── CLAUDE.md              # AI向けガイド（このファイル）
├── CHANGELOG.md           # 変更履歴
├── docs/                  # ドキュメント
│   ├── requirements.md    # 要件定義書
│   ├── development-plan.md # 開発計画書
│   ├── supabase-setup.md  # Supabase設定手順書
│   └── notes/             # 技術メモ
├── frontend/              # Next.js アプリケーション
│   ├── src/app/           # App Router（ページ、APIルート）
│   ├── src/components/    # UIコンポーネント
│   ├── src/lib/           # ユーティリティ
│   └── package.json
├── backend/               # FastAPI アプリケーション
│   ├── app/
│   │   ├── api/routes/    # APIルート
│   │   ├── schemas/       # Pydanticスキーマ
│   │   ├── services/      # ビジネスロジック（AI処理）
│   │   └── main.py
│   ├── supabase/          # DBスキーマ・マイグレーション
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

# フロントエンド
cd frontend && npm install   # 依存関係インストール
cd frontend && npm run dev   # 開発サーバー起動 → http://localhost:3000
cd frontend && npm run lint  # Lint実行
cd frontend && npm run build # ビルド

# Phase 0 検証スクリプト（ルートから実行）
uv run python tests/phase0/scripts/test_image_recognition.py <画像>
uv run python tests/phase0/scripts/test_custom_search_api.py
uv run python tests/phase0/scripts/test_maintenance_extraction.py
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

**Phase 1: 基盤構築** ✅ 完了

Phase 0（AI機能検証）とPhase 1（基盤構築）が完了：
- ✅ FastAPI バックエンド（画像認識、説明書検索、メンテナンス抽出API）
- ✅ Next.js 16 フロントエンド（家電登録画面、BFF層）
- ✅ Supabase 設定（DBスキーマ、Auth、Storage、接続テスト）

**次のステップ**: Phase 1.5（デプロイ基盤構築）または Phase 2（認証）

詳細は `docs/development-plan.md` を参照。

## 重要な設計判断

1. **ハイブリッドアーキテクチャ**: フロントエンドは TypeScript (Next.js)、AIバックエンドは Python (LangChain/LangGraph)
2. **AI優先アプローチ**: 手動入力よりAI自動認識を優先
3. **PDF保存方式**: リンク保存ではなくPDFダウンロード保存
4. **カテゴリ**: 事前定義リスト + 自由入力の両対応
5. **Supabase採用**: 認証・DB・ストレージを一元管理、pgvector対応
6. **LangChain/LangGraph採用**: 将来のRAG機能・複雑なエージェントフローに対応
