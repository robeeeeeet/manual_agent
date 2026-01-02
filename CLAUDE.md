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

## 技術スタック

- **言語**: Python 3.13+, TypeScript
- **フロントエンド**: Next.js 14+ (App Router), Tailwind CSS, PWA
- **バックエンド**: Supabase (PostgreSQL, Auth, Edge Functions)
- **ストレージ**: Google Cloud Storage
- **AI/LLM**: Gemini API
- **パッケージ管理**: uv

## コマンド

```bash
# Python環境
uv sync                    # 依存関係インストール
uv run python main.py      # メインスクリプト実行
uv run pytest              # テスト実行

# 将来的に追加（Next.js）
npm run dev                # 開発サーバー起動
npm run build              # ビルド
npm run lint               # リント
```

## ディレクトリ構造

```
manual_agent/
├── CLAUDE.md              # AI向けガイド（このファイル）
├── CHANGELOG.md           # 変更履歴
├── docs/
│   ├── requirements.md    # 要件定義書
│   └── development-plan.md # 開発計画書
├── tests/                 # テストコード
├── main.py                # メインエントリーポイント
├── pyproject.toml         # Python依存関係
└── .env                   # 環境変数（git管理外）
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

## 環境変数

```bash
# .env に設定が必要
GEMINI_API_KEY=           # Gemini API キー
SUPABASE_URL=             # Supabase URL（将来）
SUPABASE_ANON_KEY=        # Supabase Anonymous Key（将来）
```

## 現在のステータス

**Phase 0: フィジビリティ確認** 進行中

コアAI機能の検証が完了し、実現可能性を確認済み：
1. ✅ 画像からのメーカー・型番読み取り
2. ✅ メーカー・型番からマニュアルPDF取得
3. ✅ マニュアルからメンテナンス項目抽出

詳細は `docs/development-plan.md` を参照。

## 重要な設計判断

1. **AI優先アプローチ**: 手動入力よりAI自動認識を優先
2. **PDF保存方式**: リンク保存ではなくPDFダウンロード保存
3. **カテゴリ**: 事前定義リスト + 自由入力の両対応
4. **Supabase採用**: 認証・DB・Functionsを一元管理
