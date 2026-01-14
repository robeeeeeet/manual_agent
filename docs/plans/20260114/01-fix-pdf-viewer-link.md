# 修正計画: メンテナンス一覧からPDFビューアで開かない問題

## 概要
メンテナンス一覧ページの詳細モーダルからPDFリンクをクリックすると、ブラウザネイティブのPDFビューアで開かれてしまう。react-pdfベースの `/pdf-viewer` ページで開くように修正する。

## 現状分析

### 問題箇所
- ファイル: `frontend/src/app/maintenance/page.tsx`
- 行: 453-465行目

```tsx
<a
  href={pdfSignedUrl}
  target="_blank"
  rel="noopener noreferrer"
  className="..."
>
  <span>PDF {selectedItem.pdf_page_number}ページ</span>
  ...
</a>
```

### 比較: 家電詳細ページの実装
- ファイル: `frontend/src/app/appliances/[id]/page.tsx`
- 行: 792, 1289行目

```tsx
<Link href={`/pdf-viewer?applianceId=${id}&page=${page}`}>
```

## 修正内容

### 変更点
1. `<a>` タグを Next.js の `<Link>` コンポーネントに変更
2. リンク先を `/pdf-viewer?applianceId=${item.appliance_id}&page=${item.pdf_page_number}` に変更
3. `import Link from "next/link"` の確認（既に存在するはず）

### 修正後のコード
```tsx
<Link
  href={`/pdf-viewer?applianceId=${selectedItem.appliance_id}&page=${selectedItem.pdf_page_number}`}
  className="text-sm text-[#007AFF] hover:text-[#0066DD] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
>
  <span>PDF {selectedItem.pdf_page_number}ページ</span>
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
</Link>
```

## 対象ファイル
- `frontend/src/app/maintenance/page.tsx`

## 補足
- `pdfSignedUrl` の事前取得ロジック（82-94行目）は引き続き使用可能だが、`/pdf-viewer` ページ側で署名付きURLを取得するため、メンテナンス一覧ページでの事前取得は不要になる可能性がある
- ただし、既存ロジックを残しても問題はない

## テスト観点
- [ ] メンテナンス一覧ページを開く
- [ ] 任意のメンテナンス項目をタップして詳細モーダルを開く
- [ ] PDFリンクをタップ
- [ ] `/pdf-viewer` ページで該当ページが表示される
- [ ] ピンチズーム、スワイプなどreact-pdfの機能が使える
