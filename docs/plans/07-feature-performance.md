# パフォーマンス改善

## ブランチ名
`feature/performance`

## 背景
メンテナンス一覧と家電一覧の読み込みが遅い。
原因: N+1問題、多段構成のレイテンシ

## タスク

### 1. N+1問題の解消（バックエンド）

#### 対象: `backend/app/services/appliance_service.py`
```python
# 現在: N+1（家電が10台あれば11回のクエリ）
for row in result.data:
    maintenance_result = client.table("maintenance_schedules").eq("user_appliance_id", row["id"])...

# 改善: 1回のクエリで全取得
appliance_ids = [row["id"] for row in result.data]
all_maintenance = client.table("maintenance_schedules").in_("user_appliance_id", appliance_ids)...
# その後、appliance_id でグループ化
```

#### 対象箇所
- `get_user_appliances()`
- その他、ループ内でDBクエリを発行している箇所

### 2. SWR導入（フロントエンド）

#### インストール
```bash
cd frontend && npm install swr
```

#### 実装
```typescript
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// 家電一覧ページ
const { data, error, isLoading } = useSWR('/api/appliances', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 60000, // 1分間は重複リクエストを防ぐ
});

// メンテナンス一覧ページ
const { data: maintenanceData } = useSWR('/api/maintenance', fetcher, {
  revalidateOnFocus: false,
});
```

#### 対象ページ
- `/appliances` (家電一覧)
- `/maintenance` (メンテナンス一覧)
- `/` (トップページ)

### 3. 測定
- 改善前後でAPIレスポンス時間を計測
- Chrome DevToolsのNetworkタブで確認

## 関連ファイル
- `backend/app/services/appliance_service.py`
- `backend/app/api/routes/appliances.py`
- `frontend/src/app/appliances/page.tsx`
- `frontend/src/app/maintenance/page.tsx`
- `frontend/src/app/page.tsx`

## 確認事項
- 初回読み込みが速くなったか
- 2回目以降（キャッシュ利用）は即座に表示されるか
- データ更新後にキャッシュが正しく無効化されるか
