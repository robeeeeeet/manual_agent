# プロジェクト概要

## 目的
説明書管理 & メンテナンスリマインドアプリ

家電や住宅設備の説明書を管理し、メンテナンス項目をリマインドするWebアプリ。
AIを活用して商品認識・説明書取得・メンテナンス項目抽出を自動化する。

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
├── CLAUDE.md              # AI向けガイド
├── CHANGELOG.md           # 変更履歴
├── docs/                  # ドキュメント
├── frontend/              # Next.js アプリケーション
│   ├── src/app/           # App Router（ページ、APIルート）
│   │   ├── api/           # BFF層 API Routes
│   │   ├── auth/callback/ # 認証コールバック
│   │   ├── login/         # ログインページ
│   │   ├── signup/        # 新規登録ページ
│   │   ├── register/      # 家電登録ページ
│   │   ├── appliances/    # 家電一覧ページ
│   │   ├── maintenance/   # メンテナンス一覧ページ（NEW）
│   │   └── mypage/        # マイページ
│   ├── src/components/    # UIコンポーネント
│   │   ├── auth/          # 認証関連（AuthForm）
│   │   ├── layout/        # レイアウト（Header, Footer）
│   │   ├── ui/            # 汎用UI（Button, Card, Modal）
│   │   ├── appliances/    # 家電関連コンポーネント
│   │   ├── maintenance/   # メンテナンス関連コンポーネント（NEW）
│   │   │   ├── MaintenanceCompleteModal.tsx
│   │   │   ├── MaintenanceStatusTabs.tsx
│   │   │   ├── MaintenanceFilter.tsx
│   │   │   └── MaintenanceListItem.tsx
│   │   ├── notification/  # 通知関連（NotificationPermission）
│   │   └── qa/            # QA機能関連
│   ├── src/contexts/      # React Context（AuthContext）
│   ├── src/types/         # 型定義（appliance.ts）
│   ├── src/lib/           # ユーティリティ
│   │   ├── supabase/      # Supabaseクライアント
│   │   └── api.ts         # APIクライアント
│   └── src/middleware.ts  # Next.js ミドルウェア
├── backend/               # FastAPI アプリケーション
│   ├── app/
│   │   ├── api/routes/    # APIルート
│   │   │   ├── maintenance.py  # メンテナンス一覧API（NEW）
│   │   │   └── ...
│   │   ├── schemas/       # Pydanticスキーマ
│   │   ├── services/      # ビジネスロジック
│   │   └── main.py
│   └── supabase/          # DBスキーマ・マイグレーション
├── tests/phase0/          # Phase 0 検証スクリプト
└── .env                   # 環境変数（git管理外）
```

## 本番環境

| 環境 | URL |
|------|-----|
| フロントエンド | https://manual-agent-seven.vercel.app/ |
| バックエンドAPI | https://manual-agent-api-36vsycvgwa-an.a.run.app |

## 現在のステータス

**Phase 6: QAマークダウン方式 質問応答機能** 実装済み

### 実装済み機能（Phase 0〜6）
- 共有マスター方式のデータベース設計（shared_appliances / user_appliances）
- メンテナンス項目キャッシュシステム（shared_maintenance_items）
- 家電CRUD API（バックエンド + BFF層）
- 説明書検索・PDF保存・確認フロー
- メンテナンス項目抽出・登録フロー
- 家電一覧ページ（/appliances）
- 家電詳細ページ（/appliances/[id]）、メンテナンス詳細モーダル
- 家電登録画面（ラベル位置ガイド、手動入力、カテゴリ選択）
- メンテナンス項目選択UI（チェックボックス式）
- メンテナンス完了記録API（バックエンド + BFF層）
- 履歴取得API（バックエンド + BFF層）
- 完了記録UI（完了ボタン、メモ入力モーダル）
- 履歴表示UI（履歴モーダル、日時・メモ表示）
- 家電一覧の次回メンテナンス表示（バッジ）
- フロントエンド型定義（src/types/appliance.ts, src/types/qa.ts）
- Modalコンポーネント
- **PWA対応（manifest.json, Service Worker, アイコン）**
- **Push通知基盤（購読管理、通知送信サービス）**
- **メンテナンスリマインド通知（期限当日・期限間近の通知）**
- **通知許可UIコンポーネント（NotificationPermission, NotificationPermissionModal）**
- **初回サインアップ時の通知オンボーディングフロー（NotificationOnboarding）**
- **デバイスコンテキスト検知フック（useDeviceContext: PC/スマホ、ブラウザ/PWA判別）**
- **マイページ機能（メンテナンス統計、通知設定、通知時刻変更、ログアウト）**
- **ユーザー設定API（プロファイル取得、設定更新、統計取得）**
- **QA質問応答機能（家電詳細ページに統合）**
  - QAチャットUI（QASection, QAChat, QAChatMessage）
  - 3段階フォールバック検索（QA検索 → テキスト検索 → PDF分析）
  - SSEストリーミング進捗表示（SearchProgressIndicator）
  - QAフィードバック機能（いいね/悪いね評価）
  - QAサービス群（qa_service, qa_chat_service, qa_rating_service）
  - テキストキャッシュサービス（text_cache_service）
  - QA不正利用防止機能（qa_abuse_service）
    - 認証必須化（ログインユーザーのみQA機能利用可）
    - ルールベース + LLM ハイブリッド質問検証
    - 違反記録・段階的利用制限（1回目=警告、2回目=1時間、3回目=24時間、4回目以降=7日間）
- **メンテナンス一覧機能（/maintenance）**
  - メンテナンス一覧ページ（ステータス別タブ、フィルタ機能）
  - 共通コンポーネント（MaintenanceCompleteModal, MaintenanceStatusTabs, MaintenanceFilter, MaintenanceListItem）
  - 家電詳細ページと統一されたUI/UX
  - バックエンドAPI（`GET /api/v1/maintenance`）

### 次のフェーズ
- Phase 7: 追加機能・改善（検討中）

## 重要な設計判断

1. **AI優先アプローチ**: 手動入力よりAI自動認識を優先
2. **PDF保存方式**: リンク保存ではなくPDFダウンロード保存
3. **カテゴリ**: 事前定義リスト + 自由入力の両対応
4. **認証・DB・ストレージ**: Supabaseで一元管理
5. **HEIC対応**: サーバーサイド変換（pillow-heif）でiPhone写真に対応
6. **認証フロー**: @supabase/ssr + ミドルウェアによるルート保護、サインアップ時はOTPコード方式（PWA対応のためメールリンク方式から変更）、確認コード再送機能（Supabaseレート制限対応・日本語カウントダウン表示）、未認証ユーザーは全保護ルート（`/`, `/appliances`, `/register`, `/mypage`, `/maintenance`）からログインページへリダイレクトされ、ログイン後は元のページに戻る（`redirectTo`クエリパラメータ）
7. **共有マスター方式**: 同一メーカー・型番の家電は`shared_appliances`で共有し、ユーザー所有関係は`user_appliances`で管理
8. **メンテナンスキャッシュ**: LLM抽出結果を`shared_maintenance_items`にキャッシュし、2人目以降のコスト・時間を削減
9. **auth.users同期トリガー**: `auth.users`への登録・削除時に`public.users`を自動同期（00007マイグレーション）
