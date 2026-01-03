# コードスタイル & 規約

## Python (バックエンド)

### ファイル構成
- `app/api/routes/` - FastAPI ルーター（エンドポイント定義）
- `app/schemas/` - Pydantic モデル（リクエスト/レスポンス型）
- `app/services/` - ビジネスロジック（AI処理等）
- `app/config.py` - 設定（pydantic-settings）

### スタイル
- Python 3.12+
- 型ヒント必須（`str`, `int`, `list[str]`, `dict[str, Any]`）
- Pydantic v2 使用（`BaseModel`）
- 非同期関数（`async def`）を積極的に使用
- docstring: """日本語説明"""
- snake_case（関数名、変数名）
- PascalCase（クラス名）

### FastAPI パターン
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class RequestSchema(BaseModel):
    field: str

@router.post("/endpoint")
async def endpoint_name(request: RequestSchema):
    """エンドポイントの説明"""
    return {"result": "value"}
```

## TypeScript (フロントエンド)

### ファイル構成
- `src/app/` - Next.js App Router (ページ、APIルート)
  - `api/` - BFF層 API Routes
  - `auth/` - 認証関連ルート（callback）
  - `login/`, `signup/` - 認証ページ
  - `register/` - 家電登録ページ
- `src/components/` - Reactコンポーネント
  - `auth/` - 認証関連（AuthForm）
  - `layout/` - レイアウトコンポーネント（Header, Footer）
  - `ui/` - 汎用UIコンポーネント（Button, Card）
  - `appliances/` - 家電関連コンポーネント（未実装）
- `src/contexts/` - React Context（AuthContext）
- `src/lib/` - ユーティリティ
  - `supabase/` - Supabaseクライアント（client, server, middleware）
- `src/middleware.ts` - Next.js ミドルウェア（ルート保護）

### スタイル
- TypeScript 5+
- 型は明示的に定義（`interface`, `type`）
- React 19 + Next.js 16 (App Router)
- Tailwind CSS 4（クラス直書き）
- コンポーネントは関数コンポーネント

### コンポーネントパターン
```tsx
interface Props {
  prop: string;
}

export default function ComponentName({ prop }: Props) {
  return (
    <div className="tailwind-classes">
      {prop}
    </div>
  );
}
```

## コミットメッセージ

```
<type>: <subject>

<body>
```

**type**:
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `refactor`: リファクタリング
- `test`: テスト
- `chore`: その他

## ブランチ戦略

- `master`: 本番ブランチ
- `feature/*`: 機能開発ブランチ
- `fix/*`: バグ修正ブランチ
