/**
 * ユーザープロファイル情報
 */
export interface UserProfile {
  id: string;
  email: string;
  notify_time: string; // "HH:MM" 形式
  timezone: string; // IANA timezone (例: "Asia/Tokyo")
  created_at: string; // ISO 8601
}

/**
 * ユーザー設定情報
 */
export interface UserSettings {
  notify_time: string; // "HH:MM" 形式
  timezone: string; // IANA timezone
  updated_at: string; // ISO 8601
}

/**
 * ユーザー設定更新リクエスト
 */
export interface UserSettingsUpdate {
  notify_time?: string; // "HH:MM" 形式
}

/**
 * メンテナンス統計情報
 */
export interface MaintenanceStats {
  upcoming_count: number; // 今後のメンテナンス件数
  overdue_count: number; // 期限超過のメンテナンス件数
  completed_total: number; // 累計完了件数
  completed_this_month: number; // 今月の完了件数
}
