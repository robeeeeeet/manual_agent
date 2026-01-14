# 修正計画: お問い合わせ完了後のスクロール位置

## 概要
お問い合わせフォーム送信後、完了画面が表示されるが、画面が下にスクロールされたままになっている。完了画面は一番上から表示されるべき。

## 現状分析

### 問題箇所
- ファイル: `frontend/src/app/contact/page.tsx`
- 行: 119行目

```tsx
setSubmitted(true);
// ここでスクロール位置がリセットされていない
```

### 原因
- フォーム入力中にユーザーが下にスクロールしている
- `setSubmitted(true)` で完了画面コンポーネントに切り替わるが、スクロール位置はそのまま維持される
- 結果として、完了画面の下部（または空白部分）が表示された状態になる

## 修正内容

### 変更点
`setSubmitted(true)` の直後に `window.scrollTo(0, 0)` を追加

### 修正後のコード
```tsx
// 修正前（119行目）
setSubmitted(true);

// 修正後
setSubmitted(true);
window.scrollTo(0, 0);
```

### 完全なコンテキスト（78-126行目付近）
```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!isFormValid || isSubmitting) return;

  setIsSubmitting(true);
  setError(null);

  try {
    // ... API呼び出し処理 ...

    // Check if webhook failed (spreadsheet sync)
    if (data.webhook_success === false) {
      setWebhookFailed(true);
    }

    setSubmitted(true);
    window.scrollTo(0, 0);  // ← 追加
  } catch (err) {
    console.error("Submit error:", err);
    setError(err instanceof Error ? err.message : "送信に失敗しました");
  } finally {
    setIsSubmitting(false);
  }
};
```

## 対象ファイル
- `frontend/src/app/contact/page.tsx`

## 補足
`window.scrollTo(0, 0)` の代わりに以下も検討可能：

```tsx
// スムーズスクロール
window.scrollTo({ top: 0, behavior: 'smooth' });
```

ただし、画面が切り替わるタイミングなのでスムーズスクロールは不要。即座に上部を表示する方が自然。

## テスト観点
- [ ] お問い合わせページを開く
- [ ] フォームに入力（種類、画面、内容を入力）
- [ ] 送信ボタンをタップ
- [ ] 完了画面が**画面の一番上から**表示される
- [ ] 「トップに戻る」ボタンが見える位置にある
