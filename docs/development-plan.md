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
- [x] API エンドポイント設計・実装
- [x] Supabase 接続テスト (`/health/supabase`)

#### 1-3. Next.js フロントエンド
- [x] Next.js 16 プロジェクト作成（App Router）
- [x] Tailwind CSS 4 セットアップ
- [x] 基本レイアウト・コンポーネント（Header, Footer, Button, Card）
- [x] API Routes（BFF層）
- [x] 家電登録画面（画像アップロード → AI解析）

#### 1-4. Supabase 設定
- [x] プロジェクト作成
- [x] PostgreSQL スキーマ設計・作成（マイグレーションファイル）
- [x] pgvector 拡張有効化（RAG 用）
- [x] Auth 設定（メール認証）
- [x] Storage バケット作成（manuals, images）
- [x] RLS ポリシー設定

---

### Phase 1.5: デプロイ基盤構築 🚀

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

#### 1.5-4. 動作確認
- [ ] Vercel → Cloud Run API 疎通確認
- [ ] Cloud Run → Supabase 接続確認
- [ ] CORS 設定確認
- [ ] 画像アップロード → AI 解析 E2E 確認

---

### Phase 2: 認証
- [ ] Supabase Auth 連携（フロントエンド）
- [ ] ログイン/新規登録画面
- [ ] 認証状態管理

### Phase 3: 家電登録・説明書取得
- [ ] 家電登録画面
- [ ] 画像アップロード → AI 解析連携
- [ ] 手動入力フォーム
- [ ] 説明書 Web 検索・保存

---

### Phase 3.5: 初回プロダクションリリース 📱

**マイルストーン**: スマートフォンで製品登録・マニュアル取得ができる状態

#### 3.5-1. 本番環境準備
- [ ] 本番用環境変数設定
- [ ] Supabase 本番プロジェクト設定（必要に応じて）
- [ ] セキュリティ確認（API キー露出、認証チェック等）

#### 3.5-2. スマホ対応確認
- [ ] レスポンシブデザイン動作確認（iOS Safari, Android Chrome）
- [ ] タッチ操作の使いやすさ確認
- [ ] 画像アップロード動作確認（カメラ撮影含む）
- [ ] UI/UX 微調整

#### 3.5-3. パフォーマンス確認
- [ ] ページ読み込み速度確認
- [ ] API レスポンス時間確認
- [ ] 画像アップロード速度確認

#### 3.5-4. リリース
- [ ] 本番デプロイ実施
- [ ] 動作確認（実機テスト）
- [ ] 🎉 スマホでアクセス可能に！

---

### Phase 4: メンテナンス管理
- [ ] メンテナンス項目抽出（AI）
- [ ] 家電一覧画面（次回作業日順）
- [ ] 完了記録機能

### Phase 5: 通知・PWA
- [ ] PWA Push 通知実装
- [ ] Service Worker 設定
- [ ] レスポンシブ最適化

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

**現在のフェーズ**: Phase 2（認証）または Phase 3（家電登録・説明書取得）

### 進捗サマリー

| フェーズ | ステータス | 備考 |
|---------|-----------|------|
| Phase 0 | ✅ 完了 | 3機能すべて100%成功、Go判定 |
| Phase 1 | ✅ 完了 | FastAPI + Next.js + Supabase 基盤構築 |
| Phase 1.5 | ✅ 完了 | Vercel + Cloud Run + CI/CD 構築完了 |
| Phase 2 | ⚪ 未着手 | 認証 |
| Phase 3 | ⚪ 未着手 | 家電登録・説明書取得 |
| Phase 3.5 | ⚪ 未着手 | **📱 初回リリース（スマホ確認可能）** |
| Phase 4 | ⚪ 未着手 | メンテナンス管理 |
| Phase 5 | ⚪ 未着手 | 通知・PWA |
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

Phase 1 が完了したため、以下のいずれかに進む：

### オプション A: Phase 1.5（デプロイ基盤構築）🚀

継続的デプロイ環境を先に構築し、以降の開発をステージング環境で確認しながら進める。

1. **Vercel** でフロントエンドデプロイ
2. **Railway/Render** でバックエンドデプロイ
3. **GitHub Actions** で CI/CD パイプライン構築

### オプション B: Phase 2（認証）

ローカル開発を継続し、認証機能を実装する。

1. **Supabase Auth** 連携（フロントエンド）
2. **ログイン/新規登録画面** 実装
3. **認証状態管理** 実装
