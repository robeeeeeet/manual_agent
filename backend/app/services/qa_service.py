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

## 各カテゴリで含めるべき質問タイプ

質問の多様性を確保するため、各カテゴリで以下のタイプの質問を含めてください：

- **操作・設定**: 方法型「〜するには」「〜の設定方法」、確認型「〜できますか」
- **お手入れ**: 方法型「〜の掃除方法」「〜のやり方」、頻度型「いつ〜すべき」「どのくらいの頻度で」
- **トラブル**: 原因型「なぜ〜」「〜の原因」、解決型「〜の対処法」「〜したい場合」
- **仕様・その他**: スペック型「〜のサイズ」「〜の仕様」、確認型「〜に対応していますか」

## 質問タイプと回答の対応（重要）

質問のタイプに応じて、適切な形式で回答してください：

### 方法型の質問 → 手順で回答
質問: 「〜の方法を教えてください」「〜するにはどうすればいいですか」
回答: 1. 〜します 2. 〜します 3. 〜します（番号付きで具体的な手順）

### 頻度型の質問 → 周期で回答
質問: 「いつ〜すべきですか」「どのくらいの頻度で」
回答: 「週1回」「2週間に1回」「月1回」など具体的な周期

### 原因型の質問 → 原因を列挙
質問: 「なぜ〜」「〜の原因は」
回答: 考えられる原因を2〜3つ列挙

### 解決型の質問 → 対処法を手順で
質問: 「〜の対処法」「〜を解決するには」
回答: 1. まず〜を確認 2. 〜を試す 3. 解決しない場合は〜

## 良いFAQ例

◯ 例1: 方法型（手順で回答）
### Q: フィルターの掃除方法を教えてください
**A**: 1. 電源を切り、コンセントを抜きます 2. フィルターカバーを外してフィルターを取り出します 3. 掃除機でホコリを吸い取るか、水洗いします 4. 完全に乾かしてから元に戻します
**参照**: P.25

◯ 例2: 頻度型（周期で回答）
### Q: フィルターはどのくらいの頻度で掃除すべきですか
**A**: 2週間に1回の掃除をおすすめします。ホコリが多い環境では週1回を推奨します。
**参照**: P.25

## 悪いFAQ例（避けてください）

✕ 例1: 方法を聞いているのに頻度だけを回答
### Q: フィルターの掃除方法を教えてください
**A**: 2週間に1回の掃除をおすすめします。
→ 具体的な手順がない！方法を聞かれたら手順を回答すること

✕ 例2: 抽象的すぎる回答
### Q: 内部の清掃方法を教えてください
**A**: 定期的にお手入れしてください。
→ 何をどうするか具体的に書くこと

✕ 例3: 頻度を聞いているのに手順を回答
### Q: いつ掃除すればいいですか
**A**: フィルターを外して水洗いします。
→ 質問と回答がミスマッチ

## 回答の具体性チェック

以下のような抽象的な回答は避けてください：
- 「定期的にお手入れしてください」→ 具体的な周期と方法を書く
- 「使用後に確認してください」→ 何を確認するか具体的に
- 「必要に応じて交換してください」→ いつ交換が必要かの目安を書く

## 要件:
- 各カテゴリに3〜5件の質問を含めてください
- 質問タイプの多様性を確保（方法型、頻度型をバランスよく）
- **質問タイプと回答タイプを一致させる**（方法→手順、頻度→周期）
- 回答は具体的に（番号付き手順、具体的な周期）
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
        model="gemini-2.5-flash",
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
