---
paths: {.serena/memories/*.md}
---

# Serena メモリファイル編集時の注意点

## edit_memory ツールの使用

### リテラルモード vs 正規表現モード

Markdownファイルを編集する際、特殊文字（`*`, `[`, `]`, `(`, `)` など）が含まれている場合は **正規表現モード** を使用すること。

```python
# Bad: リテラルモードでMarkdownの特殊文字を含む検索
edit_memory(
    memory_file_name="project_overview",
    needle="**Phase 4** ✅ 完了",  # * が正規表現として解釈されない
    repl="...",
    mode="literal"
)

# Good: 正規表現モードで柔軟にマッチング
edit_memory(
    memory_file_name="project_overview",
    needle="## 現在のステータス.*?### 次のフェーズ",
    repl="...",
    mode="regex"
)
```

### 複数行の置換

正規表現モードでは `.*?` で複数行をマッチできる（DOTALL フラグが有効）。

ただし、貪欲マッチ（`.*`）ではなく非貪欲マッチ（`.*?`）を使用すること。
