# メンテナンス名テキスト見切れ修正

## ブランチ名
`fix/text-overflow`

## 背景
トップページとメンテナンス一覧ページでメンテナンス名が見切れている。

## タスク

### 対象ページ
1. トップページ（`/`）のメンテナンス表示部分
2. メンテナンス一覧ページ（`/maintenance`）

### 修正方針
- 長いテキストの処理方法を検討:
  - `text-ellipsis` + `overflow-hidden` + `whitespace-nowrap` で省略表示
  - または `line-clamp-2` で2行まで表示して省略
  - ホバー時にツールチップで全文表示
- レスポンシブ対応（スマホでは特に幅が狭い）

## 関連ファイル
- `frontend/src/app/page.tsx`
- `frontend/src/app/maintenance/page.tsx`
- `frontend/src/components/maintenance/MaintenanceListItem.tsx`

## 実装例
```tsx
// Tailwind CSS での実装例
<span className="block truncate" title={maintenanceName}>
  {maintenanceName}
</span>

// または2行で省略
<p className="line-clamp-2">
  {maintenanceName}
</p>
```

## 確認事項
- 長いメンテナンス名（30文字以上）でテスト
- スマホサイズ（390x844）で確認
- タブレット、PCサイズでも確認
