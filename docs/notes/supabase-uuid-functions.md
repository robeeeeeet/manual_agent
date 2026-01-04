# Supabase UUID生成関数の技術メモ

マイグレーション作成時のUUID生成関数選択に関する参考資料。

## 背景

2026-01-03 のマイグレーション（`00004_shared_appliances_refactor.sql`）実行時に以下のエラーが発生：

```
ERROR: function uuid_generate_v4() does not exist (SQLSTATE 42883)
```

## UUID生成関数の比較

### uuid_generate_v4()

**特徴:**
- `uuid-ossp` 拡張が必要
- PostgreSQL の標準的なUUID生成関数
- 拡張のインストールが必要

```sql
-- 拡張を有効化（必要）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 使用例
CREATE TABLE example (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);
```

**問題点:**
- Supabaseでは `uuid-ossp` 拡張が自動的に有効になっていない場合がある
- マイグレーションの順序によっては拡張が存在しない状態で実行される可能性

### gen_random_uuid()（推奨）

**特徴:**
- PostgreSQL 13+ で標準搭載
- 追加の拡張不要
- Supabaseでデフォルト利用可能

```sql
-- 拡張不要、そのまま使用可能
CREATE TABLE example (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
```

**利点:**
- 依存関係なし
- Supabaseの全環境で確実に動作
- パフォーマンスも同等

## 推奨事項

### 新規マイグレーションでは `gen_random_uuid()` を使用

```sql
-- Good: 推奨
CREATE TABLE my_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ...
);

-- Avoid: 拡張依存
CREATE TABLE my_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ...
);
```

### 既存のマイグレーションとの互換性

初期スキーマ（`00001_initial_schema.sql`）で `uuid-ossp` 拡張を有効化している場合でも、後続のマイグレーションでは `gen_random_uuid()` の使用を推奨。理由：

1. **マイグレーション順序の問題回避**: 拡張の有効化より前に実行される可能性
2. **環境間の一貫性**: ローカル/ステージング/本番で同じ動作を保証
3. **将来の移植性**: PostgreSQL標準機能のみに依存

## 参考リンク

- [PostgreSQL: UUID Generation](https://www.postgresql.org/docs/current/functions-uuid.html)
- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions)
