"""
Batch script to update existing shared_maintenance_items with pdf_page_number.

This script:
1. Fetches shared_maintenance_items that have source_page but no pdf_page_number
2. Groups them by shared_appliance_id
3. For each appliance, downloads the PDF and asks Gemini for PDF page numbers
4. Updates the records with pdf_page_number and printed_page_number
"""

import asyncio
import json
import os
import sys
import tempfile
import time

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "backend"))

from dotenv import load_dotenv

load_dotenv()

import requests
from google import genai
from google.genai import types
from supabase import create_client

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def get_supabase_client():
    """Get Supabase client."""
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_gemini_client():
    """Get Gemini client."""
    return genai.Client(api_key=GEMINI_API_KEY)


async def download_pdf(pdf_url: str) -> bytes | None:
    """Download PDF from URL or Supabase Storage path."""
    try:
        # Check if it's a Supabase Storage path (not a full URL)
        if not pdf_url.startswith("http://") and not pdf_url.startswith("https://"):
            # Supabase Storage path - get signed URL
            client = get_supabase_client()
            # stored_pdf_path is relative to the bucket (e.g., "mfr_xxx/model/manual.pdf")
            result = client.storage.from_("manuals").create_signed_url(pdf_url, 3600)
            if result and "signedURL" in result:
                pdf_url = result["signedURL"]
            else:
                print(f"  Failed to get signed URL for {pdf_url}")
                return None

        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(pdf_url, headers=headers, timeout=60)
        response.raise_for_status()
        return response.content
    except Exception as e:
        print(f"  Error downloading PDF: {e}")
        return None


async def upload_pdf_to_gemini(client, pdf_bytes: bytes, filename: str):
    """Upload PDF to Gemini API."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        file = client.files.upload(
            file=tmp_path,
            config=types.UploadFileConfig(display_name=filename, mime_type="application/pdf"),
        )

        # Wait for processing
        while file.state.name == "PROCESSING":
            time.sleep(2)
            file = client.files.get(name=file.name)

        if file.state.name == "FAILED":
            raise Exception(f"File processing failed: {file.state.name}")

        return file
    finally:
        os.unlink(tmp_path)


async def get_pdf_page_numbers_for_items(
    gemini_client, uploaded_file, items: list[dict]
) -> dict[str, dict]:
    """
    Ask Gemini for PDF page numbers for multiple maintenance items.

    Returns:
        dict mapping item_id to {"pdf_page_number": int, "printed_page_number": str}
    """
    # Build items list for prompt
    items_text = "\n".join([
        f'{i+1}. 項目名: "{item["task_name"]}"'
        for i, item in enumerate(items)
    ])

    prompt = f"""このPDFから以下のメンテナンス項目のページ番号を特定してください。

## メンテナンス項目リスト
{items_text}

## 重要な注意
- 「PDFページ番号」: PDFビューア（Adobe Reader、ブラウザ等）で表示される **1から始まる連番**
  - PDFファイルの1ページ目から数えて何枚目か
- 「印刷ページ番号」: 説明書に印刷されているページ番号（例: "26ページ"）
  - PDFと実際の印刷ページ番号は異なることが多い（表紙、見開き等）

## 出力形式（JSON）
```json
{{
  "results": [
    {{
      "item_name": "項目名",
      "pdf_page_number": PDFビューアのページ番号（数値）,
      "printed_page_number": "印刷されているページ番号（文字列）"
    }}
  ]
}}
```

各項目について、該当するページが見つからない場合は pdf_page_number を null としてください。"""

    response = gemini_client.models.generate_content(
        model="gemini-2.5-flash", contents=[uploaded_file, prompt]
    )

    response_text = response.text.strip()

    # Extract JSON
    if "```json" in response_text:
        start = response_text.find("```json") + 7
        end = response_text.find("```", start)
        response_text = response_text[start:end].strip()
    elif "```" in response_text:
        start = response_text.find("```") + 3
        end = response_text.find("```", start)
        response_text = response_text[start:end].strip()

    try:
        result = json.loads(response_text)
        # Map by item_name
        page_map = {}
        for r in result.get("results", []):
            page_map[r["item_name"]] = {
                "pdf_page_number": r.get("pdf_page_number"),
                "printed_page_number": r.get("printed_page_number"),
            }
        return page_map
    except json.JSONDecodeError as e:
        print(f"  JSON parse error: {e}")
        print(f"  Response: {response_text[:500]}")
        return {}


async def main():
    """Main function."""
    print("=" * 60)
    print("PDF Page Number Update Batch")
    print("=" * 60)

    client = get_supabase_client()
    gemini_client = get_gemini_client()

    # Fetch items that need updating (have source_page but no pdf_page_number)
    print("\n[1] Fetching items to update...")
    response = (
        client.table("shared_maintenance_items")
        .select("id, shared_appliance_id, task_name, source_page, pdf_page_number, printed_page_number")
        .is_("pdf_page_number", "null")
        .not_.is_("source_page", "null")
        .execute()
    )

    items = response.data or []
    print(f"  Found {len(items)} items to update")

    if not items:
        print("\n  No items need updating. Exiting.")
        return

    # Group by shared_appliance_id
    items_by_appliance = {}
    for item in items:
        appliance_id = item["shared_appliance_id"]
        if appliance_id not in items_by_appliance:
            items_by_appliance[appliance_id] = []
        items_by_appliance[appliance_id].append(item)

    print(f"  Items grouped into {len(items_by_appliance)} appliances")

    # Fetch appliance info (for PDF path)
    appliance_ids = list(items_by_appliance.keys())
    appliances_response = (
        client.table("shared_appliances")
        .select("id, maker, model_number, stored_pdf_path, manual_source_url")
        .in_("id", appliance_ids)
        .execute()
    )
    appliances = {a["id"]: a for a in (appliances_response.data or [])}

    # Process each appliance
    print("\n[2] Processing appliances...")
    updated_count = 0
    error_count = 0

    for appliance_id, appliance_items in items_by_appliance.items():
        appliance = appliances.get(appliance_id)
        if not appliance:
            print(f"\n  Appliance {appliance_id}: Not found, skipping")
            continue

        print(f"\n  Appliance: {appliance['maker']} {appliance['model_number']}")
        print(f"    Items: {len(appliance_items)}")

        # Get PDF URL
        pdf_url = appliance.get("stored_pdf_path") or appliance.get("manual_source_url")
        if not pdf_url:
            print("    No PDF available, skipping")
            continue

        # Download PDF
        print(f"    Downloading PDF...")
        pdf_bytes = await download_pdf(pdf_url)
        if not pdf_bytes:
            print("    Failed to download PDF, skipping")
            error_count += len(appliance_items)
            continue

        # Upload to Gemini
        print(f"    Uploading to Gemini...")
        try:
            uploaded_file = await upload_pdf_to_gemini(
                gemini_client, pdf_bytes, f"{appliance['model_number']}.pdf"
            )
        except Exception as e:
            print(f"    Failed to upload to Gemini: {e}")
            error_count += len(appliance_items)
            continue

        # Get page numbers
        print(f"    Analyzing PDF for page numbers...")
        page_map = await get_pdf_page_numbers_for_items(
            gemini_client, uploaded_file, appliance_items
        )

        # Update records
        print(f"    Updating records...")
        for item in appliance_items:
            page_info = page_map.get(item["task_name"], {})
            pdf_page = page_info.get("pdf_page_number")
            printed_page = page_info.get("printed_page_number")

            # If no printed_page from LLM, use existing source_page
            if not printed_page:
                printed_page = item.get("source_page")

            if pdf_page is not None:
                try:
                    client.table("shared_maintenance_items").update({
                        "pdf_page_number": pdf_page,
                        "printed_page_number": printed_page,
                    }).eq("id", item["id"]).execute()
                    print(f"      ✓ {item['task_name']}: PDF={pdf_page}, Printed={printed_page}")
                    updated_count += 1
                except Exception as e:
                    print(f"      ✗ {item['task_name']}: Update failed - {e}")
                    error_count += 1
            else:
                print(f"      - {item['task_name']}: Page not found")
                # Still update printed_page_number if available
                if printed_page and printed_page != item.get("printed_page_number"):
                    try:
                        client.table("shared_maintenance_items").update({
                            "printed_page_number": printed_page,
                        }).eq("id", item["id"]).execute()
                    except Exception:
                        pass

        # Clean up Gemini file
        try:
            gemini_client.files.delete(name=uploaded_file.name)
        except Exception:
            pass

    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"  Total items: {len(items)}")
    print(f"  Updated: {updated_count}")
    print(f"  Errors: {error_count}")
    print(f"  Skipped: {len(items) - updated_count - error_count}")


if __name__ == "__main__":
    asyncio.run(main())
