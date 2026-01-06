"""QA markdown generation and management service."""

import logging
import re
from datetime import UTC, datetime

from google import genai
from google.genai import types

from app.config import settings
from app.schemas.qa import QAMetadata
from app.services.pdf_storage import get_qa_path
from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


QA_GENERATION_PROMPT = """
この製品の説明書PDFを読んで、よくある質問（FAQ）をMarkdown形式で生成してください。

## 出力フォーマット（厳守）:

```markdown
## 操作・設定
### Q: [質問内容]
**A**: [回答内容]
**参照**: P.[ページ番号]

### Q: [質問内容]
**A**: [回答内容]
**参照**: P.[ページ番号]

## お手入れ・メンテナンス
### Q: [質問内容]
**A**: [回答内容]
**参照**: P.[ページ番号]

## トラブルシューティング
### Q: [質問内容]
**A**: [回答内容]
**参照**: P.[ページ番号]

## 仕様・その他
### Q: [質問内容]
**A**: [回答内容]
**参照**: P.[ページ番号]
```

## 要件:
- 各カテゴリに3〜5件の質問を含めてください
- ユーザーが実際に聞きそうな実用的な質問を選んでください
- 回答は簡潔かつ具体的に
- 必ず参照ページ番号を含めてください
- 説明書に記載がない内容は含めないでください
"""


def generate_qa_header(
    shared_appliance_id: str, manufacturer: str, model_number: str
) -> str:
    """
    Generate QA markdown header with metadata.

    Args:
        shared_appliance_id: Shared appliance ID
        manufacturer: Manufacturer name
        model_number: Model number

    Returns:
        Markdown header with frontmatter
    """
    now = datetime.now(UTC).isoformat()
    return f"""---
appliance_id: {shared_appliance_id}
manufacturer: {manufacturer}
model_number: {model_number}
generated_at: {now}
last_updated_at: {now}
---

# {manufacturer} {model_number} よくある質問

"""


async def generate_qa_markdown(
    pdf_bytes: bytes,
    manufacturer: str,
    model_number: str,
    category: str,
    shared_appliance_id: str,
) -> str:
    """
    Generate QA markdown from PDF using Gemini API.

    Args:
        pdf_bytes: PDF file bytes
        manufacturer: Manufacturer name
        model_number: Model number
        category: Product category
        shared_appliance_id: Shared appliance ID

    Returns:
        Complete QA markdown content
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                    types.Part.from_text(text=QA_GENERATION_PROMPT),
                ],
            ),
        ],
    )

    header = generate_qa_header(shared_appliance_id, manufacturer, model_number)
    qa_content = response.text

    # Add user-added QA section
    footer = "\n\n## ユーザー追加QA\n"

    return header + qa_content + footer


async def get_qa_markdown(manufacturer: str, model_number: str) -> str | None:
    """
    Get QA markdown from Supabase Storage.

    Args:
        manufacturer: Manufacturer name
        model_number: Model number

    Returns:
        QA markdown content or None if not found
    """
    supabase = get_supabase_client()
    qa_path = get_qa_path(manufacturer, model_number)

    try:
        response = supabase.storage.from_("manuals").download(qa_path)
        return response.decode("utf-8")
    except Exception as e:
        logger.debug(f"QA not found: {qa_path}, error: {e}")
        return None


async def save_qa_markdown(manufacturer: str, model_number: str, content: str) -> str:
    """
    Save QA markdown to Supabase Storage.

    Args:
        manufacturer: Manufacturer name
        model_number: Model number
        content: QA markdown content

    Returns:
        Storage path of saved QA
    """
    supabase = get_supabase_client()
    qa_path = get_qa_path(manufacturer, model_number)

    supabase.storage.from_("manuals").upload(
        qa_path,
        content.encode("utf-8"),
        {"content-type": "text/plain", "upsert": "true"},
    )

    return qa_path


async def append_qa_to_markdown(
    manufacturer: str, model_number: str, question: str, answer: str, source: str
) -> str:
    """
    Append new QA to markdown file.

    Args:
        manufacturer: Manufacturer name
        model_number: Model number
        question: Question text
        answer: Answer text
        source: Source of answer ("text_cache" or "pdf")

    Returns:
        Updated QA markdown content

    Raises:
        ValueError: If QA markdown not found
    """
    content = await get_qa_markdown(manufacturer, model_number)
    if not content:
        raise ValueError("QA markdown not found")

    # Update last_updated_at in metadata
    now = datetime.now(UTC).isoformat()
    content = re.sub(r"last_updated_at: .+", f"last_updated_at: {now}", content)

    # Append to user-added QA section
    date_str = datetime.now(UTC).strftime("%Y-%m-%d")
    new_qa = f"""
### Q: {question} (追加: {date_str})
**A**: {answer}
**ソース**: {source}
"""

    content = content.rstrip() + new_qa
    await save_qa_markdown(manufacturer, model_number, content)
    return content


def parse_qa_metadata(content: str) -> QAMetadata | None:
    """
    Parse QA metadata from markdown frontmatter.

    Args:
        content: QA markdown content

    Returns:
        Parsed metadata or None if not found
    """
    match = re.search(r"---\n(.+?)\n---", content, re.DOTALL)
    if not match:
        return None

    metadata_text = match.group(1)
    metadata = {}
    for line in metadata_text.strip().split("\n"):
        if ": " in line:
            key, value = line.split(": ", 1)
            metadata[key] = value

    return QAMetadata(
        appliance_id=metadata.get("appliance_id", ""),
        manufacturer=metadata.get("manufacturer", ""),
        model_number=metadata.get("model_number", ""),
        generated_at=(
            datetime.fromisoformat(metadata["generated_at"])
            if metadata.get("generated_at")
            else None
        ),
        last_updated_at=(
            datetime.fromisoformat(metadata["last_updated_at"])
            if metadata.get("last_updated_at")
            else None
        ),
    )


def count_qa_items(content: str) -> int:
    """
    Count QA items in markdown content.

    Args:
        content: QA markdown content

    Returns:
        Number of QA items
    """
    return len(re.findall(r"### Q:", content))
