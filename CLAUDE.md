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
Next.js 14+ (TypeScript) - UI/BFF層
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
| フロントエンド | Next.js 14+, TypeScript, Tailwind CSS, PWA |
| BFF層 | Next.js API Routes |
| AIバックエンド | FastAPI, LangChain, LangGraph, Gemini API |
| データベース | Supabase PostgreSQL, pgvector |
| 認証 | Supabase Auth |
| ストレージ | Supabase Storage / GCS |
| パッケージ管理 | uv (Python), npm (Node.js) |

## ディレクトリ構造（計画）

```
manual_agent/
├── CLAUDE.md              # AI向けガイド（このファイル）
├── CHANGELOG.md           # 変更履歴
├── docs/
│   ├── requirements.md    # 要件定義書
│   └── development-plan.md # 開発計画書
├── frontend/              # Next.js アプリケーション（Phase 1で作成）
│   ├── app/
│   ├── components/
│   └── package.json
├── backend/               # FastAPI アプリケーション（Phase 1で作成）
│   ├── app/
│   │   ├── api/
│   │   ├── services/
│   │   └── main.py
│   └── pyproject.toml
├── tests/phase0/          # Phase 0 検証スクリプト（Python）
│   ├── scripts/
│   ├── reports/
│   └── test_pdfs/
└── .env                   # 環境変数（git管理外）
```

## コマンド

```bash
# Phase 0 検証スクリプト（現在）
uv sync                    # 依存関係インストール
uv run python tests/phase0/scripts/test_image_recognition.py <画像>
uv run python tests/phase0/scripts/test_custom_search_api.py
uv run python tests/phase0/scripts/test_maintenance_extraction.py

# Phase 1 以降（将来）
# フロントエンド
cd frontend && npm run dev

# バックエンド
cd backend && uv run uvicorn app.main:app --reload
```

## 環境変数

```bash
# .env に設定が必要
GEMINI_API_KEY=           # Gemini API キー（必須）
GOOGLE_CSE_API_KEY=       # Google Custom Search API キー
GOOGLE_CSE_ID=            # Google 検索エンジン ID
SUPABASE_URL=             # Supabase URL（Phase 1以降）
SUPABASE_ANON_KEY=        # Supabase Anonymous Key（Phase 1以降）
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

## 現在のステータス

**Phase 0: フィジビリティ確認** ✅ 完了（Go判定）

コアAI機能の検証が完了し、実現可能性を確認済み：
1. ✅ 画像からのメーカー・型番読み取り（100%成功率）
2. ✅ メーカー・型番からマニュアルPDF取得（100%成功率）
3. ✅ マニュアルからメンテナンス項目抽出（100%成功率、70件抽出）

**次のステップ**: Phase 1（基盤構築）

詳細は `docs/development-plan.md` を参照。

## 重要な設計判断

1. **ハイブリッドアーキテクチャ**: フロントエンドは TypeScript (Next.js)、AIバックエンドは Python (LangChain/LangGraph)
2. **AI優先アプローチ**: 手動入力よりAI自動認識を優先
3. **PDF保存方式**: リンク保存ではなくPDFダウンロード保存
4. **カテゴリ**: 事前定義リスト + 自由入力の両対応
5. **Supabase採用**: 認証・DB・ストレージを一元管理、pgvector対応
6. **LangChain/LangGraph採用**: 将来のRAG機能・複雑なエージェントフローに対応
