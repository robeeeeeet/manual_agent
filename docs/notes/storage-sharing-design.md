# Storage共有機能の技術メモ

Phase 7「家族グループ共有」実装時の参考資料。

## 現状の設計（Phase 1）

### RLSポリシー

現在のStorageポリシーは**個人利用を前提**としている：

```sql
-- ユーザーは自分のフォルダのみアクセス可能
auth.uid()::text = (storage.foldername(name))[1]
```

**ファイルパス規則:**
```
{bucket_name}/{user_id}/{appliance_id}/filename.ext
例: manuals/550e8400-e29b-41d4-a716-446655440000/abc123/manual.pdf
```

### 制約

- ユーザーAがアップロードしたファイルは、ユーザーBからは見えない
- アプリ側で「共有」しても、Storage側のRLSで弾かれる

## Phase 7 実装時の選択肢

### 方法1: サーバーサイドでRLSバイパス（推奨）

FastAPI側でSecret Keyを使用し、RLSをバイパスしてファイルを取得。
アプリケーションロジックで共有権限をチェックする。

```
クライアント
    ↓ リクエスト
Next.js API Routes
    ↓ 共有権限チェック（DBで確認）
FastAPI（Secret Key使用）
    ↓ RLSバイパス
Supabase Storage
    ↓ ファイル取得
クライアントへ返却
```

**メリット:**
- RLSポリシーをシンプルに保てる
- 複雑な共有ロジックをアプリ側で柔軟に実装可能
- デバッグしやすい

**デメリット:**
- サーバーサイドを経由するため、直接URLでのアクセス不可
- レイテンシが若干増加

**実装例（FastAPI）:**
```python
from supabase import create_client

# Secret Key でクライアント作成（RLSバイパス）
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SECRET_KEY")
)

async def get_shared_manual(
    appliance_id: str,
    current_user_id: str
):
    # 1. アプリロジックで共有権限チェック
    appliance = await get_appliance(appliance_id)
    if not await has_access(current_user_id, appliance):
        raise HTTPException(403, "Access denied")

    # 2. Secret Key でファイル取得（RLSバイパス）
    file_path = f"{appliance.owner_id}/{appliance_id}/manual.pdf"
    response = supabase.storage.from_("manuals").download(file_path)
    return response
```

### 方法2: 共有用RLSポリシー追加

Storageポリシーで共有テーブルを参照し、共有されたファイルへのアクセスを許可。

**必要なテーブル:**
```sql
-- 家族グループ
CREATE TABLE families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    invite_code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 家族メンバー
CREATE TABLE family_members (
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (family_id, user_id)
);

-- 家電の家族共有設定
CREATE TABLE appliance_shares (
    appliance_id UUID REFERENCES appliances(id) ON DELETE CASCADE,
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    shared_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (appliance_id, family_id)
);
```

**Storageポリシー:**
```sql
-- 自分のファイル + 共有されたファイルを閲覧可能
CREATE POLICY "Users can view own and shared manuals"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'manuals'
    AND (
        -- 自分のファイル
        auth.uid()::text = (storage.foldername(name))[1]
        OR
        -- 共有されたファイル
        EXISTS (
            SELECT 1
            FROM appliances a
            JOIN appliance_shares ash ON a.id = ash.appliance_id
            JOIN family_members fm ON ash.family_id = fm.family_id
            WHERE fm.user_id = auth.uid()
            AND a.user_id::text = (storage.foldername(name))[1]
            AND a.id::text = (storage.foldername(name))[2]
        )
    )
);
```

**メリット:**
- クライアントから直接Storage URLでアクセス可能
- サーバーを経由しないため高速

**デメリット:**
- RLSポリシーが複雑になる
- 共有ロジックの変更時にポリシー更新が必要
- デバッグが困難

### 方法3: 署名付きURL（Signed URLs）

サーバーサイドで一時的なアクセス用URLを生成。

```python
# 有効期限付きURLを生成
signed_url = supabase.storage.from_("manuals").create_signed_url(
    path=f"{owner_id}/{appliance_id}/manual.pdf",
    expires_in=3600  # 1時間
)
```

**メリット:**
- 一時的なアクセス権限を付与可能
- 外部共有（家族以外）にも対応可能

**デメリット:**
- URL有効期限の管理が必要
- 毎回URLを生成する必要がある

## 推奨アプローチ

**Phase 7では「方法1: サーバーサイドでRLSバイパス」を推奨**

理由:
1. 現在のシンプルなRLSポリシーを維持できる
2. 共有ロジックの変更に柔軟に対応可能
3. 将来的に複雑な共有条件（編集権限、期限付き共有等）にも対応しやすい

## 関連ドキュメント

- `docs/requirements.md` - 将来拡張（家族共有機能）のテーブル構想
- `docs/development-plan.md` - Phase 7: 家族グループ共有
- `backend/supabase/SCHEMA.md` - 現在のスキーマ設計
