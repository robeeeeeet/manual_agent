"""QA (Question & Answer) schemas for request/response models."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SelfCheckResult(BaseModel):
    """セルフチェック結果."""

    score: int = Field(..., ge=1, le=5, description="品質スコア (1-5)")
    is_acceptable: bool = Field(..., description="回答が許容可能か")
    reason: str = Field(..., description="評価理由")
    # 拡張フィールド（質問・回答タイプ分析）
    question_type: str | None = Field(
        None, description="質問タイプ (方法/頻度/理由/トラブル/仕様/その他)"
    )
    answer_type: str | None = Field(
        None, description="回答タイプ (手順/頻度/理由/解決方法/仕様/その他)"
    )
    type_match: bool | None = Field(
        None, description="質問タイプと回答タイプが適切に対応しているか"
    )


class QAMetadata(BaseModel):
    """QA markdown metadata."""

    appliance_id: str
    manufacturer: str
    model_number: str
    generated_at: datetime | None = None
    last_updated_at: datetime | None = None


class QAItem(BaseModel):
    """Single QA item."""

    question: str
    answer: str
    reference: str | None = None  # Page number, etc.
    source: str | None = None  # "qa", "text_cache", "pdf"
    added_at: datetime | None = None


class QAGenerateRequest(BaseModel):
    """Request to generate QA markdown."""

    force_regenerate: bool = False


class QAGenerateResponse(BaseModel):
    """Response from QA generation."""

    success: bool
    qa_path: str | None = None
    item_count: int = 0
    message: str


class QAGetResponse(BaseModel):
    """Response from QA retrieval."""

    exists: bool
    content: str | None = None
    metadata: QAMetadata | None = None


class QAAskRequest(BaseModel):
    """Request to ask a question."""

    question: str
    session_id: str | None = None  # 指定時はそのセッションで継続


class QAAskResponse(BaseModel):
    """Response from question answering."""

    answer: str
    source: str  # "qa", "text_cache", "pdf", "none"
    reference: str | None = None
    added_to_qa: bool = False


class QAFeedbackRequest(BaseModel):
    """Request to submit feedback on an answer."""

    question: str
    answer: str
    is_helpful: bool
    correction: str | None = None


class QAFeedbackResponse(BaseModel):
    """Response from feedback submission."""

    success: bool
    message: str
    deleted: bool = False


class QABatchGenerateRequest(BaseModel):
    """Request to batch generate QA for multiple appliances."""

    shared_appliance_ids: list[str] | None = None  # None = all appliances
    max_count: int = 100


class QABatchGenerateResponse(BaseModel):
    """Response from batch QA generation."""

    processed: int
    success: int
    failed: int
    errors: list[str]


class QAStreamEvent(BaseModel):
    """SSE event for streaming QA search progress."""

    event: str  # "step_start", "step_complete", "step_timeout", "answer", "error"
    step: float | None = None  # 1, 1.5, 2, 2.5, 3, 3.5 (小数点は検証ステップ)
    step_name: str | None = None  # Step description
    answer: str | None = None
    source: str | None = None
    reference: str | None = None
    added_to_qa: bool = False
    error: str | None = None
    session_id: str | None = None
    message: str | None = None  # 追加メッセージ（タイムアウト時の案内等）
    # セルフチェック関連
    self_check_score: int | None = None  # 整合性スコア (1-5)
    needs_verification: bool = False  # 確認が必要なフラグ
    deleted_invalid_qa: bool = False  # 不整合FAQを削除したか
    used_general_knowledge: bool = False  # 一般知識で補完したか


class ChatHistoryMessage(BaseModel):
    """Chat history message."""

    id: str
    role: Literal["user", "assistant"]
    content: str
    source: str | None = None
    reference: str | None = None
    created_at: datetime


class QASessionSummary(BaseModel):
    """セッション一覧用のサマリー."""

    id: str
    shared_appliance_id: str
    is_active: bool
    message_count: int
    summary: str | None  # LLMで要約された会話タイトル
    first_message: str | None  # 最初のユーザー質問（プレビュー用・フォールバック）
    created_at: datetime
    last_activity_at: datetime


class QASessionDetail(BaseModel):
    """セッション詳細（メッセージ含む）."""

    id: str
    user_id: str
    shared_appliance_id: str
    is_active: bool
    messages: list[ChatHistoryMessage]
    created_at: datetime
    last_activity_at: datetime


class QASessionListResponse(BaseModel):
    """QA session list response."""

    sessions: list[QASessionSummary]


class QAResetSessionResponse(BaseModel):
    """QA reset session response."""

    success: bool
    message: str
    new_session_id: str | None = None
