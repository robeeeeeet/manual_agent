# Changelog

このプロジェクトのすべての注目すべき変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいています。
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

## [Unreleased]

### Added
- Phase 2: 認証機能
  - Supabase Auth連携（@supabase/ssr）
  - ログイン/新規登録画面（AuthFormコンポーネント）
  - 認証状態管理（AuthContext/AuthProvider）
  - ミドルウェアによるルート保護
  - メール確認コールバック処理

### Changed
- Headerコンポーネントに認証UI追加（ログイン/ログアウト表示切替）

---

## [0.3.0] - 2025-01-02

### Added
- Phase 1.5: デプロイ基盤構築
  - Vercelデプロイ（フロントエンド）
  - Cloud Runデプロイ（バックエンド）
  - GitHub Actions CI/CDパイプライン
  - Workload Identity Federation設定
  - デプロイスクリプト（`scripts/deploy-backend.sh`、`scripts/setup-secrets.sh`）

### Technical Notes
- 本番URL: https://manual-agent-seven.vercel.app/
- バックエンドAPI: Cloud Run（自動スケール）

---

## [0.2.0] - 2025-01-01

### Added
- Phase 1: 基盤構築（ハイブリッドアーキテクチャ）
  - FastAPIバックエンド
    - 画像認識API（`/api/v1/appliances/recognize`）
    - 説明書検索API（`/api/v1/manuals/search`）
    - メンテナンス抽出API（`/api/v1/manuals/extract-maintenance`）
    - HEIC変換API（`/api/v1/appliances/convert-heic`）
  - Next.js 16フロントエンド
    - 基本レイアウト（Header, Footer, Button, Card）
    - 家電登録画面（画像アップロード → AI解析）
    - BFF層 API Routes
    - HEICプレビュー対応
  - Supabase設定
    - PostgreSQLスキーマ
    - pgvector拡張
    - Auth設定（メール認証）
    - Storageバケット（manuals, images）
    - RLSポリシー

### Technical Notes
- ハイブリッドアーキテクチャ: Next.js（TypeScript）+ FastAPI（Python）
- AI処理はPythonバックエンドで実行（LangChain/LangGraph対応）

---

## [0.1.0] - 2025-01-01

### Added
- Phase 0 フィジビリティ確認完了
  - Gemini APIを使用した画像からのメーカー・型番読み取り機能の検証
  - メーカー・型番からマニュアルPDF取得機能の検証
  - マニュアルからメンテナンス項目抽出機能の検証
- プロジェクト初期設定
  - Python環境セットアップ（uv + pyproject.toml）
  - 要件定義書の作成

### Technical Notes
- 3つのコアAI機能（画像認識、PDF取得、メンテナンス抽出）の実現可能性を確認
- Gemini APIの無料枠（60 QPM）で十分対応可能と判断
