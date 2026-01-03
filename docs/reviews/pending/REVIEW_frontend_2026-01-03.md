# Frontendレビュー

対象: `frontend/`（Next.js App Router）  
作成日: 2026-01-03

## TL;DR（要約）

- **全体設計は良い**: `src/app/api/*` をBFFとして使い、ブラウザからは同一オリジンで叩ける構成になっている（CORS/秘匿情報露出の事故が起きにくい）。
- **ただし仕上げが必要**: フォント/スタイルの残骸、APIクライアントの重複、レスポンス型の乖離、エラー処理の一貫性、未使用依存などが見える。
- **短期の最優先**: フォント整合（`globals.css` と `layout.tsx`）、API呼び出し統一（`lib/api.ts` の拡張＋`register/page.tsx` の置換）、エラーフォーマット統一。

## 現状の構成（把握した範囲）

- **Next.js**: App Router（`src/app/*`）
- **BFF**: Route Handlers（`src/app/api/**/route.ts`）
  - `POST /api/appliances/recognize` → `${BACKEND_URL}/api/v1/appliances/recognize`
  - `POST /api/appliances/search-manual` → `${BACKEND_URL}/api/v1/manuals/search`
  - `POST /api/appliances/convert-heic` → `${BACKEND_URL}/api/v1/appliances/convert-heic`
  - `GET /api/health`
- **UI**: Tailwind CSS v4（`src/app/globals.css` に `@import "tailwindcss";`）
- **コンポーネント**: 最小構成（`src/components/ui/{Button,Card}.tsx`, `src/components/layout/{Header,Footer}.tsx`）
- **主要ページ**:
  - `/`（`src/app/page.tsx`）: LP + 空の家電一覧（現状はスタティック）
  - `/register`（`src/app/register/page.tsx`）: ステップ式登録（画像解析/手動入力、HEIC対応あり）

## 良い点

- **BFFの置き方が適切**:
  - `BACKEND_URL` はサーバ側（Route Handler）でのみ参照され、ブラウザへ環境変数が漏れにくい。
  - 画像アップロードもBFF経由になっており、将来の認証/レート制限/監査ログなどを入れやすい。
- **UI部品の責務がシンプル**: `Button` / `Card` が小さく再利用しやすい。
- **登録フローUXが素直**: 進捗ステップ表示、HEIC変換中のローディング、失敗時フォールバックなどの配慮がある。

## 指摘・改善提案（優先度順）

### 1) （高）フォント/スタイルが不整合（見た目が意図とズレる可能性）

- `src/app/layout.tsx` は `Noto_Sans_JP` のCSS変数 `--font-noto-sans-jp` を付与している。
- しかし `src/app/globals.css` の `@theme inline` が `--font-sans: var(--font-geist-sans);` を前提にしており、さらに `body { font-family: Arial, ... }` が指定されているため、**Tailwindの `font-sans` と実際のフォント適用が噛み合わない**可能性がある。

**提案**:
- `globals.css` を「Noto Sans JP を `--font-sans` に繋ぐ」か、「`body` の `font-family` を消して Tailwind に寄せる」など、方針を1つに揃える。

### 2) （高）API呼び出しが二重化しており、型も乖離

- `src/lib/api.ts` に `recognizeAppliance()` などのAPIクライアントがある一方で、`src/app/register/page.tsx` は `fetch("/api/appliances/recognize")` を直叩きしている。
- `register/page.tsx` が期待するフィールド（例: `is_new_category` など）と、`lib/api.ts` の `RecognizeResponse` が**一致していない**。
- `register` は `categories` を送っているが `lib/api.ts` は送っていない。

**提案**:
- `lib/api.ts` を単一の入口にして、`register/page.tsx` の `fetch` を置換する。
- `RecognizeResponse` を実レスポンスに合わせて拡張し、リクエストも `categories?: string[]` 等を受け取れるようにする。

### 3) （中）BFFのエラーフォーマットが統一されていない

現状のRoute Handlerは、失敗時に `{ error, details }` や `{ success: false, error, details }` のように揺れている。

**提案**:
- BFFのエラー形を固定する（例: `{ error: string, code: string, details?: unknown }` など）。
- フロント側は `alert()` ではなく、ページ内にエラーステートを表示できるようにする（再試行/ガイドも出せる）。

### 4) （中）`BACKEND_URL` のデフォルト値は本番で事故になりうる

`process.env.BACKEND_URL || "http://localhost:8000"` は開発では便利だが、環境変数設定漏れ時に「本番で localhost に投げる」事故の温床になる。

**提案**:
- 本番相当では `BACKEND_URL` 未設定を 500 で落とす、または起動時検証（ビルド/起動で fail fast）に寄せる。

### 5) （中）未使用依存: `heic2any`

`frontend/package.json` に `heic2any` があるが、`src/` 配下では参照が見当たらない。

**提案**:
- サーバ変換に寄せるなら依存を削除する。
- 逆に「クライアントでプレビュー生成したい」なら `heic2any` を活用し、BFFは「アップロード用」だけに絞る等、責務整理する。

### 6) （低〜中）アクセシビリティ/UXの細部

- モバイルメニューのトグルは `aria-label` はあるが、`aria-expanded` や `aria-controls` を入れるとより良い。
- 登録ページは複数の `<button>` があり、将来 `<form>` を導入した際の事故を避けるため `type="button"` を明示しておくと安全。

### 7) （低）`src/types/` が空

**提案**:
- 今後共通型を置く予定がないなら削除。
- 置くなら `api.ts` のレスポンス型を `types/` に切り出して責務を明確化。

## すぐ効く「短期改善」チェックリスト

- **フォント整合**: `globals.css` と `layout.tsx` のフォント変数を統一
- **APIクライアント統一**: `register/page.tsx` の `fetch` を `lib/api.ts` へ寄せる
- **レスポンス型整合**: `RecognizeResponse` を実データに合わせる
- **エラーUI**: `alert()` を置換（インライン表示 + 再試行）
- **依存整理**: `heic2any` の要否を決める（使う/消す）
- **環境変数**: `BACKEND_URL` 未設定時の挙動を fail fast に

## 参考: レビューで確認した主なファイル

- `frontend/package.json`
- `frontend/eslint.config.mjs`
- `frontend/tsconfig.json`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/register/page.tsx`
- `frontend/src/app/api/**/route.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/heicConverter.ts`
- `frontend/src/app/globals.css`
- `frontend/src/components/ui/{Button,Card}.tsx`
- `frontend/src/components/layout/{Header,Footer}.tsx`
