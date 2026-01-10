# 待機処理の進捗表示ルール

## 原則

**段階的な処理を行う機能では、必ず進捗表示を実装すること。**

単純なスピナーや「処理中...」だけでは、ユーザーは何が起きているか分からず不安になる。

## 適用基準

以下のいずれかに該当する場合、進捗表示が必須：

1. **複数ステップの処理**: 順番に複数の処理を行う場合
2. **長時間処理**: 3秒以上かかる可能性がある処理
3. **フォールバック処理**: 1つの方法で失敗したら別の方法を試す場合

## 実装パターン

### SSEストリーミング方式（推奨）

バックエンドから進捗をリアルタイムに送信：

```python
# バックエンド: AsyncGenerator でイベントを yield
async def process_stream() -> AsyncGenerator[Event, None]:
    yield Event(event="step_start", step=1, step_name="データベース検索中...")
    result = await search_database()
    yield Event(event="step_complete", step=1)
    # 次のステップへ...
```

```typescript
// フロントエンド: fetch + ReadableStream で受信
const reader = response.body?.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // イベントをパースして UI を更新
}
```

### UI表示の要素

1. **現在のステップ名**: 何をしているかを具体的に表示
2. **ステップインジケータ**: 全体の中での位置を視覚化
3. **完了ステップ**: どこまで進んだかをチェックマークで表示

## 実装例

QA機能での3段階検索フローの進捗表示:

```
🔄 PDFを詳細分析中...

[✓ QA検索] ─── [✓ テキスト検索] ─── [● PDF分析]
```

## 注意点

- 処理が早く終わった場合でも、一瞬だけ進捗表示が見えるのは問題ない
- 各ステップの開始時と完了時の両方でイベントを発行する
- エラー発生時もエラーイベントを送信し、UI側で適切に処理する
