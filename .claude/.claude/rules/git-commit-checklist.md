# Git コミット前チェックリスト

## コミット前の確認事項

### 1. node_modules の確認

`git status` で `node_modules/` が含まれていないか確認すること。

```bash
git status | grep node_modules
```

**特に注意**: `backend/` ディレクトリにも `package.json` がある場合、そこにも `node_modules/` が生成される可能性がある。

修正方法:
```bash
echo "backend/node_modules/" >> .gitignore
git rm -r --cached backend/node_modules/
```

### 2. デバッグコードの確認

コミット前に `print()` 文や `console.log` が残っていないか確認:

```bash
# Python
grep -r "print(" backend/app/ --include="*.py" | grep -v "__pycache__"

# TypeScript/JavaScript
grep -r "console.log\|debugger" frontend/src/ --include="*.ts" --include="*.tsx"
```

**例外**: Service Worker やエラーハンドリング内の `console.error` は許容される場合がある。

### 3. Python でのログ出力

`print()` ではなく `logging` モジュールを使用すること:

```python
import logging
logger = logging.getLogger(__name__)

# Bad
print(f"Error: {e}")

# Good
logger.error(f"Error: {e}")
```
