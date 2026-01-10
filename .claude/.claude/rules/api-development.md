---
paths: {frontend/src/app/api/**/*.ts,backend/app/api/**/*.py,frontend/src/types/**/*.ts,backend/app/schemas/**/*.py}
---

# API開発時の注意事項

## バックエンドAPIルート追加後

新しいAPIエンドポイントを追加した後は、必ずバックエンドサーバーを再起動すること。`--reload`オプションで起動していても、新しいルートが反映されないことがある。

確認コマンド:
```bash
curl -s http://localhost:8000/openapi.json | jq '.paths | keys'
```

## フロントエンド・バックエンド間の型定義

APIレスポンスの型定義を作成する際は、必ずバックエンドのPydanticスキーマ（`backend/app/schemas/*.py`）を確認し、フィールド名を一致させること。

よくある不整合例:
- バックエンド: `done_at` / フロントエンド: `completed_at`
- バックエンド: `user_id` / フロントエンド: `userId`

## BFF層でのレスポンス変換

バックエンドAPIは構造化されたレスポンス（例: `{profile: {...}}`）を返すことが多い。
BFF層（Next.js API Routes）でフロントエンドが期待する形式に変換すること。

```typescript
// Bad: バックエンドのレスポンスをそのまま返す
return NextResponse.json(data, { status: 200 });

// Good: フロントエンドの期待する形式に変換
const profile = data.profile;
return NextResponse.json({
  notify_time: profile?.notify_time?.substring(0, 5) || "09:00",
  timezone: profile?.timezone || "Asia/Tokyo",
});
```

## GETメソッドの実装忘れ

設定取得APIなど、GETとPATCH両方が必要なエンドポイントでは、両方のメソッドを実装すること。
GETメソッドを忘れると `405 Method Not Allowed` エラーになる。

## E2Eテスト前のチェック

テスト実行前に両サーバーが起動していることを確認:
```bash
lsof -i :3000  # フロントエンド
lsof -i :8000  # バックエンド
```
