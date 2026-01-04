# Changelog

このプロジェクトのすべての注目すべき変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいています。
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

## [Unreleased]

### Added

#### Phase 2: 認証機能 ✅
- Supabase Auth連携（@supabase/ssr）
- ログイン/新規登録画面（AuthFormコンポーネント）
- 認証状態管理（AuthContext/AuthProvider）
- ミドルウェアによるルート保護
- メール確認コールバック処理

#### Phase 3: 家電登録・説明書取得 🚧

**データベース**
- `shared_appliances` テーブル: 家電マスターデータ（メーカー・型番・説明書情報）
- `user_appliances` テーブル: ユーザーの所有関係（表示名・画像）
- `shared_maintenance_items` テーブル: LLM抽出結果のキャッシュ
- `manufacturer_domains` テーブル: メーカー公式サイトドメイン管理
- Supabase Storage `manuals` バケット: 共有PDF保存
- マイグレーション 00002〜00006

**バックエンドサービス**
- `appliance_service.py`: 家電CRUD操作（共有家電の取得/作成、ユーザー家電の管理）
- `pdf_storage.py`: PDFダウンロード・アップロード、公開/署名付きURL生成
- `maintenance_cache_service.py`: メンテナンス項目キャッシュ取得・保存
- `supabase_client.py`: Supabaseクライアント
- `manufacturer_domain.py`: メーカードメイン管理

**バックエンドAPI**
- `POST /api/v1/appliances/register` - 家電登録（ユーザー所有関係を作成）
- `GET /api/v1/appliances` - 家電一覧取得
- `GET /api/v1/appliances/{id}` - 家電詳細取得
- `PATCH /api/v1/appliances/{id}` - 家電更新
- `DELETE /api/v1/appliances/{id}` - 家電削除
- `POST /api/v1/manuals/check-existing` - 既存PDFチェック（共有）
- `POST /api/v1/manuals/confirm` - 説明書確認・PDF保存（共有）+ ドメイン学習

**フロントエンドBFF層**
- `/api/appliances/register` - 家電登録
- `/api/appliances/check-existing` - 既存家電チェック
- `/api/appliances/confirm-manual` - 説明書確認・PDF保存
- `/api/appliances/search-manual-stream` - 説明書検索（ストリーミング）
- `/api/appliances/maintenance-items/[sharedApplianceId]` - メンテナンス項目取得
- `/api/appliances/extract-maintenance` - メンテナンス抽出
- `/api/appliances/maintenance-schedules/register` - スケジュール登録
- `/api/appliances/[id]` - 家電詳細・削除

**フロントエンドUI**
- `/appliances` ページ（家電一覧）
- `Modal` コンポーネント
- `src/types/appliance.ts` 型定義ファイル
- `src/lib/api.ts` バックエンドAPIクライアント

### Changed
- **データベース設計: 家電情報の共有マスター方式への移行**
  - `appliances` テーブルを `shared_appliances`（家電マスター）と `user_appliances`（所有関係）に分離
  - 同じ家電（同一メーカー・型番）の説明書PDFを複数ユーザーで共有可能に
  - `maintenance_schedules.appliance_id` → `user_appliance_id` へ変更
  - RLSポリシーを全面的に再設計（共有マスターは全ユーザー閲覧可能）
- バックエンドに家電CRUD APIを追加（`/api/appliances`）
  - 実装上のプレフィックスは `/api/v1`（`/api/v1/appliances`）
- フロントエンドBFF層に家電管理APIルートを追加
- Headerコンポーネントに認証UI追加（ログイン/ログアウト表示切替）
- `manual_search.py`: ストリーミング検索対応
- `maintenance_extraction.py`: キャッシュサービス連携

### Removed
- `frontend/src/app/api/appliances/search-manual/route.ts` - ストリーミング版に置き換え

### Migration Notes
- **破壊的変更**: マイグレーション 00002〜00006 の適用が必要
- 既存データがある場合は事前にバックアップを推奨
- `supabase db push` でリモートDBにマイグレーション適用

### Technical Notes
- **共有マスター方式**: 同じ家電（同一メーカー・型番）の情報を1レコードで管理し、複数ユーザーで共有
- **メンテナンスキャッシュ**: LLM抽出は1家電1回のみ、2人目以降は即座に項目取得可能（コスト削減）
- **PDFストレージ**: Supabase Storageの `manuals` バケットに保存、署名付きURL for 一時アクセス
- **ストリーミング検索（SSE）**: 検索の進捗状況をリアルタイムでフロントエンドに送信
- **再検索機能**: `excluded_urls`, `skip_domain_filter`, `cached_candidates` パラメータで再検索をサポート
- **メーカードメイン学習**: PDFが見つかったドメインを記録し、次回検索で優先的に使用
- **並行検索制限**: `max_concurrent_searches` (デフォルト5) で同時検索数を制限

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
- AI処理はPythonバックエンドで実行（Gemini API / google-genai）

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
