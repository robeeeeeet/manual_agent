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
│   │   │   ├── appliances/# 家電関連API（CRUD、説明書、メンテナンス）
│   │   │   ├── qa/        # QA関連API（質問応答、フィードバック）
│   │   │   ├── push/      # Push通知API（subscribe, unsubscribe等）
│   │   │   ├── notifications/ # 通知API（reminders等）
│   │   │   └── user/      # ユーザーAPI（me, settings, maintenance-stats）
│   │   ├── auth/callback/ # 認証コールバック
│   │   ├── login/         # ログインページ
│   │   ├── signup/        # 新規登録ページ
│   │   ├── register/      # 家電登録ページ
│   │   ├── appliances/    # 家電一覧・詳細ページ
│   │   │   └── [id]/      # 家電詳細ページ（動的ルート）
│   │   └── mypage/        # マイページ（統計、設定、ログアウト）
│   ├── src/components/    # UIコンポーネント
│   │   ├── auth/          # 認証関連（AuthForm）
│   │   ├── layout/        # Header, Footer
│   │   ├── notification/  # 通知コンポーネント（NotificationPermission）
│   │   ├── qa/            # QA機能（QASection, QAChat, QAChatMessage, QAFeedbackButtons, SearchProgressIndicator）
│   │   └── ui/            # Button, Card, Modal
│   ├── src/hooks/         # カスタムフック
│   ├── src/types/         # 型定義（appliance.ts, user.ts, qa.ts）
│   ├── src/contexts/      # React Context（AuthContext）
│   ├── src/lib/           # ユーティリティ
│   │   ├── supabase/      # Supabaseクライアント
│   │   └── api.ts         # バックエンドAPIクライアント
│   ├── src/middleware.ts  # Next.js ミドルウェア（ルート保護）
│   └── package.json
├── backend/               # FastAPI アプリケーション
│   ├── app/
│   │   ├── api/routes/    # APIルート（appliances, manuals, notifications, push, users, qa, cron）
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
│   │   │   ├── supabase_client.py       # Supabaseクライアント
│   │   │   ├── manufacturer_domain.py   # メーカードメイン
│   │   │   ├── qa_service.py            # QA検索・生成サービス
│   │   │   ├── qa_chat_service.py       # QAチャット（LLM対話）
│   │   │   ├── qa_rating_service.py     # QAフィードバック評価
│   │   │   ├── qa_abuse_service.py      # QA不正利用防止（質問検証、違反記録、利用制限）
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

**Phase 6: QAマークダウン方式 質問応答機能** 実装済み

### 完了済み（Phase 0〜6）
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
  - 通知許可UIコンポーネント
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

### 次のフェーズ
- Phase 7: 追加機能・改善（検討中）

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
14. **認証リダイレクト**: 未認証ユーザーは全保護ルート（`/`, `/appliances`, `/register`, `/mypage`）からログインページへリダイレクトされ、ログイン後は元のページに戻る（`redirectTo`クエリパラメータ）
15. **QAマークダウン方式**: RAG（ベクトル検索）ではなく、事前生成したQAマークダウンファイルによる検索と3段階フォールバック（QA検索 → テキスト検索 → PDF直接分析）
16. **SSEストリーミング**: QA検索の進捗をリアルタイムでフロントエンドに伝達（ユーザー体験向上）
