# 家電詳細ページ総合改善

## ブランチ名
`fix/appliance-detail`

## 背景
家電詳細ページに複数の問題があり、まとめて修正する。

## タスク

### 1. メンテナンス項目が表示されないバグ修正 🔴 最優先
- 家電詳細ページ（`/appliances/[id]`）でメンテナンス項目が表示されない
- メンテナンス一覧ページでは問題なく表示される
- 原因を調査し修正すること

### 2. 戻るボタンの動的切り替え
- 現在: 固定の戻るボタン
- 要望: 遷移元に応じて戻り先を切り替え
  - 家電一覧から来た場合 → 「家電一覧に戻る」
  - メンテナンス一覧から来た場合 → 「メンテナンス一覧に戻る」
- 実装案: `router.query` やセッションストレージで遷移元を保持

### 3. 取説URLの改善
- 現在: 外部サイトのPDFリンクを表示
- 要望:
  - メインリンク → Supabase StorageのPDFリンクに変更
  - サブリンク → 元サイトのPDFリンクを小さく追加（「元のサイトで見る」等）
- `shared_appliances.manual_url` と Storage URL の両方を活用

## 関連ファイル
- `frontend/src/app/appliances/[id]/page.tsx`
- `frontend/src/app/api/appliances/[id]/route.ts`
- `backend/app/api/routes/appliances.py`
- `backend/app/services/appliance_service.py`

## 確認事項
- 修正後、Playwright MCPでスマホサイズ（390x844）で動作確認すること
- テストユーザーでログインして確認
