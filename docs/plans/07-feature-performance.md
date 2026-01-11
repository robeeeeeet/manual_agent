# パフォーマンス改善 実装計画

## ブランチ名
`feature/performance`

## 概要
メンテナンス一覧と家電一覧の読み込みが遅い問題を解決する。

**原因**: N+1問題（バックエンド）、キャッシュ未活用（フロントエンド）

## タスク一覧

### 1. バックエンド N+1問題の解消

#### 1.1 appliance_service.py の修正（優先度: 高）

**ファイル**: `backend/app/services/appliance_service.py`
**関数**: `get_user_appliances()` (行 267-392)

**現状の問題** (行 335-354):
```python
for row in all_appliances_data:  # N回ループ
    maintenance_result = (
        client.table("maintenance_schedules")
        .eq("user_appliance_id", row["id"])  # ← 個別クエリ
        .execute()
    )
```

**修正方針**:
1. ループ前に全家電IDを収集
2. `in_()` で一括クエリ
3. `appliance_id -> maintenance` のマップを構築
4. ループ内ではマップから取得

**期待効果**: 10家電で 13クエリ → 4クエリ（70%削減）

---

#### 1.2 maintenance_notification_service.py の修正（優先度: 中）

**ファイル**: `backend/app/services/maintenance_notification_service.py`

##### 箇所1: `_get_users_with_upcoming_maintenance()` (行 86-140)
- ループ内で `push_subscriptions` を個別クエリ（行 125-132）
- 修正: `in_()` で一括取得

##### 箇所2: `_get_users_for_scheduled_notification()` (行 412-514)
- ループ内で `push_subscriptions` と `users` を個別クエリ（行 458-477）
- 修正: 両テーブルとも `in_()` で一括取得

**期待効果**: 50ユーザーで 最大100クエリ → 3クエリ（97%削減）

---

### 2. フロントエンド SWR導入（優先度: 高）

#### 2.1 SWRインストール
```bash
cd frontend && npm install swr
```

#### 2.2 カスタムフック作成

**新規ファイル**: `frontend/src/hooks/useAppliances.ts`
```typescript
import useSWR from 'swr';

export function useAppliances() {
  const { data, error, isLoading, mutate } = useSWR('/api/appliances', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
  return { appliances: data || [], isLoading, error, refetch: mutate };
}
```

**新規ファイル**: `frontend/src/hooks/useMaintenance.ts`
```typescript
export function useMaintenance(status?: string) {
  const url = status ? `/api/maintenance?status=${status}` : '/api/maintenance';
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {...});
  return { items: data?.items || [], counts: data?.counts, isLoading, error, refetch: mutate };
}
```

#### 2.3 対象ページへの導入

| ページ | ファイル | 変更内容 |
|--------|----------|----------|
| 家電一覧 | `frontend/src/app/appliances/page.tsx` | useAppliances() に置換 |
| メンテナンス一覧 | `frontend/src/app/maintenance/page.tsx` | useMaintenance() に置換 |
| トップページ | `frontend/src/app/page.tsx` | 両フックを使用 |

---

## 修正対象ファイル

| ファイル | 変更タイプ |
|----------|-----------|
| `backend/app/services/appliance_service.py` | 修正 |
| `backend/app/services/maintenance_notification_service.py` | 修正 |
| `frontend/src/hooks/useAppliances.ts` | 新規 |
| `frontend/src/hooks/useMaintenance.ts` | 新規 |
| `frontend/src/app/appliances/page.tsx` | 修正 |
| `frontend/src/app/maintenance/page.tsx` | 修正 |
| `frontend/src/app/page.tsx` | 修正 |

---

## 実装順序

1. `appliance_service.py` N+1修正
2. SWRインストール + カスタムフック作成
3. 3ページへのSWR導入
4. `maintenance_notification_service.py` N+1修正（2箇所）

---

## 検証方法

### バックエンド
1. ローカルで `uv run uvicorn app.main:app --reload` 起動
2. `/api/v1/appliances` を呼び出し、レスポンス時間を計測
3. Cloud Run ログでクエリ時間を確認

### フロントエンド
1. Chrome DevTools Network タブでリクエスト数を確認
2. ページ遷移時の重複リクエストがないことを確認
3. 60秒以内の再アクセスでキャッシュが使用されることを確認

### E2E
1. Playwright MCPでブラウザ操作し、体感速度を確認
2. 改善前後のレスポンス時間を比較

---

## 注意点

- `in_()` の引数が空配列の場合はクエリをスキップする
- 既存APIレスポンスの型は変更しない（フロントエンドへの影響を最小化）
- SWR導入後、完了アクション後は `mutate()` でキャッシュを無効化する
