# 説明書管理 & メンテナンスリマインドアプリ - 開発計画書

## 概要

このドキュメントでは、プロジェクトの開発フェーズとタスク管理について記載します。
要件の詳細は [requirements.md](./requirements.md) を参照してください。

---

## 開発フェーズ

### Phase 0: フィジビリティ確認 ✅ 完了

このアプリの成否を決めるAI機能の実現可能性を検証。**Go判定**。

#### 0-1. 画像からのメーカー・型番読み取り（成功率: 100%）
- [x] 家電の写真（ラベル含む）をGeminiに送信
- [x] メーカー名・型番を正確に抽出できるか検証
- [x] 外観から商品を推測し、ラベル位置を指示できるか検証
- [x] 複数の家電カテゴリでテスト（4製品: オーブンレンジ、電気ポット、炊飯器、トースター）

#### 0-2. メーカー・型番からマニュアルPDF取得（成功率: 100%）
- [x] メーカー名・型番からWeb検索でPDFを見つけられるか
- [x] Gemini + Web検索の組み合わせで自動取得が可能か
- [x] 取得成功率の検証（日立、象印、タイガー: 4/4成功）

#### 0-3. マニュアルからメンテナンス項目抽出（成功率: 100%）
- [x] PDFをGeminiに読み込ませてメンテナンス項目を抽出
- [x] 周期（月1回、年1回など）を正確に抽出できるか
- [x] 複数のマニュアルでテスト（4製品、合計70件抽出）

#### Phase 0の成果物
- [x] 各検証の成功率レポート → `tests/phase0/reports/`
- [x] 実装上の課題と対策 → 各レポート内に記載
- [x] Go/No-Go判断 → **Go判定**

詳細: `tests/phase0/reports/REPORT_PHASE0_SUMMARY.md`

---

### Phase 1: 基盤構築（ハイブリッドアーキテクチャ） ✅ 完了

#### 1-1. プロジェクト構造セットアップ
- [x] モノレポ構成の作成
  ```
  manual_agent/
  ├── frontend/          # Next.js
  ├── backend/           # FastAPI
  └── tests/phase0/      # 既存検証スクリプト
  ```

#### 1-2. Python バックエンド（FastAPI）
- [x] FastAPI プロジェクト初期化
- [x] Gemini API (google-genai) セットアップ
- [x] Phase 0 ロジックの移植
  - [x] 画像認識サービス (`/api/v1/appliances/recognize`)
  - [x] PDF 取得サービス (`/api/v1/manuals/search`)
  - [x] メンテナンス抽出サービス (`/api/v1/manuals/extract-maintenance`)
  - [x] HEIC 変換サービス (`/api/v1/appliances/convert-heic`)
- [x] API エンドポイント設計・実装
- [x] Supabase 接続テスト (`/health/supabase`)

#### 1-3. Next.js フロントエンド
- [x] Next.js 16 プロジェクト作成（App Router）
- [x] Tailwind CSS 4 セットアップ
- [x] 基本レイアウト・コンポーネント（Header, Footer, Button, Card）
- [x] API Routes（BFF層）
- [x] 家電登録画面（画像アップロード → AI解析）
- [x] HEIC 画像プレビュー対応（サーバーサイド変換）

#### 1-4. Supabase 設定
- [x] プロジェクト作成
- [x] PostgreSQL スキーマ設計・作成（マイグレーションファイル）
- [x] pgvector 拡張有効化（RAG 用）
- [x] Auth 設定（メール認証）
- [x] Storage バケット作成（manuals, images）
- [x] RLS ポリシー設定

---

### Phase 1.5: デプロイ基盤構築 ✅ 完了

Phase 1 完了後、継続的デプロイ環境を構築。以降の開発はステージング環境で動作確認しながら進める。

**デプロイ構成:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Vercel      │────▶│  Cloud Run      │────▶│    Supabase     │
│   (Next.js)     │     │   (FastAPI)     │     │  (DB/Auth/Storage)
│   フロントエンド   │     │   バックエンド    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

詳細なセットアップ手順: [deploy-setup.md](./deploy-setup.md)

#### 1.5-1. フロントエンドデプロイ（Vercel） ✅ 完了
- [x] Vercel アカウント作成・GitHub 連携
- [x] プロジェクト作成（frontend ディレクトリ指定）
- [x] 環境変数設定
  - `BACKEND_URL`: Cloud Run の URL
  - `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase Publishable Key
- [x] プレビューデプロイ確認（PR ごとに自動デプロイ）
- [ ] カスタムドメイン設定（任意）

**本番 URL:** https://manual-agent-seven.vercel.app/

#### 1.5-2. バックエンドデプロイ（Google Cloud Run）
- [x] Google Cloud プロジェクト作成（manual-agent-prod）
- [x] Cloud Run API 有効化
- [x] Dockerfile 作成（backend/）
- [x] Artifact Registry リポジトリ作成（manual-agent-repo）
- [x] Cloud Run サービスデプロイ
- [x] 環境変数設定（Secret Manager）
  - `GEMINI_API_KEY`
  - `GOOGLE_CSE_API_KEY`
  - `GOOGLE_CSE_ID`
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY`
- [x] CORS 設定（Vercel ドメイン許可）

#### 1.5-3. CI/CD パイプライン ✅ 完了
- [x] GitHub Actions ワークフロー作成（`.github/workflows/deploy.yml`）
  - [x] フロントエンド: Lint / Type check / Build
  - [x] バックエンド: Lint (ruff) / Format check
  - [x] Cloud Run 自動デプロイ（main ブランチ）
- [x] Workload Identity Federation 設定（`scripts/setup-workload-identity.sh`）
- [ ] ブランチ保護ルール設定（任意）

#### 1.5-4. 動作確認 ✅ 完了
- [x] Vercel → Cloud Run API 疎通確認
- [x] Cloud Run → Supabase 接続確認
- [x] CORS 設定確認
- [x] 画像アップロード → AI 解析 E2E 確認
- [x] HEIC 画像変換 → プレビュー表示 E2E 確認

---

### Phase 2: 認証 ✅ 完了
- [x] Supabase Auth 連携（フロントエンド）
  - [x] @supabase/supabase-js, @supabase/ssr インストール
  - [x] ブラウザ/サーバー/ミドルウェア用クライアント作成
- [x] ログイン/新規登録画面
  - [x] AuthFormコンポーネント（共通フォーム）
  - [x] /login, /signup ページ
  - [x] メール確認コールバック（/auth/callback）
- [x] 認証状態管理
  - [x] AuthContext/AuthProvider
  - [x] ミドルウェアによるルート保護（/register等）
  - [x] ヘッダーの認証UI（ログイン/ログアウト表示切替）

### Phase 3: 家電登録・説明書取得 ✅ 完了

#### 3-1. データベース設計リファクタリング ✅ 完了
- [x] 共有マスター方式への移行
  - [x] `shared_appliances`（家電マスター）テーブル作成
  - [x] `user_appliances`（ユーザー所有関係）テーブル作成
  - [x] RLSポリシー再設計（共有マスターは全ユーザー閲覧可能）
- [x] メンテナンス項目キャッシュテーブル追加
  - [x] `shared_maintenance_items`（LLM抽出結果のキャッシュ）
  - [x] `maintenance_schedules.shared_item_id` カラム追加
- [x] マイグレーションファイル作成（00002-00006）

#### 3-2. バックエンドAPI実装 ✅ 完了
- [x] 家電CRUDサービス（`appliance_service.py`）
  - [x] 共有家電の取得または作成
  - [x] ユーザー家電の登録・一覧・詳細・更新・削除
- [x] PDFストレージサービス（`pdf_storage.py`）
  - [x] PDFダウンロード・アップロード
  - [x] 公開URL/署名付きURL生成
- [x] メンテナンスキャッシュサービス（`maintenance_cache_service.py`）
  - [x] キャッシュ済み項目の取得
  - [x] 新規項目のキャッシュ保存
  - [x] メンテナンススケジュール登録
- [x] メーカードメイン管理（`manufacturer_domain.py`）
- [x] Supabaseクライアント（`supabase_client.py`）
- [x] 家電APIルート（`/api/appliances`）

#### 3-3. フロントエンドBFF層実装 ✅ 完了
- [x] 家電一覧・詳細・削除 API Routes
- [x] 家電登録フローAPI Routes
  - [x] `/api/appliances/register` - 家電登録
  - [x] `/api/appliances/check-existing` - 既存家電チェック
  - [x] `/api/appliances/confirm-manual` - 説明書確認・PDF保存
  - [x] `/api/appliances/search-manual-stream` - 説明書検索（ストリーミング）
- [x] メンテナンス項目API Routes
  - [x] `/api/appliances/maintenance-items/[sharedApplianceId]` - 項目取得
  - [x] `/api/appliances/extract-maintenance` - メンテナンス抽出
  - [x] `/api/appliances/maintenance-schedules/register` - スケジュール登録

#### 3-4. フロントエンドUI ✅ 完了
- [x] 型定義ファイル作成（`src/types/appliance.ts`）
- [x] 家電一覧ページ（`/appliances`）
- [x] Modalコンポーネント
- [x] 家電登録画面の完成
  - [x] 型番未検出時のラベル位置ガイド表示（`label_guide` UI実装）
  - [x] 手動入力フォーム
  - [x] カテゴリ選択（事前定義リスト + AI提案）
- [x] 家電詳細画面（`/appliances/[id]`）
- [x] メンテナンス項目選択UI（チェックボックス式）

---

### Phase 3.5: 初回プロダクションリリース ✅ 完了

**マイルストーン**: スマートフォンで製品登録・マニュアル取得ができる状態

#### 3.5-1. 本番環境準備 ✅ 完了
- [x] 本番用環境変数設定（Cloud Run: Secret Manager経由で6変数設定済み）
- [x] Supabase 本番プロジェクト設定（Phase 1で完了）
- [x] セキュリティ確認（.env gitignore、APIキーハードコードなし、CORS設定済み）

#### 3.5-2. スマホ対応確認 ✅ 完了
- [x] レスポンシブデザイン動作確認（ハンバーガーメニュー、max-w-2xl）
- [x] タッチ操作の使いやすさ確認（タップ可能な大きなボタン）
- [x] 画像アップロード動作確認（accept="image/*"でカメラ対応、HEIC変換対応）
- [x] UI/UX 確認（Playwright E2Eテスト実施）

#### 3.5-3. パフォーマンス確認 ✅ 完了
- [x] ページ読み込み速度確認（Vercel: 174ms / 20KB）
- [x] API レスポンス時間確認（Health: 62ms、Supabase: 358msウォーム時）
- [x] Cloud Runコールドスタート確認（初回4秒、ウォーム時は高速）

#### 3.5-4. リリース ✅ 完了
- [x] 本番デプロイ実施（Phase 1.5で完了）
- [x] 動作確認（Playwrightモバイルビューテスト実施）
- [x] 🎉 スマホでアクセス可能！ https://manual-agent-seven.vercel.app/

---

### Phase 4: メンテナンス管理 ✅ 完了

#### 4-1. バックエンドAPI実装 ✅ 完了
- [x] メンテナンス完了記録サービス（`maintenance_log_service.py`）
  - [x] `complete_maintenance()` - 完了記録・次回日再計算
  - [x] `get_maintenance_logs()` - 履歴取得（ページネーション対応）
  - [x] `get_upcoming_maintenance()` - 期限間近の項目取得
  - [x] `get_appliance_next_maintenance()` - 家電別次回メンテナンス取得
- [x] APIルート追加（`appliances.py`）
  - [x] `POST /api/v1/appliances/schedules/{schedule_id}/complete`
  - [x] `GET /api/v1/appliances/schedules/{schedule_id}/logs`
  - [x] `GET /api/v1/appliances/maintenance/upcoming`
- [x] Pydanticスキーマ追加（`appliance.py`）
  - [x] `MaintenanceCompleteRequest`, `MaintenanceLog`, `MaintenanceLogList`, `MaintenanceCompleteResponse`

#### 4-2. フロントエンドBFF層実装 ✅ 完了
- [x] `/api/appliances/maintenance-schedules/[id]/complete` - 完了記録API
- [x] `/api/appliances/maintenance-schedules/[id]/logs` - 履歴取得API

#### 4-3. フロントエンドUI ✅ 完了
- [x] 型定義更新（`MaintenanceLog`, `MaintenanceCompleteResponse`等）
- [x] 家電詳細画面（`/appliances/[id]`）
  - [x] メンテナンス項目に「完了」ボタン追加
  - [x] 完了確認モーダル（メモ入力対応）
  - [x] 最終完了日表示（`last_done_at`）
  - [x] 履歴表示モーダル（「履歴を表示」ボタン）
- [x] 家電一覧画面（`/appliances`）
  - [x] 次回メンテナンス日バッジ表示
  - [x] 色分け表示（期限切れ: 赤、間近: 黄、余裕あり: 緑）

### Phase 5: 通知・PWA 🔄 テスト中

#### 5-1. PWA基盤 ✅ 完了
- [x] PWA設定
  - [x] `manifest.json`（アプリ名、アイコン、テーマカラー）
  - [x] Service Worker（`sw.js`、`custom-sw.js`）
  - [x] PWAアイコン生成（192x192, 512x512, apple-touch-icon）
- [x] next-pwa 設定
  - [x] `next.config.ts` でPWA有効化
  - [x] 開発時は無効化設定

#### 5-2. Push通知基盤 ✅ 完了
- [x] バックエンドサービス
  - [x] `push_subscription_service.py` - 購読管理（subscribe/unsubscribe）
  - [x] `notification_service.py` - Web Push送信（pywebpush）
  - [x] `maintenance_notification_service.py` - メンテナンスリマインド
  - [x] `push_subscriptions` テーブル（Supabase）
- [x] APIルート追加
  - [x] `POST /api/v1/push/subscribe` - 購読登録
  - [x] `POST /api/v1/push/unsubscribe` - 購読解除
  - [x] `GET /api/v1/push/vapid-public-key` - VAPID公開鍵取得
  - [x] `POST /api/v1/notifications/test` - テスト通知送信
  - [x] `POST /api/v1/notifications/reminders` - リマインド送信

#### 5-3. フロントエンド実装 ✅ 完了
- [x] BFF層 API Routes
  - [x] `/api/push/subscribe` - 購読登録
  - [x] `/api/push/unsubscribe` - 購読解除
  - [x] `/api/push/vapid-public-key` - VAPID公開鍵取得
  - [x] `/api/push/test` - テスト通知送信
  - [x] `/api/notifications/reminders` - リマインド送信
- [x] 通知UIコンポーネント
  - [x] `NotificationPermission.tsx` - 通知許可リクエストUI
- [x] Service Worker登録（`serviceWorker.ts`）
- [x] Hooksディレクトリ（`src/hooks/`）

#### 5-4. VAPID鍵・テスト 🔄 テスト中
- [x] VAPID鍵生成スクリプト（`scripts/generate-vapid-keys.py`）
- [ ] 本番環境VAPID鍵設定
- [ ] E2Eテスト（通知許可→購読→通知受信フロー）
- [ ] 定期リマインド送信の自動化（Cronジョブ等）

### Phase 6: RAG・質問応答機能
- [ ] マニュアル PDF のベクトル化
- [ ] pgvector へのインデックス保存
- [ ] RAG チェーン実装（LangChain）
- [ ] 家電詳細画面 + 質問 UI

### Phase 7 以降: 拡張機能
- [ ] 家族グループ共有
- [ ] LINE 通知対応
- [ ] 家電以外の商品対応

---

## 現在のステータス

**現在のフェーズ**: Phase 5（通知・PWA）🔄 進行中

### 進捗サマリー

| フェーズ | ステータス | 備考 |
|---------|-----------|------|
| Phase 0 | ✅ 完了 | 3機能すべて100%成功、Go判定 |
| Phase 1 | ✅ 完了 | FastAPI + Next.js + Supabase 基盤構築 |
| Phase 1.5 | ✅ 完了 | Vercel + Cloud Run + CI/CD 構築完了 |
| Phase 2 | ✅ 完了 | Supabase Auth連携、ログイン/登録画面、ルート保護 |
| Phase 3 | ✅ 完了 | 家電登録・説明書取得・詳細画面・メンテナンス項目選択UI |
| Phase 3.5 | ✅ 完了 | **📱 初回リリース完了！** https://manual-agent-seven.vercel.app/ |
| Phase 4 | ✅ 完了 | メンテナンス完了記録・履歴表示・次回作業日表示 |
| Phase 5 | 🔄 テスト中 | PWA・Push通知実装完了、本番テスト待ち |
| Phase 6+ | ⚪ 未着手 | RAG・拡張機能 |

---

## Phase 0 検証結果サマリー

| 検証項目 | テスト対象 | 成功率 | 使用技術 |
|---------|-----------|--------|---------|
| 画像認識 | 4製品 | 100% | Gemini 2.0 Flash |
| PDF取得 | 4製品（3メーカー） | 100% | Custom Search API + Gemini |
| メンテナンス抽出 | 4製品（70件） | 100% | Gemini 2.5 Flash |

### コスト見積もり
- 約 **$0.02/製品（約3円）**
- Gemini無料枠で開発・テスト可能

---

## 次のステップ

Phase 5（通知・PWA）の実装が完了し、テスト段階に入っている。残りタスクは以下の通り：

### Phase 5: 通知・PWA（残りタスク）

1. **本番環境VAPID鍵設定** - Cloud RunのSecret Managerに設定
2. **E2Eテスト** - 本番ビルドで通知許可→購読→通知送信のフロー確認
3. **定期リマインド自動化** - Cloud Scheduler等で毎朝リマインドAPIを呼び出し

### Phase 6 への準備

Phase 5完了後は、Phase 6（RAG・質問応答機能）に移行：
- マニュアルPDFのベクトル化（pgvector）
- LangChainによるRAGチェーン実装
- 家電詳細画面への質問UI追加
