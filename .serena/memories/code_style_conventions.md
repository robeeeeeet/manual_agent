# コードスタイル & 規約

## Python (バックエンド)

### ファイル構成
- `app/api/routes/` - FastAPI ルーター（エンドポイント定義）
- `app/schemas/` - Pydantic モデル（リクエスト/レスポンス型）
- `app/services/` - ビジネスロジック
  - 画像認識（image_recognition.py）
  - 説明書検索（manual_search.py）
  - メンテナンス抽出（maintenance_extraction.py）
  - メンテナンスキャッシュ（maintenance_cache_service.py）
  - 家電CRUD（appliance_service.py）
  - PDFストレージ（pdf_storage.py）
  - Supabaseクライアント（supabase_client.py）
  - メーカードメイン（manufacturer_domain.py）
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
  - `appliances/` - 家電一覧ページ
- `src/components/` - Reactコンポーネント
  - `auth/` - 認証関連（AuthForm）
  - `layout/` - レイアウトコンポーネント（Header, Footer）
  - `ui/` - 汎用UIコンポーネント（Button, Card, Modal）
  - `appliances/` - 家電関連コンポーネント
  - `notification/` - 通知関連（NotificationPermission, NotificationPermissionModal, NotificationOnboarding）
  - `qa/` - QA機能関連（QASection, QAChat, QAChatMessage, QAFeedbackButtons, SearchProgressIndicator）
- `src/types/` - 型定義（appliance.ts）
- `src/contexts/` - React Context（AuthContext）
- `src/lib/` - ユーティリティ
  - `supabase/` - Supabaseクライアント（client, server, middleware）
  - `api.ts` - バックエンドAPIクライアント
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

### Modalコンポーネント
```tsx
// variant="lightbox" (デフォルト) - 画像表示用（背景透明）
// variant="dialog" - ダイアログ用（白背景、角丸、シャドウ）
<Modal isOpen={isOpen} onClose={handleClose} variant="dialog">
  <div className="p-6">
    {/* ダイアログ内容 */}
  </div>
</Modal>
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
