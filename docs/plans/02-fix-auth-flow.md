# 認証フロー改善

## ブランチ名
`fix/auth-flow`

## 背景
認証関連のUX問題を修正する。

## タスク

### 1. ログイン後のヘッダ遷移問題
- 現象: ログイン後、ヘッダが先に変わってからトップページへの遷移が遅れる
- 期待: ヘッダ変更とページ遷移が同時に見えるようにする
- 原因調査:
  - `AuthContext` の状態更新タイミング
  - `middleware.ts` のリダイレクト処理
  - ページコンポーネントでの認証状態監視
- 対策案:
  - 遷移完了までローディング表示
  - 認証状態確定後にヘッダを更新

### 2. パスワード忘れボタン追加
- ログインページ（`/login`）に「パスワードを忘れた方」リンクを追加
- Supabase Auth の `resetPasswordForEmail` を使用
- パスワードリセットページの作成（`/reset-password`）
- リセット完了後のリダイレクト処理

## 関連ファイル
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/reset-password/page.tsx` (新規作成)
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/middleware.ts`

## 参考
- Supabase Auth ドキュメント: パスワードリセットフロー
- 既存の認証コンポーネント: `frontend/src/components/auth/`

## 確認事項
- ログイン → 遷移のUXがスムーズか確認
- パスワードリセットメールが届くか確認
- スマホサイズで動作確認
