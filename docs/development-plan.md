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

### Phase 5: 通知・PWA ✅ 完了

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
  - [x] `DELETE /api/v1/push/unsubscribe` - 購読解除
  - [x] `POST /api/v1/notifications/test` - テスト通知送信
  - [x] `POST /api/v1/notifications/reminders/send` - リマインド送信（全ユーザー/任意ユーザー）
  - [x] `POST /api/v1/notifications/reminders/my` - リマインド送信（自分のみ・簡易）

#### 5-3. フロントエンド実装 ✅ 完了
- [x] BFF層 API Routes
  - [x] `/api/push/subscribe` - 購読登録
  - [x] `/api/push/unsubscribe` - 購読解除
  - [x] `/api/push/vapid-public-key` - VAPID公開鍵取得
  - [x] `/api/push/test` - テスト通知送信
  - [x] `/api/notifications/reminders` - リマインド送信
  - [x] `/api/notifications/test` - テスト通知送信（許可ユーザーのみ）
- [x] 通知UIコンポーネント
  - [x] `NotificationPermission.tsx` - 通知許可リクエストUI（テスト通知ボタン追加）
- [x] Service Worker登録（`serviceWorker.ts`）
- [x] Hooksディレクトリ（`src/hooks/`）

#### 5-3.5. 認証フロー改善（PWA対応） ✅ 完了
- [x] OTPコード方式への変更
  - [x] `AuthForm.tsx` - OTPコード入力フォーム追加
  - [x] `AuthContext.tsx` - `verifyOtp()` メソッド追加
  - [x] Supabaseメールテンプレート設定手順（`docs/supabase-setup.md`）
- [x] 確認コード再送機能
  - [x] `AuthContext.tsx` - `resendOtp()` メソッド追加（Supabase Auth `resend()` API使用）
  - [x] `AuthForm.tsx` - 再送ボタンUI追加
  - [x] 60秒クールダウンタイマー（成功時）
  - [x] Supabaseレート制限エラーからの秒数抽出・カウントダウン表示
  - [x] 日本語エラーメッセージ対応
- [x] テスト通知機能
  - [x] `/api/notifications/test` BFFルート
  - [x] 環境変数 `ALLOWED_TEST_NOTIFICATION_USERS` でホワイトリスト管理

#### 5-4. VAPID鍵・テスト ✅ 完了
- [x] VAPID鍵生成スクリプト（`scripts/generate-vapid-keys.py`）
- [x] 本番環境VAPID鍵設定（Secret Manager登録済み）
- [x] E2Eテスト（通知許可→購読→通知受信フロー）

#### 5-5. 定期リマインド自動化 ✅ 完了
- [x] `notify_time`・`timezone`対応のユーザーフィルタリング機能
- [x] Cron用APIエンドポイント（`/api/v1/cron/send-reminders`）
- [x] シークレットキー認証（`CRON_SECRET_KEY`）
- [x] Cloud Schedulerセットアップスクリプト（`scripts/setup-scheduler.sh`）
- [x] デプロイスクリプト更新（VAPID/CRON_SECRET_KEY追加）

#### 5-6. マイページ機能 ✅ 完了
- [x] バックエンドAPI実装
  - [x] `user_service.py` - ユーザーサービス（プロファイル、設定、統計）
  - [x] `schemas/user.py` - Pydanticスキーマ（UserProfile, MaintenanceStats等）
  - [x] `routes/users.py` - APIルート（/me, /settings, /me/maintenance-stats）
- [x] フロントエンドBFF層
  - [x] `/api/user/me` - プロファイル取得
  - [x] `/api/user/settings` - 設定取得・更新
  - [x] `/api/user/maintenance-stats` - メンテナンス統計取得
- [x] マイページUI（`/mypage`）
  - [x] メンテナンス統計カード（今週予定、超過、今月完了、累計完了）
  - [x] 通知設定（NotificationPermission再利用、テスト通知ボタン）
  - [x] 通知時刻変更（1時間単位セレクト: 00:00〜23:00）
  - [x] ログアウトボタン
- [x] Header更新（マイページリンク追加）

### Phase 6: QAマークダウン方式 質問応答機能 ✅ 完了

**詳細計画**: [phase6-qa-implementation-plan.md](./plans/phase6-qa-implementation-plan.md)

RAGの代わりに、製品ごとにQAマークダウンファイルを作成してLLMに読み取らせるアプローチを採用。

**設計方針**:
- 保存形式: Markdownファイル（Supabase Storage）
- 生成タイミング: 説明書確認時に自動生成 + バッチ処理
- PDF参照方式: ハイブリッド（QA検索 → テキスト検索 → PDF分析）

#### 6-1. バックエンドサービス実装 ✅ 完了
- [x] テキストキャッシュサービス（`text_cache_service.py`）
  - [x] PDFからテキスト抽出・キャッシュ保存
  - [x] キャッシュ済みテキストの取得
- [x] QAサービス（`qa_service.py`）
  - [x] QAマークダウン生成（Gemini）
  - [x] QA検索（キーワードマッチング）
  - [x] テキスト検索（セクション検索）
  - [x] PDF分析（LLM直接分析）
- [x] QAチャットサービス（`qa_chat_service.py`）
  - [x] 3段階フォールバック検索ロジック
  - [x] SSEストリーミング進捗通知
- [x] QA評価サービス（`qa_rating_service.py`）
  - [x] フィードバック保存（いいね/悪いね）
- [x] マイグレーション（`00008_qa_ratings.sql`）

#### 6-2. バックエンドAPI実装 ✅ 完了
- [x] APIルート（`qa.py`）
  - [x] `GET /api/v1/qa/{shared_appliance_id}` - QA取得
  - [x] `POST /api/v1/qa/{shared_appliance_id}/generate` - QA生成
  - [x] `POST /api/v1/qa/{shared_appliance_id}/ask` - 質問応答
  - [x] `POST /api/v1/qa/{shared_appliance_id}/ask-stream` - 質問応答（SSE）
  - [x] `POST /api/v1/qa/{shared_appliance_id}/feedback` - フィードバック登録
- [x] Pydanticスキーマ（`qa.py`）

#### 6-3. フロントエンドBFF層実装 ✅ 完了
- [x] `/api/qa/[sharedApplianceId]` - QA取得
- [x] `/api/qa/[sharedApplianceId]/generate` - QA生成
- [x] `/api/qa/[sharedApplianceId]/ask` - 質問応答
- [x] `/api/qa/[sharedApplianceId]/ask-stream` - 質問応答（SSE）
- [x] `/api/qa/[sharedApplianceId]/feedback` - フィードバック登録

#### 6-4. フロントエンドUI実装 ✅ 完了
- [x] 型定義（`src/types/qa.ts`）
- [x] コンポーネント（`src/components/qa/`）
  - [x] `QASection.tsx` - QAセクションコンテナ
  - [x] `QAChat.tsx` - チャットUI
  - [x] `QAChatMessage.tsx` - メッセージ表示
  - [x] `QAFeedbackButtons.tsx` - フィードバックボタン
  - [x] `SearchProgressIndicator.tsx` - 進捗表示（SSE連携）
- [x] 家電詳細画面（`/appliances/[id]`）への統合

#### 6-5. バッチ処理 ✅ 完了
- [x] バッチ処理スクリプト（`scripts/batch_generate_qa.py`）- 既存PDF用QA一括生成
  - [x] コマンドラインオプション（--limit, --delay, --force, --dry-run）
  - [x] 既存QAスキップ機能
  - [x] レート制限対策（遅延設定）
  - [x] 結果サマリー表示

### Phase 6.5: メンテナンス一覧機能 ✅ 完了

家電一覧ページに加え、すべてのメンテナンス項目を一覧で確認・管理できるページを追加。

#### 6.5-1. バックエンドAPI実装 ✅ 完了
- [x] メンテナンス一覧APIルート（`backend/app/api/routes/maintenance.py`）
  - [x] `GET /api/v1/maintenance` - 全メンテナンス項目取得（ステータス・重要度・家電IDでフィルタ可能）
  - [x] ステータス判定ロジック（overdue / upcoming / scheduled / manual）
  - [x] カウント集計（各ステータスの件数）

#### 6.5-2. フロントエンドBFF層実装 ✅ 完了
- [x] `/api/maintenance` - メンテナンス一覧取得

#### 6.5-3. 共通コンポーネント作成 ✅ 完了
- [x] `MaintenanceCompleteModal.tsx` - 完了モーダル（家電詳細ページから共通化）
- [x] `MaintenanceStatusTabs.tsx` - ステータス別タブ（すべて / 期限超過 / 今週 / 予定通り / 手動）
- [x] `MaintenanceFilter.tsx` - フィルター（重要度、家電別）
- [x] `MaintenanceListItem.tsx` - リストアイテム（コンパクト / フル表示切替）

#### 6.5-4. メンテナンス一覧ページ実装 ✅ 完了
- [x] `/maintenance` ページ作成
- [x] タブ + フィルタ + リスト表示
- [x] 詳細モーダル・履歴モーダル・完了モーダル統合
- [x] 家電詳細ページと統一されたUI/UX
- [x] 認証保護追加（middleware.ts に `/maintenance` 追加）

#### 6.5-5. UI統一 ✅ 完了
- [x] 家電詳細ページのメンテナンス項目表示と同じレイアウト
- [x] モーダルの閉じるボタン（✕）統一
- [x] 期限超過時の赤ボタン表示

### Phase 7: 家族グループ共有機能 ✅ 完了

#### 7-1. データベース設計 ✅ 完了
- [x] `groups` テーブル（グループ情報、招待コード、オーナー）
- [x] `group_members` テーブル（メンバー管理、role: owner/member）
- [x] `user_appliances.group_id` カラム追加
- [x] 1ユーザー1グループ制約
- [x] 個人所有/グループ所有の排他制約
- [x] マイグレーション 00010〜00014

#### 7-2. バックエンドAPI実装 ✅ 完了
- [x] `group_service.py`: グループCRUD、招待コード生成・検証、メンバー管理
- [x] `appliance_service.py` 拡張: 家電共有/解除
- [x] グループAPI群（作成、参加、離脱、削除、メンバー管理）

#### 7-3. フロントエンドBFF層実装 ✅ 完了
- [x] `/api/groups` - グループ一覧・作成
- [x] `/api/groups/[id]` - グループ詳細・更新・削除
- [x] `/api/groups/join` - グループ参加
- [x] `/api/appliances/[id]/share` - 家電共有
- [x] `/api/appliances/[id]/unshare` - 共有解除

#### 7-4. フロントエンドUI実装 ✅ 完了
- [x] `/groups` ページ（グループ一覧、作成、参加）
- [x] `/groups/[id]` ページ（詳細、メンバー管理、招待コード）
- [x] `ShareButton.tsx` コンポーネント
- [x] Headerにグループページリンク追加

---

### 追加機能（Phase 7 以降）

#### QA会話履歴機能 ✅ 完了
- [x] `qa_session_service.py`: セッション管理サービス
- [x] マイグレーション 00016〜00018
- [x] `QASessionHistory.tsx`: 会話履歴UI
- [x] セッション関連APIエンドポイント

#### リッチテキスト対応 ✅ 完了
- [x] `SafeHtml.tsx`: DOMPurifyによるサニタイズ済みHTML表示
- [x] マイグレーション 00015（DBスキーマ正規化）
- [x] メンテナンスカードのレイアウト改善

#### パフォーマンス改善 ✅ 完了
- [x] N+1問題解消（appliance_service, maintenance_notification_service）
- [x] SWR導入（useAppliances, useMaintenance フック）
- [x] キャッシュ最適化

#### 認証フロー改善 ✅ 完了
- [x] `/reset-password` ページ: パスワードリセット機能
- [x] AuthContext: resetPassword(), updatePassword() メソッド

#### UI改善 ✅ 完了
- [x] トップページのコンパクト化
- [x] テキスト見切れ対策
- [x] 家電詳細ページ総合改善

#### ユーザーティア機能 ✅ 完了
- [x] `tier_service.py`: ティア管理サービス
  - [x] ユーザーティア取得・デフォルトティア設定
  - [x] 日次使用量トラッキング（daily_usage テーブル）
  - [x] 家電追加・説明書検索・QA質問の制限チェック
  - [x] 使用量統計取得
- [x] マイグレーション（daily_usage、users.tier追加）
- [x] フロントエンドUIコンポーネント
  - [x] `UsageBar.tsx`: 使用量バー表示
  - [x] `TierLimitModal.tsx`: 制限到達モーダル
- [x] マイページ: プラン・利用状況表示
- [x] BFF層: `/api/user/usage` エンドポイント

#### ヘルプページ ✅ 完了
- [x] `/help` ページ: 使い方ガイド
  - [x] アコーディオン形式のセクション構成
  - [x] はじめに、使い始める、家電を登録する、家電を管理する
  - [x] メンテナンスを管理する、QA機能、家族と共有する
  - [x] マイページ・設定、FAQ、トラブルシューティング
- [x] クイックリンク（各ページへのナビゲーション）

#### display_name（表示名）機能 ✅ 完了
- [x] usersテーブルにdisplay_nameカラム追加
- [x] マイグレーション 00024
- [x] ユーザープロファイルAPI対応
- [x] グループメンバー一覧での表示

#### 登録済み家電検出機能 ✅ 完了
- [x] 同一メーカー・型番の家電が既に登録されている場合に警告表示
- [x] `/api/appliances/check-existing` APIの活用

#### パナソニック製品検索改善 ✅ 完了
- [x] `panasonic_manual.py`: Panasonic公式サイト直接検索
  - [x] `search_panasonic_manual`: 製品ページから説明書PDF取得
  - [x] `extract_manual_pdf_url`: PDFのURL抽出
  - [x] `is_panasonic`: パナソニック製品判定
- [x] Google CSE不要で公式PDFを直接取得

#### グループ自動共有機能 ✅ 完了
- [x] グループ所属ユーザーが登録した家電を自動的にグループ共有
- [x] マイグレーション 00025

---

### Phase 8 以降: 検討中
- [ ] LINE 通知対応
- [ ] 家電以外の商品対応（住宅設備等）
- [ ] 複数グループ対応
- [ ] プレミアムティア（課金機能）

---

## 現在のステータス

**現在のフェーズ**: Phase 7（家族グループ共有機能）+ 追加機能 ✅ 完了

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
| Phase 5 | ✅ 完了 | PWA・Push通知・定期リマインド自動化 |
| Phase 6 | ✅ 完了 | QAマークダウン方式質問応答機能・チャットUI・フィードバック |
| Phase 6.5 | ✅ 完了 | メンテナンス一覧ページ・ステータス別タブ・フィルタ機能 |
| Phase 7 | ✅ 完了 | 家族グループ共有・招待コード・メンバー管理 |
| 追加機能 | ✅ 完了 | QA会話履歴・ティア機能・ヘルプ・パナソニック検索・認証改善 |
| Phase 8+ | ⚪ 未着手 | LINE通知、家電以外対応など |

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

Phase 7（家族グループ共有機能）および追加機能が完了。

### Phase 7 完了内容

- ✅ グループ管理（作成・参加・離脱・削除）
- ✅ 招待コード方式（6文字英数字）
- ✅ 家電共有/解除（トグルスイッチでワンタップ操作）
- ✅ メンバー管理（オーナーによるメンバー削除）
- ✅ グループページ（`/groups`、`/groups/[id]`）
- ✅ マイグレーション 00010〜00014

### 追加機能 完了内容

- ✅ **QA会話履歴機能**: セッション管理、LLMタイトル自動生成、履歴UI
- ✅ **リッチテキスト対応**: SafeHtmlコンポーネント、DBスキーマ正規化
- ✅ **パフォーマンス改善**: N+1問題解消、SWR導入
- ✅ **認証フロー改善**: パスワードリセット機能
- ✅ **UI改善**: トップページコンパクト化、テキスト見切れ対策、家電詳細ページ総合改善
- ✅ **ユーザーティア機能**: 利用制限、使用量トラッキング、UI表示
- ✅ **ヘルプページ**: 使い方ガイド、FAQ、トラブルシューティング
- ✅ **display_name機能**: ユーザー表示名設定
- ✅ **登録済み家電検出**: 重複警告機能
- ✅ **パナソニック検索改善**: 公式サイト直接検索
- ✅ **グループ自動共有**: グループ所属時の自動共有

### Phase 8 以降の検討事項

- LINE 通知対応
- 家電以外の商品対応（住宅設備等）
- 複数グループ対応
- プレミアムティア（課金機能）
