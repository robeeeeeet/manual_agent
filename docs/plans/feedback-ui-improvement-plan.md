# フィードバックUI改善計画

## 目的
QA回答後のフィードバック率を向上させるため、目立つカードスタイルのUIに変更する

## 現状
- `QAFeedbackButtons.tsx`: 「この回答は役に立ちましたか？」+ 👍/👎 ボタン
- 小さくて目立たないため、ユーザーがフィードバックを送らない

## 変更内容

### 変更対象ファイル
- `frontend/src/components/qa/QAFeedbackButtons.tsx`

### UI変更

**Before:**
```
この回答は役に立ちましたか？ [👍] [👎]
```

**After（目立つカードスタイル）:**
```
┌─────────────────────────────────────┐
│  解決しましたか？                    │
│  ┌─────────┐  ┌─────────┐          │
│  │ はい ✓  │  │ いいえ ✗ │          │
│  └─────────┘  └─────────┘          │
└─────────────────────────────────────┘
```

## 実装

### QAFeedbackButtons.tsx の変更

```tsx
interface QAFeedbackButtonsProps {
  messageId: string;
  onFeedback: (messageId: string, isHelpful: boolean) => void;
}

export function QAFeedbackButtons({ messageId, onFeedback }: QAFeedbackButtonsProps) {
  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <p className="text-sm text-gray-700 font-medium mb-3">解決しましたか？</p>
      <div className="flex gap-3">
        <button
          onClick={() => onFeedback(messageId, true)}
          className="flex-1 px-4 py-2 bg-green-50 border border-green-300 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium"
        >
          はい ✓
        </button>
        <button
          onClick={() => onFeedback(messageId, false)}
          className="flex-1 px-4 py-2 bg-red-50 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium"
        >
          いいえ ✗
        </button>
      </div>
    </div>
  );
}
```

## デザインのポイント

1. **カード形式**: 背景色(`bg-gray-50`)と枠線で独立したセクションとして目立たせる
2. **質問文を上に配置**: メッセージ形式で「解決しましたか？」と問いかける
3. **大きめのボタン**: `flex-1`で均等幅、`py-2`で十分な高さを確保
4. **色付き背景**: `bg-green-50`/`bg-red-50`でボタン自体も目立たせる
5. **アイコン付きラベル**: 「はい ✓」「いいえ ✗」で直感的に理解できる

## 影響範囲
- フロントエンドのみの変更
- バックエンドAPIへの変更なし（`is_helpful: boolean` は変更なし）
- 機能的な変更なし（表示テキストとスタイルのみ）
