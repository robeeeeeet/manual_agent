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
   └── Gemini API (google-genai)
        ↓
Supabase (PostgreSQL/pgvector/Auth/Storage)
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 16+, TypeScript, Tailwind CSS 4, React 19, PWA |
| BFF層 | Next.js API Routes |
| AIバックエンド | FastAPI, Gemini API (google-genai) |
| データベース | Supabase PostgreSQL, pgvector |
| 認証 | Supabase Auth |
| ストレージ | Supabase Storage |
| パッケージ管理 | uv (Python), npm (Node.js) |
| デプロイ（フロント） | Vercel |
| デプロイ（バック） | Google Cloud Run |
| CI/CD | GitHub Actions |

## ⚠️ 重要: Supabase プロジェクトID

**Supabase MCP や直接クエリ時は必ず以下のプロジェクトIDを使用すること:**

```
nuuukueocvvdoynqkmol
```

- このIDは `SUPABASE_URL` の `https://{project_id}.supabase.co` から取得
- **間違ったIDを使用するとデータが見つからない・操作できないエラーが発生する**
- Supabase MCPツール（`execute_sql`, `list_tables` 等）の `project_id` パラメータに必ず指定

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
│   │   │   ├── appliances/# 家電関連API（CRUD、説明書、メンテナンス、共有）
│   │   │   ├── groups/    # グループAPI（CRUD、参加、メンバー管理）
│   │   │   ├── qa/        # QA関連API（質問応答、フィードバック）
│   │   │   ├── push/      # Push通知API（subscribe, unsubscribe等）
│   │   │   ├── notifications/ # 通知API（reminders等）
│   │   │   └── user/      # ユーザーAPI（me, settings, maintenance-stats）
│   │   ├── auth/callback/ # 認証コールバック
│   │   ├── login/         # ログインページ
│   │   ├── signup/        # 新規登録ページ
│   │   ├── reset-password/ # パスワードリセットページ
│   │   ├── register/      # 家電登録ページ
│   │   ├── appliances/    # 家電一覧・詳細ページ
│   │   │   └── [id]/      # 家電詳細ページ（動的ルート）
│   │   ├── groups/        # グループ管理ページ
│   │   │   └── [id]/      # グループ詳細ページ（動的ルート）
│   │   ├── maintenance/   # メンテナンス一覧ページ
│   │   ├── mypage/        # マイページ（統計、設定、ログアウト）
│   │   └── help/          # ヘルプ・使い方ガイドページ
│   ├── src/components/    # UIコンポーネント
│   │   ├── appliance/     # 家電コンポーネント（ShareButton）
│   │   ├── auth/          # 認証関連（AuthForm）
│   │   ├── layout/        # Header, Footer
│   │   ├── maintenance/   # メンテナンス関連（MaintenanceCompleteModal, MaintenanceStatusTabs, MaintenanceFilter, MaintenanceListItem）
│   │   ├── notification/  # 通知コンポーネント（NotificationPermission, NotificationPermissionModal, NotificationOnboarding）
│   │   ├── qa/            # QA機能（QASection, QAChat, QAChatMessage, QAFeedbackButtons, SearchProgressIndicator, QASessionHistory）
│   │   ├── tier/          # ティア関連（UsageBar, TierLimitModal）
│   │   └── ui/            # Button, Card, Modal, SafeHtml, FeatureCard
│   ├── src/hooks/         # カスタムフック（usePushNotification, useDeviceContext, useAppliances, useMaintenance）
│   ├── src/types/         # 型定義（appliance.ts, user.ts, qa.ts, group.ts）
│   ├── src/contexts/      # React Context（AuthContext）
│   ├── src/lib/           # ユーティリティ
│   │   ├── supabase/      # Supabaseクライアント
│   │   └── api.ts         # バックエンドAPIクライアント
│   ├── src/middleware.ts  # Next.js ミドルウェア（ルート保護）
│   └── package.json
├── backend/               # FastAPI アプリケーション
│   ├── app/
│   │   ├── api/routes/    # APIルート（appliances, manuals, maintenance, notifications, push, users, qa, cron, groups, tiers）
│   │   ├── schemas/       # Pydanticスキーマ
│   │   ├── services/      # ビジネスロジック
│   │   │   ├── image_recognition.py     # 画像認識
│   │   │   ├── manual_search.py         # 説明書検索
│   │   │   ├── maintenance_extraction.py # メンテナンス抽出
│   │   │   ├── appliance_service.py     # 家電CRUD
│   │   │   ├── pdf_storage.py           # PDFストレージ
│   │   │   ├── maintenance_cache_service.py # メンテナンスキャッシュ
│   │   │   ├── maintenance_log_service.py   # メンテナンス完了記録
│   │   │   ├── push_subscription_service.py # Push購読管理
│   │   │   ├── notification_service.py      # Push通知送信
│   │   │   ├── maintenance_notification_service.py # リマインド通知
│   │   │   ├── user_service.py          # ユーザープロファイル・設定・統計
│   │   │   ├── group_service.py         # グループCRUD・招待コード・メンバー管理
│   │   │   ├── supabase_client.py       # Supabaseクライアント
│   │   │   ├── manufacturer_domain.py   # メーカードメイン
│   │   │   ├── tier_service.py          # ユーザーティア・利用制限
│   │   │   ├── panasonic_manual.py      # パナソニック製品説明書検索
│   │   │   ├── qa_service.py            # QA検索・生成サービス
│   │   │   ├── qa_chat_service.py       # QAチャット（LLM対話）
│   │   │   ├── qa_rating_service.py     # QAフィードバック評価
│   │   │   ├── qa_abuse_service.py      # QA不正利用防止（質問検証、違反記録、利用制限）
│   │   │   ├── qa_session_service.py    # QAセッション管理（会話履歴、タイトル生成）
│   │   │   ├── text_cache_service.py    # PDFテキストキャッシュ
│   │   │   └── image_conversion.py      # 画像変換（HEIC等）
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

# VAPID鍵生成（Phase 5: Push通知）
cd backend && uv run python ../scripts/generate-vapid-keys.py

# デプロイ（プロジェクトルートから実行）
./scripts/deploy-backend.sh          # ビルド & Cloud Run デプロイ
./scripts/deploy-backend.sh build    # ビルドのみ
./scripts/deploy-backend.sh deploy   # デプロイのみ
./scripts/setup-secrets.sh           # Secret Manager にシークレット登録
./scripts/setup-secrets.sh --list    # シークレット一覧表示

# サーバー起動確認（重要: lsof ではなく ss を使用）
ss -tlnp | grep -E "3000|8000"        # 両サーバーの状態確認
```

### サーバー起動確認の注意点

**重要**: `lsof -i :3000` ではなく `ss -tlnp` を使用すること。

| サーバー | ポート | Listen アドレス | lsof | ss |
|----------|--------|-----------------|------|-----|
| Backend (uvicorn) | 8000 | `0.0.0.0` (IPv4) | ✅ | ✅ |
| Frontend (Next.js) | 3000 | `*` (IPv6) | ❌ | ✅ |

**理由**: Next.js はデフォルトで IPv6 (`::`) でリッスンする。WSL2 環境では `lsof` が IPv6 ソケットを正しく列挙できないため、フロントエンドが起動していても検出されない。

```bash
# ❌ 誤った確認方法（フロントエンドが検出されない）
lsof -i :3000 -i :8000 | grep LISTEN

# ✅ 正しい確認方法
ss -tlnp | grep -E "3000|8000"
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

# Phase 5: Push通知（VAPID鍵）
VAPID_PUBLIC_KEY=            # VAPID公開鍵（generate-vapid-keys.py で生成）
VAPID_PRIVATE_KEY=           # VAPID秘密鍵（秘匿、バックエンドのみ使用）
VAPID_SUBJECT=               # mailto:your-email@example.com または https://your-domain.com

# frontend/.env.local に設定（フロントエンド用）
BACKEND_URL=                         # バックエンドAPI URL（http://localhost:8000）
NEXT_PUBLIC_SUPABASE_URL=            # Supabase URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= # Supabase Publishable Key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=        # VAPID公開鍵（バックエンドと同じ値）
NEXT_PUBLIC_ALLOWED_TEST_NOTIFICATION_USERS=  # テスト通知許可ユーザー（カンマ区切りメールアドレス）

# バックエンド用（テスト通知API制限）
ALLOWED_TEST_NOTIFICATION_USERS=     # テスト通知許可ユーザー（カンマ区切りメールアドレス）
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
- ログイン時は `frontend/.env.local` 記載の `TEST_USER_EMAIL` と `TEST_USER_PASSWORD` を使用する

## 現在のステータス

**Phase 7: 家族グループ共有機能** 実装済み

### 完了済み（Phase 0〜7）
- ✅ Phase 0〜2: 基盤構築、デプロイ、認証
- ✅ Phase 3: 家電登録・説明書取得
  - データベース設計（共有マスター方式）
  - バックエンドAPI実装（家電CRUD、PDFストレージ、メンテナンスキャッシュ）
  - 家電登録画面、一覧・詳細ページ
- ✅ Phase 4: メンテナンス管理
  - メンテナンス完了記録API（バックエンド + BFF層）
  - 履歴取得API（バックエンド + BFF層）
  - 完了記録UI（完了ボタン、メモ入力モーダル）
  - 履歴表示UI（履歴モーダル、日時・メモ表示）
  - 家電一覧の次回メンテナンス表示（バッジ）
- ✅ Phase 5: 通知・PWA
  - PWA対応（manifest.json, Service Worker, アイコン）
  - Push通知基盤（購読管理、通知送信サービス）
  - メンテナンスリマインド通知（期限当日・期限間近）
  - 通知許可UIコンポーネント（NotificationPermission, NotificationPermissionModal）
  - 初回サインアップ時の通知オンボーディングフロー（NotificationOnboarding + sessionStorage）
  - デバイスコンテキスト検知フック（useDeviceContext: PC/スマホ、ブラウザ/PWA判別）
  - テスト通知送信機能（許可ユーザーのみ）
  - サインアップ時OTPコード方式（PWA対応のためメールリンクから変更）、確認コード再送機能
  - 定期リマインド自動化（Cloud Scheduler + notify_time対応）
  - マイページ（メンテナンス統計、通知設定、通知時刻変更、ログアウト）
- ✅ Phase 6: QAマークダウン方式 質問応答機能
  - QAチャットUI（QASection, QAChat, QAChatMessage, SearchProgressIndicator）
  - 3段階フォールバック検索（QA検索 → テキスト検索 → PDF分析）
  - SSEストリーミング進捗表示
  - QAフィードバック機能（いいね/悪いね評価、qa_ratings テーブル）
  - QAサービス群（qa_service, qa_chat_service, qa_rating_service）
  - テキストキャッシュサービス（text_cache_service）
  - QA不正利用防止機能（qa_abuse_service）
    - 認証必須化（X-User-Id ヘッダー）
    - ルールベース + LLM ハイブリッド質問検証
    - 違反記録（qa_violations テーブル）
    - 段階的利用制限（qa_restrictions テーブル: 1回目=警告、2回目=1時間、3回目=24時間、4回目以降=7日間）
- ✅ Phase 6.5: メンテナンス一覧機能
  - メンテナンス一覧ページ（`/maintenance`）
  - ステータス別タブ（すべて / 期限超過 / 今週 / 予定通り / 手動）
  - フィルター機能（重要度、家電別）
  - 共通コンポーネント（MaintenanceCompleteModal, MaintenanceStatusTabs, MaintenanceFilter, MaintenanceListItem）
  - 家電詳細ページと統一されたUI/UX
  - バックエンドAPI（`GET /api/v1/maintenance`）
- ✅ Phase 7: 家族グループ共有機能
  - グループ管理（作成・参加・退出・削除）
  - 招待コード方式（6文字英数字）
  - 家電共有/解除（トグルスイッチでワンタップ操作）
  - メンバー管理（オーナーによるメンバー削除）
  - 1ユーザー1グループ制約
  - グループページ（`/groups`、`/groups/[id]`）
  - マイグレーション 00010〜00014
- ✅ 追加機能（Phase 7以降）
  - **QA会話履歴機能**: セッション管理（qa_session_service）、LLMタイトル自動生成、QASessionHistory UI、マイグレーション 00016〜00018
  - **リッチテキスト対応**: SafeHtmlコンポーネント（DOMPurifyサニタイズ）、DBスキーマ正規化（マイグレーション 00015）
  - **パフォーマンス改善**: N+1問題解消（appliance_service, maintenance_notification_service）、SWR導入（useAppliances, useMaintenance フック）
  - **認証フロー改善**: パスワードリセット機能（`/reset-password`）、resetPassword/updatePassword メソッド
  - **UI改善**: トップページコンパクト化、テキスト見切れ対策、家電詳細ページ総合改善
  - **ユーザーティア機能**: tier_service.py（利用制限）、UsageBar/TierLimitModal（UI）、日次使用量トラッキング
  - **ヘルプページ**: `/help` 使い方ガイド、FAQ、トラブルシューティング
  - **display_name機能**: ユーザー表示名設定、グループメンバー一覧での表示
  - **パナソニック製品検索**: panasonic_manual.py（公式サイト直接検索、Google CSE不要）
  - **グループ自動共有**: グループ所属ユーザーが登録した家電を自動的にグループ共有
  - **登録済み家電検出**: 同一メーカー・型番の重複警告機能
  - **PDFビューア機能**: react-pdf + pdf.js、ピンチズーム、タッチジェスチャー、CJKフォント・JPEG 2000対応、`/pdf-viewer`ページ
  - **PDF暗号化自動解除**: pikepdfによるオーナーパスワード解除、解除不可PDFはフォールバック
  - **購入日機能と次回予定日編集**: user_appliances.purchased_at、購入日起算のメンテナンス日計算、カレンダーUI
  - **QA回答セルフチェック**: LLMによる回答品質の自動検証・再生成
  - **メンテナンスアーカイブ機能**: 不要項目のアーカイブ/復元
  - **モバイルレイアウト改善**: 家電詳細ページの最適化、タッチ操作改善
  - **メンテナンス頻度手動編集**: 周期タイプ（日/月/手動）と間隔値の編集、`PATCH /api/v1/maintenance/{id}/interval` API
  - **UI/UX改善**: 通知解除・次回予定日保存時のスピナー追加、購入日フォーム簡素化

### 次のフェーズ
- Phase 8: 追加機能・改善（検討中）
  - LINE 通知対応
  - 家電以外の商品対応（住宅設備等）

**本番URL:** https://manual-agent-seven.vercel.app/

詳細は `docs/development-plan.md` および `backend/supabase/SCHEMA.md` を参照。

## 重要な設計判断

1. **ハイブリッドアーキテクチャ**: フロントエンドは TypeScript (Next.js)、AIバックエンドは Python（Gemini API / `google-genai`）
2. **AI優先アプローチ**: 手動入力よりAI自動認識を優先
3. **PDF保存方式**: リンク保存ではなくPDFダウンロード保存（Supabase Storage）
4. **カテゴリ**: 事前定義リスト + 自由入力の両対応
5. **Supabase採用**: 認証・DB・ストレージを一元管理、pgvector対応
6. **LangChain/LangGraph採用**: 将来のRAG機能・複雑なエージェントフローに対応
   - ※現状の実装は `google-genai` を直接利用（LangChain/LangGraphは将来検討）
7. **デプロイ構成**: Vercel（Next.js最適化）+ Cloud Run（無料枠大、自動スケール）+ GitHub Actions（CI/CD）
8. **共有マスター方式**: 同一メーカー・型番の家電は`shared_appliances`で共有し、ユーザー所有関係は`user_appliances`で管理
9. **メンテナンスキャッシュ**: LLM抽出結果を`shared_maintenance_items`にキャッシュし、2人目以降のLLMコスト・処理時間を削減
10. **PWA対応**: next-pwaによるService Worker管理、Web Push API（pywebpush）によるプッシュ通知
11. **VAPID認証**: Web Push通知のセキュアな送信者認証（公開鍵/秘密鍵ペア）
12. **OTPコード認証**: サインアップ時のメール確認はOTPコード方式（PWAではメールリンクがSafariで開かれる問題を回避）、確認コード再送機能付き（Supabaseレート制限対応・日本語カウントダウン表示）
13. **auth.users同期トリガー**: `auth.users`への登録・削除時に`public.users`を自動同期（Supabase推奨パターン）
14. **認証リダイレクト**: 未認証ユーザーは全保護ルート（`/`, `/appliances`, `/register`, `/mypage`, `/maintenance`, `/groups`）からログインページへリダイレクトされ、ログイン後は元のページに戻る（`redirectTo`クエリパラメータ）
15. **QAマークダウン方式**: RAG（ベクトル検索）ではなく、事前生成したQAマークダウンファイルによる検索と3段階フォールバック（QA検索 → テキスト検索 → PDF直接分析）
16. **SSEストリーミング**: QA検索の進捗をリアルタイムでフロントエンドに伝達（ユーザー体験向上）
17. **通知オンボーディング**: 初回サインアップ時にモーダルで通知許可を促す（sessionStorageでフラグ管理、スキップ可能）
18. **デバイスコンテキスト検知**: User-AgentとCSS `display-mode: standalone` でPC/スマホ、ブラウザ/PWAを判別し、適切な案内文言を表示
19. **家族グループ共有**: 1ユーザー1グループ制約、招待コード方式（6文字英数字）、グループ所有の家電は全メンバーが編集・削除可能、メンテナンス完了は全員に反映
20. **グループ家電の所有権管理**: `user_appliances` テーブルに `group_id` を追加、個人所有（`user_id` 設定）またはグループ所有（`group_id` 設定）の排他制約
21. **QA会話履歴**: セッション単位で会話を管理し、文脈を保持した質問応答を実現（6時間タイムアウト、LLMによるタイトル自動生成）
22. **SWRによるデータフェッチ**: クライアントサイドキャッシュとリバリデーションでUX向上（dedupingInterval=60秒、revalidateOnFocus=false）
23. **N+1問題の解消**: ループ内クエリを`in_()`による一括クエリに変更し、DB負荷を70〜97%削減
24. **リッチテキスト表示**: DOMPurifyによるサニタイズ済みHTML表示でセキュアなリッチテキスト対応
25. **ユーザーティア機能**: 無料ティアでの利用制限（家電登録数、説明書検索回数/日、QA質問回数/日）を実装、日次使用量をトラッキング
26. **パナソニック製品直接検索**: Panasonic公式サイトから説明書PDFを直接取得（Google CSE不要、より確実なPDF取得）
27. **グループ自動共有**: グループ所属ユーザーが新規登録した家電は自動的にグループ共有される
28. **PDFビューア（react-pdf）**: iOS Safari/PWA対応のため、カスタムPDFビューアを実装（ピンチズーム、スワイプ、CJKフォント対応）
29. **PDF暗号化自動解除**: pikepdfでオーナーパスワードを自動解除、ユーザーパスワード付きPDFはブラウザ表示にフォールバック
30. **購入日起算のメンテナンス計算**: dateutil.relativedeltaによる正確な月次計算（月末境界対応）、カレンダーUIで次回予定日を直接編集可能
