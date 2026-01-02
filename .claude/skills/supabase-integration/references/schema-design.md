# スキーマ設計

## 完全スキーマ

```sql
-- ===========================================
-- ユーザー管理
-- ===========================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  notify_time TIME DEFAULT '09:00',
  timezone TEXT DEFAULT 'Asia/Tokyo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 更新日時自動更新
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 家電管理
-- ===========================================

CREATE TABLE appliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  maker TEXT NOT NULL,
  model_number TEXT NOT NULL,
  category TEXT NOT NULL,
  manual_source_url TEXT,         -- 出典URL（必須で保存）
  stored_pdf_path TEXT,           -- Storage内パス
  image_url TEXT,                 -- 製品画像URL
  notes TEXT,                     -- メモ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appliances_user_id ON appliances(user_id);
CREATE INDEX idx_appliances_category ON appliances(category);

-- ===========================================
-- メンテナンススケジュール
-- ===========================================

CREATE TABLE maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appliance_id UUID NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  description TEXT,
  interval_type TEXT NOT NULL CHECK (interval_type IN ('days', 'months', 'manual')),
  interval_value INT,             -- days: 日数, months: 月数, manual: NULL
  last_done_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  source_page TEXT,               -- マニュアル内の参照ページ
  importance TEXT DEFAULT 'medium' CHECK (importance IN ('high', 'medium', 'low')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedules_appliance_id ON maintenance_schedules(appliance_id);
CREATE INDEX idx_schedules_next_due_at ON maintenance_schedules(next_due_at);

-- ===========================================
-- メンテナンス実施記録
-- ===========================================

CREATE TABLE maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES maintenance_schedules(id) ON DELETE CASCADE,
  done_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_by_user_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logs_schedule_id ON maintenance_logs(schedule_id);

-- ===========================================
-- Push通知設定
-- ===========================================

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,           -- 公開鍵
  auth TEXT NOT NULL,             -- 認証シークレット
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_user_id ON push_subscriptions(user_id);

-- ===========================================
-- ドキュメント（RAG用）
-- ===========================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appliance_id UUID REFERENCES appliances(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB DEFAULT '{}',
  page_number INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_appliance_id ON documents(appliance_id);
CREATE INDEX idx_documents_embedding ON documents
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## 関数・トリガー

```sql
-- 更新日時自動更新関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 次回実施日計算関数
CREATE OR REPLACE FUNCTION calculate_next_due_at(
  p_interval_type TEXT,
  p_interval_value INT,
  p_last_done_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  IF p_interval_type = 'days' THEN
    RETURN p_last_done_at + (p_interval_value || ' days')::INTERVAL;
  ELSIF p_interval_type = 'months' THEN
    RETURN p_last_done_at + (p_interval_value || ' months')::INTERVAL;
  ELSE
    RETURN NULL;  -- manual
  END IF;
END;
$$ LANGUAGE plpgsql;

-- メンテナンス完了時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_schedule_on_log()
RETURNS TRIGGER AS $$
DECLARE
  v_schedule maintenance_schedules%ROWTYPE;
BEGIN
  SELECT * INTO v_schedule FROM maintenance_schedules WHERE id = NEW.schedule_id;

  UPDATE maintenance_schedules
  SET
    last_done_at = NEW.done_at,
    next_due_at = calculate_next_due_at(
      v_schedule.interval_type,
      v_schedule.interval_value,
      NEW.done_at
    )
  WHERE id = NEW.schedule_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_schedule
  AFTER INSERT ON maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION update_schedule_on_log();
```

## カテゴリ一覧

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name_ja TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

INSERT INTO categories (id, name_ja, name_en, sort_order) VALUES
  ('aircon', 'エアコン・空調', 'Air Conditioning', 1),
  ('laundry', '洗濯・乾燥', 'Laundry', 2),
  ('kitchen', 'キッチン', 'Kitchen', 3),
  ('water_heater', '給湯・暖房', 'Water Heater', 4),
  ('cleaning', '掃除', 'Cleaning', 5),
  ('housing', '住宅設備', 'Housing Equipment', 6),
  ('other', 'その他', 'Other', 99);
```
