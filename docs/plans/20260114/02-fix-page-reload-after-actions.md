# 修正計画: 家電登録・削除・メンテナンス完了後の画面更新

## 概要
家電の登録・削除、メンテナンスの完了などを行った後、画面が再読込されず元の表示が残る問題を修正する。各操作完了後にページをリロードして最新の状態を表示する。

## 現状分析

### 問題
- SWRの `refetch()` や `mutate()` は呼ばれているが、UIが即座に更新されない場合がある
- ユーザーは変更後に最新の状態を確認したい

### 対象箇所

#### 1. 家電登録後
- ファイル: `frontend/src/app/register/page.tsx`
- 登録成功後に家電一覧へ遷移（`router.push("/appliances")`）

#### 2. 家電削除後
- ファイル: `frontend/src/app/appliances/[id]/page.tsx`
- `handleDelete` 関数（227-244行目）
- `mutate("/api/appliances")` → `router.push("/appliances")` の流れ

#### 3. メンテナンス完了後
- ファイル: `frontend/src/app/maintenance/page.tsx`
  - `handleCompleteSuccess` 関数（102-106行目）
  - `refetch()` を呼び出し
- ファイル: `frontend/src/app/appliances/[id]/page.tsx`
  - `handleComplete` 関数（513-551行目）
  - `fetchSchedules()` を呼び出し

## 修正方針

`window.location.reload()` を使用してページ全体をリロードする。

### 理由
- SWRのキャッシュ無効化だけでは、関連する複数のデータ（家電一覧、メンテナンス一覧、統計情報など）すべてを同期させることが難しい
- ページリロードにより確実に最新データが表示される
- UX的にも「操作が完了した」という明確なフィードバックになる

## 修正内容

### 1. メンテナンス一覧ページ
ファイル: `frontend/src/app/maintenance/page.tsx`

```tsx
// 修正前
const handleCompleteSuccess = () => {
  setShowCompleteModal(false);
  setSelectedItem(null);
  refetch();
};

// 修正後
const handleCompleteSuccess = () => {
  setShowCompleteModal(false);
  setSelectedItem(null);
  window.location.reload();
};
```

### 2. 家電詳細ページ - メンテナンス完了
ファイル: `frontend/src/app/appliances/[id]/page.tsx`

```tsx
// 修正前（handleComplete内、540-542行目付近）
setShowCompleteModal(false);
setSelectedSchedule(null);
setCompletionNotes("");

// 修正後
setShowCompleteModal(false);
setSelectedSchedule(null);
setCompletionNotes("");
window.location.reload();
```

### 3. 家電詳細ページ - 削除
ファイル: `frontend/src/app/appliances/[id]/page.tsx`

```tsx
// 修正前（handleDelete内）
await mutate("/api/appliances");
router.push("/appliances");

// 修正後 - router.pushの後にリロードは不要（新しいページに遷移するため）
// ただし、遷移先でデータが古い場合は問題
// → 遷移先でSWRがrevalidateするため基本的にOK
// 必要であれば: router.push("/appliances").then(() => router.refresh())
```

### 4. 家電登録ページ
ファイル: `frontend/src/app/register/page.tsx`

登録成功後に `router.push("/appliances")` で遷移。遷移先でSWRが再取得するため、基本的には追加修正不要。
ただし、確実性を高めるなら `router.refresh()` を追加。

## 対象ファイル
- `frontend/src/app/maintenance/page.tsx`
- `frontend/src/app/appliances/[id]/page.tsx`
- （必要に応じて）`frontend/src/app/register/page.tsx`

## テスト観点
- [ ] 家電を登録 → 一覧ページに新しい家電が表示される
- [ ] 家電を削除 → 一覧ページから削除された家電が消えている
- [ ] メンテナンスを完了（メンテナンス一覧から） → ステータスが更新される
- [ ] メンテナンスを完了（家電詳細から） → ステータスが更新される
- [ ] ホームページのメンテナンスバッジも最新状態になる

## 注意点
- `window.location.reload()` はページ全体を再読込するため、一時的に画面がちらつく
- より洗練された方法として `router.refresh()` (Next.js App Router) も検討可能だが、確実性を優先
