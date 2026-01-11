# グループオーナー情報正規化 実装計画

## 概要

`groups.owner_id` と `group_members.role` の重複を解消し、オーナー情報を単一の情報源（`groups.owner_id`）に統一する。

- **後方互換性なし**: フロントエンド・バックエンド・データベースの同時デプロイが必要
- **データ損失なし**: `role` カラムは冗長情報のため、削除しても情報は失われない
- **RLSポリシー**: `group_members.role` を参照していないことを確認済み ✅

---

## 全影響箇所（網羅調査済み）

### バックエンド - group_service.py（10箇所）

| 行 | 関数 | 変更内容 |
|-----|------|---------|
| 120-127 | `create_group()` | `role: "owner"` を削除 |
| 171 | `get_group()` | SELECTから `role` を削除 |
| 183 | `get_group()` | メンバー構築から `role` を削除 |
| 238 | `get_user_groups()` | SELECTから `role` を削除 |
| 250 | `get_user_groups()` | メンバー構築から `role` を削除 |
| 526-532 | `join_group()` | `role: "member"` を削除 |
| 663 | `get_group_members()` | SELECTから `role` を削除 |
| 675 | `get_group_members()` | メンバー構築から `role` を削除 |

### バックエンド - schemas/group.py（1箇所）

| 行 | 変更内容 |
|-----|---------|
| 57 | `role: Literal["owner", "member"]` フィールドを削除 |

### フロントエンド（3箇所）

| ファイル | 行 | 変更内容 |
|---------|-----|---------|
| `types/group.ts` | 24 | `role` フィールドを削除 |
| `groups/[id]/page.tsx` | 381 | `member.role === "owner"` → `member.user_id === group.owner_id` |
| `groups/[id]/page.tsx` | 387 | `member.role !== "owner"` → `member.user_id !== group.owner_id` |

### データベース（1ファイル新規作成）

| ファイル | 内容 |
|---------|------|
| `00019_normalize_group_owner.sql` | role カラム・CHECK制約を削除 |

### ドキュメント（1ファイル）

| ファイル | 変更内容 |
|---------|---------|
| `SCHEMA.md` | role カラム説明を削除、オーナー管理方法を明記 |

### 無関係（対応不要を確認済み）

- `qa_session_service.py`: QAチャット用 role ('user'/'assistant')
- `qa/QASection.tsx`: QAチャット用 role
- `00016_qa_sessions.sql`: QAメッセージ用 role
- RLSポリシー: `group_members.role` の参照なし

---

## Step 1: マイグレーション作成

**ファイル**: `backend/supabase/migrations/00019_normalize_group_owner.sql`

```sql
-- Migration: 00019_normalize_group_owner
-- Description: Remove redundant role column from group_members table
-- The owner information is already stored in groups.owner_id

-- CHECK 制約を先に削除
ALTER TABLE public.group_members DROP CONSTRAINT IF EXISTS group_members_role_check;

-- role カラムを削除
ALTER TABLE public.group_members DROP COLUMN IF EXISTS role;

-- コメント更新
COMMENT ON TABLE public.group_members IS 'グループメンバーシップを管理するテーブル。オーナー情報は groups.owner_id で管理';
```

---

## Step 2: バックエンド - スキーマ修正

**ファイル**: `backend/app/schemas/group.py`

`GroupMemberInfo` から `role` フィールドを削除:

```python
class GroupMemberInfo(BaseModel):
    id: UUID = Field(..., description="Membership ID")
    user_id: UUID = Field(..., description="User ID")
    email: str = Field(..., description="User email")
    joined_at: datetime = Field(..., description="Join timestamp")
    # role フィールドを削除

    model_config = {"from_attributes": True}
```

---

## Step 3: バックエンド - サービス層修正

**ファイル**: `backend/app/services/group_service.py`

### 3.1 `create_group()` (行119-127)
`role: "owner"` を削除:
```python
client.table("group_members").insert({
    "group_id": group["id"],
    "user_id": owner_id,
}).execute()
```

### 3.2 `get_group()` (行168-185)
SELECTとメンバー構築から `role` を削除:
```python
.select("id, user_id, joined_at, users(email)")
```

### 3.3 `get_user_groups()` (行236-253)
同様に `role` を削除

### 3.4 `join_group()` (行526-532)
`role: "member"` を削除:
```python
client.table("group_members").insert({
    "group_id": group["id"],
    "user_id": user_id,
}).execute()
```

### 3.5 `get_group_members()` (行660-678)
同様に `role` を削除

---

## Step 4: フロントエンド - 型定義修正

**ファイル**: `frontend/src/types/group.ts`

```typescript
export interface GroupMember {
  id: string;
  user_id: string;
  email: string;
  joined_at: string;
  // role フィールドを削除
}
```

---

## Step 5: フロントエンド - UI修正

**ファイル**: `frontend/src/app/groups/[id]/page.tsx`

### 5.1 行381: オーナー表示
```tsx
// Before
{member.role === "owner" ? "オーナー" : "メンバー"}

// After
{member.user_id === group.owner_id ? "オーナー" : "メンバー"}
```

### 5.2 行387: 削除ボタン表示条件
```tsx
// Before
{isOwner && member.user_id !== user.id && member.role !== "owner" && (

// After
{isOwner && member.user_id !== user.id && member.user_id !== group.owner_id && (
```

---

## Step 6: SCHEMA.md更新

**ファイル**: `backend/supabase/SCHEMA.md`

`group_members` テーブルから `role` カラムの記述を削除し、オーナー情報の管理方法を明記。

---

## 検証手順

1. **グループ作成**: オーナーがメンバー一覧に表示されること
2. **メンバー追加**: 一覧に表示され、「メンバー」ラベルが付くこと
3. **オーナー表示**: `owner_id` と一致するメンバーに「オーナー」ラベルが付くこと
4. **メンバー削除**: オーナー以外のメンバーが削除できること
5. **グループ削除**: オーナーのみ実行可能であること

---

## リスクと対策

| リスク | 対策 |
|-------|------|
| デプロイのタイミングずれ | メンテナンス時間を設けて同時デプロイ |
| フロントエンドキャッシュ | Vercelキャッシュパージ、SW更新 |
