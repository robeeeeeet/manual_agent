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
