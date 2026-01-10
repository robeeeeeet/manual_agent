---
paths: {backend/app/services/**/*.py}
---

# Supabase Python クライアント注意事項

## 結合クエリでのフィルタリング

外部キー経由のフィルタリング（例: `.eq("user_appliances.user_id", user_id)`）は期待通り動作しないことがある。

代わりに、2段階クエリを使用:

```python
# Bad: 結合フィルタが機能しない
schedules = (
    client.table("maintenance_schedules")
    .select("*, user_appliances!inner(user_id)")
    .eq("user_appliances.user_id", user_id)
    .execute()
)

# Good: 2段階クエリ
# Step 1: ユーザーのappliance IDsを取得
appliances = (
    client.table("user_appliances")
    .select("id")
    .eq("user_id", user_id)
    .execute()
)
appliance_ids = [a["id"] for a in (appliances.data or [])]

# Step 2: in_() でフィルタ
if appliance_ids:
    schedules = (
        client.table("maintenance_schedules")
        .select("id", count="exact")
        .in_("user_appliance_id", appliance_ids)
        .execute()
    )
```

## 日付計算

月末境界を跨ぐ日付計算では `timedelta` を使用。`replace()` は月末で失敗する。

```python
from datetime import timedelta

# Bad: 月末で失敗（例: 1/30 + 7日 → day=37 でエラー）
seven_days_later = now.replace(day=now.day + 7)

# Good: timedelta を使用
seven_days_later = now + timedelta(days=7)
```

## カウントクエリ

件数のみ必要な場合は `count="exact"` を使用し、必要最小限のカラムを選択:

```python
response = (
    client.table("maintenance_logs")
    .select("id", count="exact")
    .eq("done_by_user_id", user_id)
    .execute()
)
count = response.count or 0
```
