# メンテナンス詳細リッチテキスト化

## ブランチ名
`feature/rich-text`

## 背景
メンテナンスモーダルの詳細が生テキストで見づらい。

## タスク

### 1. バックエンド: LLM出力形式の変更
- `backend/app/services/maintenance_extraction.py` を修正
- プロンプトを変更してHTML形式（またはMarkdown）で出力させる
- 例:
  ```html
  <h4>手順</h4>
  <ol>
    <li>フィルターを取り外す</li>
    <li>水洗いする</li>
    <li>乾燥させて戻す</li>
  </ol>
  <p><strong>注意:</strong> 完全に乾かしてから装着してください</p>
  ```

### 2. DB/スキーマ
- `shared_maintenance_items.description` の型は `text` のままでOK
- HTMLを格納する

### 3. フロントエンド: リッチ表示対応
- `MaintenanceCompleteModal` などでHTMLをレンダリング
- `dangerouslySetInnerHTML` または `sanitize-html` でXSS対策
- スタイリング（リスト、太字等がきれいに表示されるように）

### 4. バッチ: 既存データ修正
- `backend/scripts/migrate_maintenance_description.py` を作成
- 既存の `shared_maintenance_items.description` を取得
- LLMでHTML形式に変換
- DBを更新
- 実行ログを出力

## 関連ファイル
- `backend/app/services/maintenance_extraction.py`
- `backend/scripts/migrate_maintenance_description.py` (新規作成)
- `frontend/src/components/maintenance/MaintenanceCompleteModal.tsx`
- `frontend/src/components/maintenance/MaintenanceListItem.tsx`

## 実装例（フロントエンド）
```tsx
import DOMPurify from 'dompurify';

// XSS対策してHTMLをレンダリング
<div
  className="prose prose-sm"
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(description)
  }}
/>
```

## 確認事項
- 新規登録した家電のメンテナンス詳細がリッチ表示されるか
- バッチ実行後、既存データもリッチ表示されるか
- XSS攻撃が防がれているか確認
