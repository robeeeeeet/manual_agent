"""QA (Question & Answer) schemas for request/response models."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


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

    event: str  # "step_start", "step_complete", "answer", "error"
    step: int | None = None  # 1, 2, or 3
    step_name: str | None = None  # Step description
    answer: str | None = None
    source: str | None = None
    reference: str | None = None
    added_to_qa: bool = False
    error: str | None = None
    session_id: str | None = None  # 新規追加


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
