"""Contact/Feedback schemas."""

from enum import Enum

from pydantic import BaseModel, Field


class ContactType(str, Enum):
    """お問い合わせ種類"""

    FEATURE_REQUEST = "feature_request"
    BUG_REPORT = "bug_report"
    OTHER = "other"


class ContactScreen(str, Enum):
    """発生画面"""

    REGISTER = "register"
    APPLIANCE_LIST = "appliance_list"
    APPLIANCE_DETAIL = "appliance_detail"
    MAINTENANCE = "maintenance"
    QA = "qa"
    GROUPS = "groups"
    MYPAGE = "mypage"
    OTHER = "other"


class ContactRequest(BaseModel):
    """お問い合わせリクエスト"""

    type: ContactType = Field(..., description="お問い合わせ種類")
    screen: ContactScreen = Field(..., description="発生画面")
    content: str = Field(..., min_length=1, max_length=5000, description="内容")
    reproduction_steps: str | None = Field(
        None, max_length=5000, description="発生手順（バグ報告時）"
    )
    screenshot_base64: str | None = Field(
        None, description="スクリーンショット（Base64エンコード）"
    )
    screenshot_filename: str | None = Field(
        None, description="スクリーンショットのファイル名"
    )


class ContactResponse(BaseModel):
    """お問い合わせレスポンス"""

    success: bool
    message: str
