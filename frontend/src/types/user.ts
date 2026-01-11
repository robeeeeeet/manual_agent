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

/**
 * User tier definition
 */
export interface UserTier {
  id: string;
  name: string; // 'free', 'basic', 'premium'
  display_name: string; // '無料プラン', etc.
  max_appliances: number; // -1 = unlimited
  max_manual_searches_per_day: number;
  max_qa_questions_per_day: number;
}

/**
 * Daily usage statistics
 */
export interface DailyUsage {
  user_id: string;
  date: string;
  manual_searches: number;
  qa_questions: number;
}

/**
 * Complete usage stats for mypage
 */
export interface UserUsageStats {
  tier: UserTier;
  daily_usage: DailyUsage;
  appliance_count: number;
}

/**
 * Tier limit exceeded error response
 */
export interface TierLimitError {
  error: "TIER_LIMIT_EXCEEDED";
  message: string;
  current_usage: number;
  limit: number;
  tier: string;
  tier_display_name: string;
}
