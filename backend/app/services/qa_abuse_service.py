"""QA abuse prevention service for question validation and user restriction management."""

import json
import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Literal

from google import genai

from app.config import settings
from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

# Violation types
VIOLATION_TYPE_OFF_TOPIC = "off_topic"
VIOLATION_TYPE_INAPPROPRIATE = "inappropriate"
VIOLATION_TYPE_ATTACK = "attack"

# Detection methods
DETECTION_METHOD_RULE = "rule_based"
DETECTION_METHOD_LLM = "llm"

# Restriction time settings (in seconds)
RESTRICTION_TIMES = {
    1: 0,  # 1st violation: no restriction (reject but allow immediate retry)
    2: 3600,  # 2nd violation: 1 hour
    3: 86400,  # 3rd violation: 24 hours
    # 4+ violations: 7 days
}
DEFAULT_RESTRICTION_TIME = 604800  # 7 days


# Rule-based patterns for quick validation
OFF_TOPIC_PATTERNS = [
    r"天気",
    r"株価",
    r"ニュース",
    r"運勢",
    r"今日の.*?は",
    r"weather",
    r"stock",
    r"news",
]

INAPPROPRIATE_PATTERNS = [
    r"爆弾",
    r"危険物",
    r"weapon",
    r"bomb",
    r"explosive",
]

PROMPT_INJECTION_PATTERNS = [
    r"ignore.*?instructions?",
    r"system\s+prompt",
    r"あなたの指示を無視",
    r"命令を無視",
    r"ignore.*?previous",
    r"forget.*?instructions?",
]


async def check_user_restriction(user_id: str) -> dict | None:
    """
    Check if user is currently restricted from using QA.

    Args:
        user_id: User ID to check

    Returns:
        Dict with restriction info if restricted, None if not restricted.
        Returns: {
            "restricted_until": datetime,
            "violation_count": int
        }
    """
    supabase = get_supabase_client()
    if not supabase:
        logger.error("Supabase client not available")
        return None

    try:
        response = (
            supabase.table("qa_restrictions")
            .select("*")
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if not response.data:
            return None

        restriction = response.data
        restricted_until = restriction.get("restricted_until")

        # Check if still restricted
        if restricted_until:
            restricted_datetime = datetime.fromisoformat(
                restricted_until.replace("Z", "+00:00")
            )
            now = datetime.now(UTC)

            if restricted_datetime > now:
                return {
                    "restricted_until": restricted_datetime,
                    "violation_count": restriction["violation_count"],
                }

        # Not restricted or restriction expired
        return None

    except Exception as e:
        logger.error(f"Error checking user restriction: {e}")
        return None


def _check_rule_based(question: str) -> tuple[bool, str | None, str | None]:
    """
    Check question against rule-based patterns.

    Args:
        question: Question text

    Returns:
        Tuple of (is_valid, violation_type, reason)
        - is_valid: False if violation detected, True otherwise
        - violation_type: Type of violation if detected
        - reason: Human-readable reason if violation detected
    """
    question_lower = question.lower()

    # Check off-topic patterns
    for pattern in OFF_TOPIC_PATTERNS:
        if re.search(pattern, question_lower, re.IGNORECASE):
            return (
                False,
                VIOLATION_TYPE_OFF_TOPIC,
                "製品の使い方やメンテナンスについてお聞きください",
            )

    # Check inappropriate patterns
    for pattern in INAPPROPRIATE_PATTERNS:
        if re.search(pattern, question_lower, re.IGNORECASE):
            return (False, VIOLATION_TYPE_INAPPROPRIATE, "不適切な質問は回答できません")

    # Check prompt injection patterns
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, question, re.IGNORECASE):
            return (False, VIOLATION_TYPE_ATTACK, "不適切な質問は回答できません")

    return (True, None, None)


async def _check_llm_based(
    question: str, maker: str, model_number: str, category: str
) -> tuple[bool, str | None]:
    """
    Check question relevance using LLM.

    Args:
        question: Question text
        maker: Manufacturer name
        model_number: Model number
        category: Product category

    Returns:
        Tuple of (is_valid, reason)
        - is_valid: False if violation detected, True otherwise
        - reason: Human-readable reason if violation detected
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = f"""
この質問は以下の製品に関連していますか？

【製品情報】
メーカー: {maker}
型番: {model_number}
カテゴリ: {category}

【質問】
{question}

【判定ルール】
- 製品の使い方、メンテナンス、トラブルシューティング、仕様に関する質問は「関連あり」
- 製品とは全く関係ない質問（天気、株価、一般知識など）は「関連なし」

以下のJSON形式で回答してください：
{{"is_related": true/false, "reason": "判定理由"}}
"""

    try:
        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )

        text = response.text.strip()

        # Extract JSON
        json_match = re.search(r"\{.+\}", text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            is_related = result.get("is_related", True)
            reason = result.get("reason", "")

            if not is_related:
                return (False, f"製品に関連しない質問です: {reason}")

            return (True, None)

    except Exception as e:
        logger.error(f"LLM validation error: {e}")
        # On error, allow the question (prevent false positives)
        return (True, None)

    # Default: allow
    return (True, None)


async def validate_question(
    question: str, maker: str, model_number: str, category: str
) -> tuple[bool, dict | None]:
    """
    Validate question using rule-based + LLM hybrid approach.

    Args:
        question: Question text
        maker: Manufacturer name
        model_number: Model number
        category: Product category

    Returns:
        Tuple of (is_valid, error_info)
        - is_valid: True if valid, False if violation
        - error_info: Dict with violation details if invalid, None if valid
          {
              "violation_type": str,
              "detection_method": str,
              "reason": str
          }
    """
    # Step 1: Rule-based check (fast, free)
    is_valid, violation_type, reason = _check_rule_based(question)
    if not is_valid:
        return (
            False,
            {
                "violation_type": violation_type,
                "detection_method": DETECTION_METHOD_RULE,
                "reason": reason,
            },
        )

    # Step 2: LLM-based check (precise, costs money)
    is_valid, reason = await _check_llm_based(question, maker, model_number, category)
    if not is_valid:
        return (
            False,
            {
                "violation_type": VIOLATION_TYPE_OFF_TOPIC,
                "detection_method": DETECTION_METHOD_LLM,
                "reason": reason,
            },
        )

    return (True, None)


async def record_violation(
    user_id: str,
    shared_appliance_id: str,
    question: str,
    violation_type: Literal["off_topic", "inappropriate", "attack"],
    detection_method: Literal["rule_based", "llm"],
) -> None:
    """
    Record a violation to qa_violations table.

    Args:
        user_id: User ID
        shared_appliance_id: Shared appliance ID
        question: Violation question text
        violation_type: Type of violation
        detection_method: Detection method used
    """
    supabase = get_supabase_client()
    if not supabase:
        logger.error("Supabase client not available")
        return

    try:
        supabase.table("qa_violations").insert(
            {
                "user_id": user_id,
                "shared_appliance_id": shared_appliance_id,
                "question": question,
                "violation_type": violation_type,
                "detection_method": detection_method,
            }
        ).execute()

        logger.info(
            f"Recorded violation for user {user_id}: {violation_type} ({detection_method})"
        )

    except Exception as e:
        logger.error(f"Error recording violation: {e}")


async def update_restriction(user_id: str) -> dict:
    """
    Update user restriction based on violation count.

    Increments violation count and sets restricted_until based on count.

    Args:
        user_id: User ID

    Returns:
        Dict with updated restriction info:
        {
            "violation_count": int,
            "restricted_until": datetime | None
        }
    """
    supabase = get_supabase_client()
    if not supabase:
        logger.error("Supabase client not available")
        return {"violation_count": 0, "restricted_until": None}

    try:
        # Get or create restriction record
        response = (
            supabase.table("qa_restrictions")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )

        now = datetime.now(UTC)
        new_violation_count = 1
        restriction_seconds = RESTRICTION_TIMES.get(1, 0)

        if response.data and len(response.data) > 0:
            # Update existing record
            current = response.data[0]
            new_violation_count = current["violation_count"] + 1
            restriction_seconds = RESTRICTION_TIMES.get(
                new_violation_count, DEFAULT_RESTRICTION_TIME
            )

            restricted_until = None
            if restriction_seconds > 0:
                restricted_until = (
                    now + timedelta(seconds=restriction_seconds)
                ).isoformat()

            supabase.table("qa_restrictions").update(
                {
                    "violation_count": new_violation_count,
                    "restricted_until": restricted_until,
                    "last_violation_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                }
            ).eq("user_id", user_id).execute()

            logger.info(
                f"Updated restriction for user {user_id}: "
                f"count={new_violation_count}, restricted_until={restricted_until}"
            )

            return {
                "violation_count": new_violation_count,
                "restricted_until": (
                    datetime.fromisoformat(restricted_until)
                    if restricted_until
                    else None
                ),
            }

        else:
            # Create new record
            restricted_until = None  # 1st violation has no restriction time
            supabase.table("qa_restrictions").insert(
                {
                    "user_id": user_id,
                    "violation_count": new_violation_count,
                    "restricted_until": restricted_until,
                    "last_violation_at": now.isoformat(),
                }
            ).execute()

            logger.info(f"Created restriction record for user {user_id}: count=1")

            return {
                "violation_count": new_violation_count,
                "restricted_until": None,
            }

    except Exception as e:
        logger.error(f"Error updating restriction: {e}")
        return {"violation_count": 0, "restricted_until": None}
