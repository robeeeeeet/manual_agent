# Skillレビュー: `supabase-integration`

対象: `.claude/skills/supabase-integration/`

## 良い点

- **範囲が広い**: PostgreSQL/Auth/Storage/pgvectorまで含み、アプリ要件に直結している。
- **RLSの導線**: RLSの基本例があり、マルチテナント（ユーザーごと）に必要な意識付けができている。
- **pgvector実装が具体的**: テーブル・インデックス・検索関数・Python例まで揃っている。

## 懸念点

- **RLS方針がテーブル全体で未固定**: `appliances` 以外（`maintenance_schedules` / `push_subscriptions` / `documents` 等）の方針がSKILLに集約されていないため、実装時に漏れやすい。
- **SQLの実行順依存**: `schema-design.md` は関数/トリガーの順序などで、一括実行時に詰まる可能性がある。
- **Service Role Keyの扱い**: 記載はあるが、配置場所・実行環境の境界（「絶対にクライアントに出さない」「Cron/サーバーのみ」）をもっと強調したい。

## 改善提案（優先度順）

1. **（高）RLS対象テーブル一覧とポリシー雛形を追加**
   - 「このプロジェクトでは原則全テーブルRLS」など方針を明文化し、各テーブルの最小ポリシー例を提示。
2. **（中）SQL実行手順（順序）を冒頭に追記**
   - functions → tables → indexes → triggers → policies のように固定する。
3. **（中）DoD（完了条件）を追加**
   - 例: 未認証でSELECTできない、自分の行のみ取得/更新できる、Storageのパス制約が効く、など。
