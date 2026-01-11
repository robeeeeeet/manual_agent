// QAメタデータ
export interface QAMetadata {
  appliance_id: string;
  manufacturer: string;
  model_number: string;
  generated_at: string | null;
  last_updated_at: string | null;
}

// QA生成レスポンス
export interface QAGenerateResponse {
  success: boolean;
  qa_path: string | null;
  item_count: number;
  message: string;
}

// QA取得レスポンス
export interface QAGetResponse {
  exists: boolean;
  content: string | null;
  metadata: QAMetadata | null;
}

// 質問リクエスト
export interface QAAskRequest {
  question: string;
  session_id?: string; // 会話履歴セッションID
}

// 質問レスポンス
export interface QAAskResponse {
  answer: string;
  source: 'qa' | 'text_cache' | 'pdf' | 'none';
  reference: string | null;
  added_to_qa: boolean;
}

// フィードバックリクエスト
export interface QAFeedbackRequest {
  question: string;
  answer: string;
  is_helpful: boolean;
  correction: string | null;
}

// フィードバックレスポンス
export interface QAFeedbackResponse {
  success: boolean;
  message: string;
  deleted: boolean;
}

// チャットメッセージ（フロントエンド用）
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  source?: 'qa' | 'text_cache' | 'pdf' | 'none';
  reference?: string | null;
  timestamp: Date;
  feedbackGiven?: boolean;
}

// SSEストリーミングイベント
export interface QAStreamEvent {
  event: 'step_start' | 'step_complete' | 'answer' | 'error';
  step?: number;
  step_name?: string;
  answer?: string;
  source?: 'qa' | 'text_cache' | 'pdf' | 'none';
  reference?: string | null;
  added_to_qa?: boolean;
  error?: string;
  session_id?: string; // 会話履歴セッションID
}

// 検索ステップの進捗状態
export interface SearchProgress {
  currentStep: number;
  stepName: string;
  completedSteps: number[];
}

// QAエラーコード
export type QAErrorCode = 'UNAUTHORIZED' | 'QA_BLOCKED' | 'INVALID_QUESTION';

// QA機能制限中のエラー
export interface QABlockedError {
  error: string;
  code: 'QA_BLOCKED';
  restricted_until: string; // ISO日時
  violation_count: number;
}

// 不適切な質問のエラー
export interface InvalidQuestionError {
  error: string;
  code: 'INVALID_QUESTION';
  violation_type: 'off_topic' | 'inappropriate' | 'attack';
  reason: string;
}

// QAエラー（統合型）
export type QAError =
  | QABlockedError
  | InvalidQuestionError
  | { error: string; code?: string };

// --- QAセッション関連の型 ---

// セッションのメッセージ（バックエンドからの履歴）
export interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'qa' | 'text_cache' | 'pdf' | 'none' | null;
  reference?: string | null;
  created_at: string;
}

// セッション一覧用のサマリー
export interface QASessionSummary {
  id: string;
  shared_appliance_id: string;
  is_active: boolean;
  message_count: number;
  summary: string | null; // LLMで要約された会話タイトル
  first_message: string | null; // プレビュー用（summaryがない場合のフォールバック）
  created_at: string;
  last_activity_at: string;
}

// セッション詳細（メッセージ含む）
export interface QASessionDetail {
  id: string;
  user_id: string;
  shared_appliance_id: string;
  is_active: boolean;
  messages: ChatHistoryMessage[];
  created_at: string;
  last_activity_at: string;
}

// セッション一覧レスポンス
export interface QASessionListResponse {
  sessions: QASessionSummary[];
}

// セッションリセットレスポンス
export interface QAResetSessionResponse {
  success: boolean;
  message: string;
  new_session_id: string | null;
}
