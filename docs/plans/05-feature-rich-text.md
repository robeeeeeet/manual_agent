# メンテナンス詳細リッチテキスト化 - 実装計画

## ブランチ名
`feature/rich-text`

## 概要

メンテナンス項目の `description` フィールドをプレーンテキストからHTML形式に変更し、リッチな表示を実現する。

## 実装タスク（実行順）

### 1. フロントエンド: パッケージ追加
```bash
cd frontend && npm install dompurify @types/dompurify @tailwindcss/typography
```

### 2. フロントエンド: Tailwind Typography 有効化
**ファイル**: `frontend/src/app/globals.css`

```css
@plugin "@tailwindcss/typography";
```

### 3. フロントエンド: SafeHtml コンポーネント作成
**ファイル**: `frontend/src/components/ui/SafeHtml.tsx` (新規)

- DOMPurifyでXSS対策
- 許可タグ: `h4`, `h5`, `ol`, `ul`, `li`, `p`, `strong`, `em`, `br`
- Tailwind `prose prose-sm` クラスでスタイリング

### 4. フロントエンド: 詳細モーダル修正（2箇所）

**4-1. 家電詳細ページ**
**ファイル**: `frontend/src/app/appliances/[id]/page.tsx`

変更前:
```tsx
<p className="text-gray-700">{selectedSchedule.description}</p>
```

変更後:
```tsx
<SafeHtml html={selectedSchedule.description} />
```

**4-2. メンテナンス一覧ページ**
**ファイル**: `frontend/src/app/maintenance/page.tsx`

変更前:
```tsx
<p className="text-gray-700">{selectedItem.description}</p>
```

変更後:
```tsx
<SafeHtml html={selectedItem.description} />
```

### 5. バックエンド: LLMプロンプト変更
**ファイル**: `backend/app/services/maintenance_extraction.py`

プロンプトに以下を追加：
- `description` をHTML形式で出力する指示
- 使用可能タグの説明（h4, ol, ul, li, p, strong）
- 手順は `<ol><li>` で記述する指示

### 6. バッチ: 既存データ変換スクリプト作成
**ファイル**: `scripts/migrate_maintenance_description.py` (新規)

- 既存の `shared_maintenance_items.description` を取得
- LLM（Gemini）でHTML形式に変換
- オプション: `--dry-run`, `--limit`, `--delay`
- 実行ログ出力

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/package.json` | dompurify, @tailwindcss/typography 追加 |
| `frontend/src/app/globals.css` | @plugin 追加 |
| `frontend/src/components/ui/SafeHtml.tsx` | 新規作成 |
| `frontend/src/app/appliances/[id]/page.tsx` | 詳細モーダルで SafeHtml 使用 |
| `frontend/src/app/maintenance/page.tsx` | 詳細モーダルで SafeHtml 使用 |
| `backend/app/services/maintenance_extraction.py` | プロンプト変更 |
| `scripts/migrate_maintenance_description.py` | 新規作成 |

## 検証方法

1. **フロントエンド動作確認**
   - 開発サーバー起動: `cd frontend && npm run dev`
   - 家電詳細ページでメンテナンス項目クリック → 詳細モーダルで description がリッチ表示されることを確認
   - メンテナンス一覧ページでも同様に確認

2. **XSS対策テスト**
   - `<script>alert('xss')</script>` を含む description がサニタイズされることを確認

3. **新規登録フロー**
   - 新しい家電を登録
   - LLM抽出結果の description がHTML形式であることを確認

4. **バッチ処理**
   - `--dry-run` で既存データの変換プレビュー
   - 本番実行後、既存データがリッチ表示されることを確認

## 注意事項

- **後方互換性**: プレーンテキストの description も SafeHtml で問題なく表示される
- **バッチ処理前**: DBバックアップ推奨
- **API コスト**: バッチ処理時の Gemini API 呼び出し回数に注意
