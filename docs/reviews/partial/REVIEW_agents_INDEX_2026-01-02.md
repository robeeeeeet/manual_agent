# Agentsレビュー（一覧）

対象: `.claude/agents/`  
作成日: 2026-01-02

## 対象エージェント一覧

- `manual-ai-processing`
- `fastapi-backend-dev`
- `nextjs-frontend-dev`
- `supabase-integration`
- `hybrid-architecture`
- `pwa-notification`
- `project-testing`

## 横断所見（要約）

- **統一フォーマットで揃っている**: YAMLフロントマター（`name/description/model/allowedTools`）+ 本文（担当範囲/参照Skill/責務/セキュリティ/DoD）で一貫しており、サブエージェントとしての“迷い”が少ないです。
- **Skill参照の導線が良い**: どのエージェントも「作業前に参照すべきSkill」を明示しており、運用時の品質が上がります。
- **注意点（重要）: 権限と実プロジェクト構造の整合**
  - 現リポジトリは Phase 0 の構造が中心で、`frontend/`・`backend/` は `CLAUDE.md` 上「計画（Phase 1で作成）」です。エージェント本文に登場するディレクトリ構造は **“将来の想定”** である旨を、各エージェント側に1行入れておくと混乱が減ります。
  - `.claude/settings.local.json` に **コマンド権限のallowlist** があり、`allowedTools: Bash` と書いてあっても、実際に任意のBashが通るとは限りません。エージェント側に「許可されていないコマンドはユーザーに確認して実行してもらう」等の前提を入れると事故が減ります。
- **依存/SDK方針のズレの芽**:
  - `manual-ai-processing` / `fastapi-backend-dev` は `google-genai` 採用＆ `google-generativeai` 非推奨を明記していますが、`pyproject.toml` には `google-generativeai` も入っています。意図的に残しているなら理由をどこかに明記、不要なら削除方針を決めると一貫します。

## 改善提案（優先度順）

1. **（高）権限（permissions）と `allowedTools` の整合を明文化**
   - `.claude/settings.local.json` の allowlist にないコマンド（例: `npm`, `uvicorn`, `pytest`, `playwright` 等）をエージェントが当然のように叩くと詰まります。
   - 提案: エージェント共通で「Bashが拒否されたら、代替手順（手動実行依頼/許可追加依頼）に切り替える」ルールを追記。

2. **（中）`allowedTools` の“最小権限化” or “意図の明確化”**
   - 全エージェントが `Read/Write/Edit/Glob/Grep/Bash` を持つ設計は実務的ですが、誤操作のリスクも上がります。
   - 提案: エージェントごとに「コード編集が主ならEdit/LSP」「設計レビュー主体ならRead中心」など、意図が伝わる一文を追加。

3. **（中）出力期待値（アウトプット契約）を追加**
   - 例: 「最終回答は `変更点 / 影響範囲 / 実行コマンド / 追加したファイル` を必ず箇条書きで出す」など。
   - エージェント間で出力粒度が揃うと、親エージェント側の統合が楽になります。

4. **（中）エラーフォーマット/ヘッダー名の“統一宣言”を1箇所に寄せる**
   - `hybrid-architecture` は `{error, code, details?}` を定義していますが、他エージェントでの参照が散りやすいです。
   - 提案: 代表となる定義場所（Skillやdocs）を固定し、各エージェントはそこを参照する形にする。

5. **（低）`allowedTools` の揺れ（`LSP` の有無など）を揃える**
   - `pwa-notification` / `supabase-integration` は `LSP` が無い一方で他は含まれます。運用上問題なければOKですが、意図していない抜けなら揃えると良いです。

## 各エージェント所見

### `manual-ai-processing`

- **良い点**:
  - 抽出パイプラインを「Schema Validation → 正規化 → 保存」の3段階で固定し、運用品質が上がる設計です。
  - 不確実性の扱い（`null` / `"low"` / `""`）まで明記されていて、下流実装が安定します。
- **気になる点**:
  - スキーマでは `page_reference` を使っている一方、不確実性テーブルでは `source_page` が登場します。**フィールド名をどちらかに統一**した方が良いです。

### `fastapi-backend-dev`

- **良い点**:
  - BFF→FastAPI認証（`X-Backend-Key`）を“必須依存”として書いており、`hybrid-architecture` と整合しています。
  - LLM呼び出しガード（リトライ/タイムアウト/JSONパース）をパターン化しているのは強いです。
- **改善提案**:
  - 例コードはコピペ即実行性（import/依存の前提）を少し補強すると、実装時の詰まりが減ります。

### `nextjs-frontend-dev`

- **良い点**:
  - Server/Client Component の使い分け基準や Supabase クライアント命名など、実装判断が具体です。
- **改善提案**:
  - BFF API Routes を触るケースが多いので、`hybrid-architecture` のエラーフォーマット/ヘッダーの参照を1行足すと迷いが減ります。

### `supabase-integration`

- **良い点**:
  - RLSを“原則全テーブル”で固定し、対象テーブルとポリシー概要が書かれているのが良いです。
- **改善提案**:
  - ここも Phase 1 以降で本格化するため、現状（Phase 0）ではDBが未導入である旨を前提として明記すると混乱が減ります。

### `hybrid-architecture`

- **良い点**:
  - 「ブラウザ→BFFのみ」「FastAPI直叩き禁止」を強く打ち出していて、CORSや秘匿情報漏洩の事故を防げます。
  - エラーレスポンス形式 `{error, code, details?}` が定義されているのは横断設計として有用です。
- **改善提案**:
  - `X-Backend-Key + X-User-ID` を送る前提が書かれているので、FastAPI側での検証（どのヘッダーを必須にするか）も“固定”しておくとさらに強いです。

### `pwa-notification`

- **良い点**:
  - VAPID秘密鍵の扱い、Cron保護、410時の購読削除まで入っていて現実的です。
  - iOS/Safari制約の注記があり、期待値調整ができます。
- **改善提案**:
  - `LSP` が無いのが意図でなければ、他と揃えると運用が楽です（※不要なら“入れない理由”を書くだけでもOK）。

### `project-testing`

- **良い点**:
  - pytest/Vitest/Playwright まで含めた“テストピラミッド”と責務が明確です。
- **注意点**:
  - 現リポジトリは Phase 0 構成のため、`frontend/`・`backend/` 前提のディレクトリ例は **将来構成** である旨の明記があると、現時点の作業者が迷いにくいです。
