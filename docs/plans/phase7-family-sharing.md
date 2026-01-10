# Phase 7: 家族グループ共有機能 - 実装計画書

## 現在のステータス

**基盤実装**: ✅ 完了（グループ作成・参加・家電登録）
**追加要件**: 🚧 ワンタップ共有機能

---

## 🚀 今回の実装タスク（優先順）

| # | タスク | ファイル |
|---|--------|---------|
| 1 | マイグレーション実行（00010-00012） | Supabase |
| 2 | 1グループ制約マイグレーション作成・適用（00013） | `backend/supabase/migrations/` |
| 3 | share/unshare API実装 | `backend/app/services/appliance_service.py` |
| 4 | APIルート追加 | `backend/app/api/routes/appliances.py` |
| 5 | BFF API Routes | `frontend/src/app/api/appliances/[id]/share/` |
| 6 | ShareButtonコンポーネント | `frontend/src/components/appliance/` |
| 7 | 家電一覧・詳細ページに統合 | `frontend/src/app/appliances/` |
| 8 | グループ参加時の切替え処理 | `frontend/src/app/groups/` |
| 9 | E2Eテスト | Playwright MCP |

---

## 要件サマリー

| 項目 | 決定事項 |
|------|---------|
| **共有モデル** | グループ所有（グループとして家電を登録、全メンバーが編集・削除可能） |
| **スケジュール** | 共有スケジュール（誰かが完了すると全員に反映） |
| **招待フロー** | 招待コード方式（6文字英数字） |
| **通知設定** | 個人設定を維持（各メンバーの`notify_time`を尊重） |
| **グループ数制限** | **1ユーザー1グループのみ**（追加要件） |
| **共有操作** | **ワンタップ共有**（グループ選択不要） |
| **共有解除** | **個人所有に戻せる** |

---

## 追加実装: ワンタップ共有機能

### 概要

既存の個人所有家電を、ワンタップでグループ共有に変更できる機能。
ユーザーは1グループのみに所属可能なため、共有先の選択は不要。

### 必要な変更

#### 1. データベース変更（マイグレーション 00013）

```sql
-- 1ユーザー1グループ制約を追加
ALTER TABLE group_members
ADD CONSTRAINT uq_group_members_user UNIQUE (user_id);
```

**影響**: 既に複数グループに参加しているユーザーがいる場合、マイグレーション前にデータクリーンアップが必要。

#### 2. バックエンドAPI追加

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/v1/appliances/{id}/share` | POST | 家電をグループに共有 |
| `/api/v1/appliances/{id}/unshare` | POST | 共有解除（個人所有に戻す） |

**appliance_service.py に追加する関数**:
- `share_appliance(user_id, appliance_id)` - 個人→グループ移管
- `unshare_appliance(user_id, appliance_id)` - グループ→個人移管

**ロジック**:
```python
async def share_appliance(user_id: UUID, appliance_id: UUID):
    # 1. ユーザーの所属グループを取得
    group = get_user_group(user_id)  # 1グループのみなので単数
    if not group:
        raise NoGroupMembershipError("グループに参加していません")

    # 2. 家電の所有権を確認（個人所有のみ共有可能）
    appliance = get_appliance(appliance_id)
    if appliance.user_id != user_id:
        raise NotOwnerError("この家電の所有者ではありません")
    if appliance.group_id is not None:
        raise AlreadySharedError("既に共有されています")

    # 3. 所有権をグループに移管
    update_appliance(appliance_id, user_id=None, group_id=group.id)
```

#### 3. フロントエンドUI

**配置場所**:
- 家電一覧ページ: 各カードの右側アクション領域
- 家電詳細ページ: 削除ボタンの隣

**表示ロジック**:
```tsx
// 個人所有 + グループ参加済み → 「共有」ボタン表示
// グループ所有 → 「共有解除」ボタン表示
// グループ未参加 → ボタン非表示（グループ参加を促す）
```

**UIパターン**:
```
┌─────────────────────────────────────────┐
│ [個人所有の場合]                         │
│  共有ボタン: 青色アウトライン + 共有アイコン │
│  クリック → 即座に共有実行（確認なし）      │
├─────────────────────────────────────────┤
│ [グループ所有の場合]                     │
│  共有解除ボタン: グレーアウトライン        │
│  クリック → 確認モーダル → 解除実行        │
└─────────────────────────────────────────┘
```

**UX理由**:
- 共有は「追加」操作なので気軽に実行可能
- 共有解除は「削除」に近い操作なので確認が必要

### 実装ファイル

| ファイル | 変更内容 |
|---------|---------|
| `backend/supabase/migrations/00013_single_group_constraint.sql` | 1グループ制約追加 |
| `backend/app/services/appliance_service.py` | `share_appliance`, `unshare_appliance` 追加 |
| `backend/app/api/routes/appliances.py` | 共有/解除エンドポイント追加 |
| `frontend/src/app/api/appliances/[id]/share/route.ts` | BFF API |
| `frontend/src/app/api/appliances/[id]/unshare/route.ts` | BFF API |
| `frontend/src/app/appliances/page.tsx` | 共有ボタン追加 |
| `frontend/src/app/appliances/[id]/page.tsx` | 共有ボタン追加 |
| `frontend/src/components/appliance/ShareButton.tsx` | 共有ボタンコンポーネント（新規） |

### 実装順序

1. **マイグレーション作成・適用** - 1グループ制約
2. **バックエンドAPI** - share/unshare エンドポイント
3. **BFF API Routes** - フロントエンド用
4. **ShareButton コンポーネント** - 再利用可能なボタン
5. **家電一覧ページ** - 共有ボタン統合
6. **家電詳細ページ** - 共有ボタン統合
7. **E2Eテスト** - Playwright MCPで検証

### 検証方法

1. グループ未参加ユーザー → 共有ボタン非表示
2. グループ参加済み + 個人所有家電 → 「共有」ボタン表示
3. 共有ボタンクリック → **即座に共有成功**（確認なし）
4. グループ所有家電 → 「共有解除」ボタン表示
5. 共有解除クリック → **確認モーダル表示** → 確認後に解除
6. 他のグループメンバー → 共有家電が見える/見えなくなる

---

## グループ切替え時の挙動

**要件**: 既にグループ参加中のユーザーが別グループに参加する場合

1. **警告モーダル表示**:
   - 「現在のグループから離脱します」
   - 「共有中の家電は個人所有に戻ります」

2. **確認後の処理**:
   - 現在のグループから離脱
   - 共有家電を個人所有に移管（`group_id=NULL, user_id=本人`）
   - 新しいグループに参加

3. **フロントエンド実装**:
   - `/groups` ページの `GroupJoinForm` にチェック追加
   - 参加前に現在の所属グループを確認
   - 所属中なら確認モーダル表示

---

## 1. データベース変更

### 1.1 新規テーブル

#### `groups` テーブル
```sql
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_groups_invite_code ON groups(invite_code);
CREATE INDEX idx_groups_owner_id ON groups(owner_id);
```

#### `group_members` テーブル
```sql
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_group_members_group_user UNIQUE (group_id, user_id)
);
```

### 1.2 既存テーブルの変更

#### `user_appliances` への `group_id` 追加
```sql
-- グループ所有の場合に設定
ALTER TABLE user_appliances
    ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

-- 個人所有（user_id設定）かグループ所有（group_id設定）のどちらか
ALTER TABLE user_appliances
    ADD CONSTRAINT chk_user_appliances_owner
    CHECK (
        (user_id IS NOT NULL AND group_id IS NULL) OR
        (user_id IS NULL AND group_id IS NOT NULL)
    );

-- user_id を NULL 許可（グループ所有の場合）
ALTER TABLE user_appliances ALTER COLUMN user_id DROP NOT NULL;

-- 名前ユニーク制約の再定義
CREATE UNIQUE INDEX uq_user_appliances_user_name
    ON user_appliances(user_id, name) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_user_appliances_group_name
    ON user_appliances(group_id, name) WHERE group_id IS NOT NULL;
```

### 1.3 RLSポリシー更新

#### `groups`
- SELECT: グループメンバーのみ閲覧可能
- INSERT: 認証済みユーザーが作成可能
- UPDATE/DELETE: オーナーのみ

#### `group_members`
- SELECT: 同グループメンバーのみ閲覧可能
- INSERT: 自分自身を追加可能（招待コード経由）
- DELETE: 本人またはオーナーのみ

#### `user_appliances`（更新）
```sql
-- 個人所有 OR グループメンバーとして閲覧・編集可能
(user_id = auth.uid()) OR
EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = user_appliances.group_id
    AND group_members.user_id = auth.uid()
)
```

#### `maintenance_schedules`, `maintenance_logs`
- グループ家電への参照を含めるよう更新

### 1.4 マイグレーション順序

1. **00010_create_groups_tables.sql** - groups, group_members テーブル作成
2. **00011_user_appliances_group_support.sql** - user_appliances 拡張
3. **00012_update_rls_for_groups.sql** - RLSポリシー更新

---

## 2. バックエンド実装

### 2.1 新規ファイル

| ファイル | 内容 |
|---------|------|
| `backend/app/services/group_service.py` | グループCRUD、招待コード生成・検証、メンバー管理 |
| `backend/app/api/routes/groups.py` | グループAPI エンドポイント |
| `backend/app/schemas/group.py` | Pydantic スキーマ |

### 2.2 API エンドポイント

```
POST   /api/v1/groups                     # グループ作成
GET    /api/v1/groups                     # 所属グループ一覧
GET    /api/v1/groups/{id}                # グループ詳細
PATCH  /api/v1/groups/{id}                # グループ更新
DELETE /api/v1/groups/{id}                # グループ削除

POST   /api/v1/groups/{id}/regenerate-code  # 招待コード再生成
POST   /api/v1/groups/join                  # 招待コードで参加
POST   /api/v1/groups/{id}/leave            # グループ離脱

GET    /api/v1/groups/{id}/members          # メンバー一覧
DELETE /api/v1/groups/{id}/members/{uid}    # メンバー削除
```

### 2.3 既存サービスの変更

#### `appliance_service.py`
- `register_user_appliance()`: `group_id` パラメータ追加
- `get_user_appliances()`: 個人所有 + グループ家電を取得
- `get_user_appliance()`: グループメンバーシップ確認
- `update_user_appliance()`, `delete_user_appliance()`: グループ権限確認

#### `maintenance_notification_service.py`
- グループ家電の通知を全メンバーへ配信
- 各メンバーの `notify_time` を考慮

---

## 3. フロントエンド実装

### 3.1 新規ページ

| パス | 内容 |
|-----|------|
| `/groups` | グループ一覧、作成ボタン、参加フォーム |
| `/groups/[id]` | グループ詳細、メンバー一覧、招待コード表示 |

### 3.2 新規コンポーネント

```
frontend/src/components/group/
├── GroupCard.tsx           # グループカード
├── GroupCreateModal.tsx    # グループ作成モーダル
├── GroupInviteCode.tsx     # 招待コード表示・コピー
├── GroupMemberList.tsx     # メンバー一覧
├── GroupJoinForm.tsx       # 招待コード入力フォーム
└── GroupSelector.tsx       # 家電登録時のグループ選択
```

### 3.3 既存ページの変更

| ページ | 変更内容 |
|-------|---------|
| `/register` | グループ選択ドロップダウン追加 |
| `/appliances` | グループ家電バッジ表示、フィルター追加 |
| `/appliances/[id]` | グループ情報表示、実施者表示強化 |
| `/mypage` | グループ管理へのリンク追加 |

### 3.4 BFF API Routes

```
frontend/src/app/api/groups/
├── route.ts                      # GET, POST
├── [id]/route.ts                 # GET, PATCH, DELETE
├── [id]/regenerate-code/route.ts # POST
├── [id]/members/route.ts         # GET
├── [id]/members/[userId]/route.ts # DELETE
├── join/route.ts                 # POST
└── [id]/leave/route.ts           # POST
```

### 3.5 型定義

```typescript
// frontend/src/types/group.ts
interface Group {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
}

interface GroupMember {
  id: string;
  user_id: string;
  email: string;
  role: "owner" | "member";
  joined_at: string;
}

interface GroupWithMembers extends Group {
  members: GroupMember[];
}
```

---

## 4. 実装順序

### Step 1: データベース基盤
- [ ] マイグレーション 00010: groups, group_members テーブル作成
- [ ] マイグレーション 00011: user_appliances に group_id 追加
- [ ] マイグレーション 00012: RLSポリシー更新
- [ ] SCHEMA.md 更新

### Step 2: バックエンド グループAPI
- [ ] `group_service.py` 作成（CRUD、招待コード）
- [ ] `schemas/group.py` 作成
- [ ] `routes/groups.py` 作成
- [ ] main.py にルーター追加

### Step 3: バックエンド 家電API拡張
- [ ] `appliance_service.py` のグループ対応
- [ ] `schemas/appliance.py` に group_id 追加
- [ ] 家電APIのグループ対応

### Step 4: バックエンド 通知拡張
- [ ] `maintenance_notification_service.py` のグループ対応

### Step 5: フロントエンド グループ管理
- [ ] 型定義 `types/group.ts`
- [ ] BFF API Routes
- [ ] グループ一覧ページ `/groups`
- [ ] グループ詳細ページ `/groups/[id]`
- [ ] グループコンポーネント群

### Step 6: フロントエンド 家電連携
- [ ] 家電登録ページのグループ選択
- [ ] 家電一覧のグループ家電表示
- [ ] 家電詳細のグループ情報表示

### Step 7: 統合テスト
- [ ] グループ作成〜参加フロー
- [ ] グループ家電登録〜メンテナンス完了
- [ ] 通知配信（各メンバーへ）
- [ ] RLSポリシー検証

---

## 5. 検証方法

### 5.1 手動テスト（Playwright MCP）
1. グループ作成 → 招待コード表示
2. 別ユーザーで招待コード入力 → グループ参加
3. グループ家電登録 → 両メンバーで表示確認
4. メンテナンス完了 → 両メンバーに反映確認
5. 実施者表示の確認

### 5.2 バックエンドテスト
- `pytest tests/test_group_service.py`
- グループCRUD
- 招待コード検証
- メンバー権限チェック
- RLSポリシー検証

---

## 6. 影響を受ける重要ファイル

| ファイル | 変更内容 |
|---------|---------|
| `backend/supabase/SCHEMA.md` | 新テーブル、RLS変更の追記 |
| `backend/app/services/appliance_service.py` | グループ家電対応 |
| `backend/app/services/maintenance_notification_service.py` | グループ通知対応 |
| `backend/app/schemas/appliance.py` | group_id 追加 |
| `frontend/src/types/appliance.ts` | group_id, group_name 追加 |
| `frontend/src/app/register/page.tsx` | グループ選択UI |
| `frontend/src/app/appliances/page.tsx` | グループ家電表示 |

---

## 7. グループ削除時の挙動

**決定事項**: グループ家電をオーナーの個人所有に移管

```sql
-- グループ削除前のトリガー（またはサービス側で処理）
UPDATE user_appliances
SET user_id = (SELECT owner_id FROM groups WHERE id = OLD.id),
    group_id = NULL
WHERE group_id = OLD.id;
```

- メンテナンススケジュール、完了記録はそのまま維持
- 移管後はオーナーのみが家電を管理

---

## 8. リスクと対策

| リスク | 対策 |
|-------|------|
| RLSサブクエリのパフォーマンス | group_members にインデックス追加、クエリ最適化 |
| 招待コードの推測 | 6-8文字英数字で十分なエントロピー確保 |
| 既存データへの影響 | user_id が設定済み（個人所有）のため影響なし |
