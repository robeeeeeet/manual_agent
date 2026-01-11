# 09: グループオーナー情報の正規化

## 概要

`groups.owner_id` と `group_members.role` の重複を解消し、オーナー情報を単一の情報源（`groups.owner_id`）に統一する。

## 現状の問題

### データ重複

```
groups テーブル:
  id: abc-123
  owner_id: user-001  ← オーナー情報①

group_members テーブル:
  group_id: abc-123
  user_id: user-001
  role: 'owner'       ← オーナー情報②（重複）
```

### リスク

- データ不整合の可能性（`groups.owner_id` と `group_members.role='owner'` が異なるユーザーを指す場合）
- 更新時に2箇所を同期する必要がある
- ストレージの無駄（`role` カラムは実質的に不要）

## 設計方針

**オプションB採用**: `group_members.role` カラムを削除し、オーナー判定は `groups.owner_id` のみで行う

### 理由

1. **既存実装との親和性**: バックエンドの `_is_owner()` は既に `groups.owner_id` のみを使用
2. **シンプルさ**: オーナー情報の単一ソース化
3. **パフォーマンス**: オーナー判定にJOIN不要（`groups` テーブルのみ参照）

### 変更後のデータモデル

```
groups テーブル:
  id: abc-123
  owner_id: user-001  ← オーナー情報（単一ソース）

group_members テーブル:
  group_id: abc-123
  user_id: user-001   ← オーナーもメンバーとして登録（一覧表示用）
  joined_at: ...
  （role カラムは削除）
```

## 影響範囲

### バックエンド

| ファイル | 変更内容 |
|---------|---------|
| `backend/app/services/group_service.py` | `create_group()`: `role` 設定を削除 |
| `backend/app/schemas/group.py` | `GroupMember.role` フィールドを削除 |
| `backend/app/api/routes/groups.py` | レスポンス形式の調整（必要に応じて） |

### フロントエンド

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/types/group.ts` | `GroupMember.role` を削除 |
| `frontend/src/app/groups/[id]/page.tsx` | `member.role === "owner"` → `member.user_id === group.owner_id` |

### データベース

| 対象 | 変更内容 |
|-----|---------|
| `group_members` テーブル | `role` カラムを削除 |
| RLSポリシー | `role` 参照がないことを確認（現状なし） |
| CHECK制約 | `role IN ('owner', 'member')` を削除 |

## 実装手順

### Step 1: マイグレーション作成

ファイル: `backend/supabase/migrations/00019_normalize_group_owner.sql`

```sql
-- ============================================================
-- Migration: group_members テーブルから role カラムを削除
-- ============================================================
-- 目的:
--   groups.owner_id と group_members.role の重複を解消
--   オーナー判定は groups.owner_id のみで行う
--
-- 変更内容:
--   1. role カラムのCHECK制約を削除
--   2. role カラムを削除
-- ============================================================

BEGIN;

-- Step 1: CHECK制約を削除
ALTER TABLE group_members
  DROP CONSTRAINT IF EXISTS group_members_role_check;

-- Step 2: role カラムを削除
ALTER TABLE group_members
  DROP COLUMN role;

-- Step 3: コメント更新
COMMENT ON TABLE public.group_members IS 'グループメンバーシップを管理するテーブル（オーナー判定は groups.owner_id で行う）';

COMMIT;
```

### Step 2: バックエンド修正

#### 2.1 スキーマ修正 (`backend/app/schemas/group.py`)

```python
# Before
class GroupMember(BaseModel):
    id: UUID
    group_id: UUID
    user_id: UUID
    role: Literal["owner", "member"] = Field(..., description="Role in the group")
    joined_at: datetime

# After
class GroupMember(BaseModel):
    id: UUID
    group_id: UUID
    user_id: UUID
    joined_at: datetime
```

#### 2.2 サービス修正 (`backend/app/services/group_service.py`)

```python
# create_group() 内の group_members INSERT を修正

# Before
await client.table("group_members").insert({
    "group_id": group_id,
    "user_id": owner_id,
    "role": "owner",
}).execute()

# After
await client.table("group_members").insert({
    "group_id": group_id,
    "user_id": owner_id,
}).execute()
```

### Step 3: フロントエンド修正

#### 3.1 型定義修正 (`frontend/src/types/group.ts`)

```typescript
// Before
export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  email?: string;
}

// After
export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  email?: string;
}
```

#### 3.2 UI修正 (`frontend/src/app/groups/[id]/page.tsx`)

```tsx
// Before
{member.role === "owner" ? "オーナー" : "メンバー"}

// After
{member.user_id === group.owner_id ? "オーナー" : "メンバー"}

// Before
{isOwner && member.role !== "owner" && (
  <button onClick={() => handleRemoveMember(member.user_id)}>削除</button>
)}

// After
{isOwner && member.user_id !== group.owner_id && (
  <button onClick={() => handleRemoveMember(member.user_id)}>削除</button>
)}
```

### Step 4: SCHEMA.md 更新

`group_members` テーブルの説明から `role` カラムを削除し、オーナー判定方法を明記。

### Step 5: テスト

1. グループ作成 → オーナーがメンバー一覧に表示されること
2. メンバー追加 → 一覧に表示され、「メンバー」ラベルが付くこと
3. オーナー表示 → `owner_id` と一致するメンバーに「オーナー」ラベルが付くこと
4. メンバー削除 → オーナー以外のメンバーが削除できること
5. グループ削除 → オーナーのみ実行可能であること

## リスク・注意点

### 移行時の注意

- 既存データの `role` カラムは単純に削除するだけでOK（データ移行不要）
- オーナー情報は `groups.owner_id` に既に存在するため

### 後方互換性

- APIレスポンスから `role` フィールドが消えるため、フロントエンドの更新が必須
- 同時デプロイが望ましい（バックエンド → フロントエンドの順序は不可）

## 作業チェックリスト

- [ ] マイグレーション作成・適用
- [ ] `backend/app/schemas/group.py` 修正
- [ ] `backend/app/services/group_service.py` 修正
- [ ] `frontend/src/types/group.ts` 修正
- [ ] `frontend/src/app/groups/[id]/page.tsx` 修正
- [ ] `backend/supabase/SCHEMA.md` 更新
- [ ] ローカルテスト実施
- [ ] 本番デプロイ（バックエンド・フロントエンド同時）

## 見積もり

- 実装: 30分
- テスト: 15分
- ドキュメント更新: 10分
- **合計: 約1時間**
