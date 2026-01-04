# Changelog

このプロジェクトのすべての注目すべき変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいています。
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

## [Unreleased]

### Added

#### Phase 5: 通知・PWA 🔄 テスト中

**PWA基盤**
- `manifest.json`: アプリ名、アイコン、テーマカラー設定
- Service Worker（`sw.js`、`custom-sw.js`）
- PWAアイコン（192x192, 512x512, apple-touch-icon）
- next-pwa 設定（本番時のみ有効）

**バックエンドサービス**
- `push_subscription_service.py`: Push購読管理（subscribe/unsubscribe）
- `notification_service.py`: Web Push送信（pywebpush）
- `maintenance_notification_service.py`: メンテナンスリマインド通知
- `push_subscriptions` テーブル（Supabase）

**バックエンドAPI**
- `POST /api/v1/push/subscribe` - Push購読登録
- `POST /api/v1/push/unsubscribe` - Push購読解除
- `GET /api/v1/push/vapid-public-key` - VAPID公開鍵取得
- `POST /api/v1/notifications/test` - テスト通知送信
- `POST /api/v1/notifications/reminders` - リマインド送信

**フロントエンドBFF層**
- `/api/push/subscribe` - 購読登録
- `/api/push/unsubscribe` - 購読解除
- `/api/push/vapid-public-key` - VAPID公開鍵取得
- `/api/push/test` - テスト通知送信
- `/api/notifications/reminders` - リマインド送信

**フロントエンドUI**
- `NotificationPermission.tsx`: 通知許可リクエストUI
- `serviceWorker.ts`: Service Worker登録ユーティリティ
- `src/hooks/` ディレクトリ

**ユーティリティ**
- `scripts/generate-vapid-keys.py`: VAPID鍵生成スクリプト

#### Phase 4: メンテナンス管理 ✅

**バックエンドサービス**
- `maintenance_log_service.py`: メンテナンス完了記録・履歴取得
  - `complete_maintenance()` - 完了記録・次回日再計算
  - `get_maintenance_logs()` - 履歴取得（ページネーション対応）
  - `get_upcoming_maintenance()` - 期限間近の項目取得
  - `get_appliance_next_maintenance()` - 家電別次回メンテナンス取得

**バックエンドAPI**
- `POST /api/v1/appliances/schedules/{schedule_id}/complete` - メンテナンス完了記録
- `GET /api/v1/appliances/schedules/{schedule_id}/logs` - 履歴取得
- `GET /api/v1/appliances/maintenance/upcoming` - 期限間近のメンテナンス取得

**フロントエンドBFF層**
- `/api/appliances/maintenance-schedules/[id]/complete` - 完了記録API
- `/api/appliances/maintenance-schedules/[id]/logs` - 履歴取得API

**フロントエンドUI**
- 家電詳細画面（`/appliances/[id]`）
  - メンテナンス項目に「完了」ボタン追加
  - 完了確認モーダル（メモ入力対応）
  - 最終完了日表示（`last_done_at`）
  - 履歴表示モーダル（「履歴を表示」ボタン）
- 家電一覧画面（`/appliances`）
  - 次回メンテナンス日バッジ表示
  - 色分け表示（期限切れ: 赤、間近: 黄、余裕あり: 緑）

#### Phase 2: 認証機能 ✅
- Supabase Auth連携（@supabase/ssr）
- ログイン/新規登録画面（AuthFormコンポーネント）
- 認証状態管理（AuthContext/AuthProvider）
- ミドルウェアによるルート保護
- メール確認コールバック処理

#### Phase 3: 家電登録・説明書取得 ✅

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
- **メンテナンス完了記録**: 完了時にメモを記録し、次回日を自動再計算
- **次回メンテナンス表示**: 期限までの日数に応じた色分けバッジ（赤:期限切れ、黄:7日以内、緑:余裕あり）
- **PWA対応**: next-pwaによるService Worker管理、オフライン対応の基盤
- **Web Push通知**: pywebpush + VAPID認証によるセキュアなPush通知配信
- **メンテナンスリマインド**: 期限当日・期限間近の項目を自動で通知

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
