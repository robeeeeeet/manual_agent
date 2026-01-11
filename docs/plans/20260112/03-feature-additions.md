# 03: 機能追加（アーカイブ・登録者表示）

**ブランチ名**: `feat/archive-and-owner-display`

## 対象タスク

1. メンテナンス項目のアーカイブ機能
2. 家電一覧に登録者表示

---

## タスク1: メンテナンスアーカイブ機能

### DB変更

```sql
-- マイグレーション: 00019_add_maintenance_archive.sql
ALTER TABLE maintenance_schedules
ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_maintenance_schedules_is_archived
ON maintenance_schedules(is_archived);
```

### バックエンドAPI

| メソッド | パス | 説明 |
|---------|------|------|
| PATCH | `/api/v1/maintenance/{id}/archive` | アーカイブする |
| PATCH | `/api/v1/maintenance/{id}/unarchive` | アーカイブ解除 |
| GET | `/api/v1/maintenance?include_archived=true` | アーカイブ含む取得 |

**変更ファイル**:
- `backend/app/api/routes/maintenance.py`
- `backend/app/services/maintenance_service.py`（新規 or 既存拡張）

### BFF層

**変更ファイル**:
- `frontend/src/app/api/appliances/[id]/maintenance/[scheduleId]/archive/route.ts`
- `frontend/src/app/api/appliances/[id]/maintenance/[scheduleId]/unarchive/route.ts`

### フロントエンドUI

**変更ファイル**:
- `frontend/src/app/appliances/[id]/page.tsx`
  - 「アーカイブされた項目」折りたたみセクション追加
  - アーカイブ/復元ボタン
- `frontend/src/components/maintenance/MaintenanceListItem.tsx`
  - アーカイブボタン追加

---

## タスク2: 家電一覧に登録者表示

### バックエンドAPI変更

`GET /api/v1/appliances` のレスポンスに `owner_display_name` を追加

**変更ファイル**:
- `backend/app/services/appliance_service.py` - JOINで`users.display_name`を取得
- `backend/app/schemas/appliance.py` - レスポンススキーマに追加

### フロントエンドUI

**変更ファイル**:
- `frontend/src/app/appliances/page.tsx` - カードに「登録者: ○○さん」を表示
- `frontend/src/types/appliance.ts` - 型定義に追加

---

## 完了条件

### アーカイブ機能
- [ ] DBマイグレーション適用済み
- [ ] アーカイブ/解除APIが動作する
- [ ] 家電詳細ページでアーカイブ操作ができる
- [ ] アーカイブ済み項目が折りたたみセクションに表示される
- [ ] メンテナンス一覧からアーカイブ済みが除外される

### 登録者表示
- [ ] 家電一覧に登録者名が表示される
- [ ] グループ共有家電でも正しく表示される
