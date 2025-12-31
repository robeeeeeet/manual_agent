"""
Phase 0-3用: テストPDFをダウンロード
"""

import os
import requests
from pathlib import Path

# ダウンロード先
OUTPUT_DIR = Path(__file__).parent / "test_pdfs"
OUTPUT_DIR.mkdir(exist_ok=True)

# テスト対象のPDF（Phase 0-2で取得したURL）
TEST_PDFS = [
    {
        "manufacturer": "日立",
        "model_number": "MRO-S7D",
        "category": "オーブンレンジ",
        "url": "https://kadenfan.hitachi.co.jp/support/range/item/docs/mro-s7d_M.pdf",
        "filename": "hitachi_mro-s7d.pdf"
    },
    {
        "manufacturer": "象印",
        "model_number": "CP-EA20",
        "category": "電気ポット",
        "url": "https://www.zojirushi.co.jp/toiawase/TR_PDF/CPEA.pdf",
        "filename": "zojirushi_cp-ea20.pdf"
    },
    {
        "manufacturer": "象印",
        "model_number": "NW-JX10",
        "category": "炊飯器",
        "url": "https://www.zojirushi.co.jp/toiawase/TR_PDF/NWJX.pdf",
        "filename": "zojirushi_nw-jx10.pdf"
    },
    {
        "manufacturer": "タイガー",
        "model_number": "KAM-R132",
        "category": "オーブントースター",
        "url": "https://www.tiger-forest.com/ja/manuals/oven/KAM-R132/file",
        "filename": "tiger_kam-r132.pdf"
    },
]


def download_pdf(url: str, filename: str) -> bool:
    """PDFをダウンロード"""
    output_path = OUTPUT_DIR / filename

    if output_path.exists():
        print(f"  既にダウンロード済み: {filename}")
        return True

    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        response = requests.get(url, headers=headers, timeout=60, stream=True)
        response.raise_for_status()

        # Content-Typeを確認
        content_type = response.headers.get("Content-Type", "")
        if "pdf" not in content_type.lower() and not url.endswith(".pdf"):
            print(f"  警告: Content-Type = {content_type}")

        with open(output_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        file_size = output_path.stat().st_size
        print(f"  ✅ ダウンロード完了: {filename} ({file_size/1024:.1f} KB)")
        return True
    except Exception as e:
        print(f"  ❌ ダウンロード失敗: {e}")
        return False


def main():
    print("Phase 0-3用テストPDFダウンロード")
    print("=" * 50)

    success_count = 0
    for pdf_info in TEST_PDFS:
        print(f"\n{pdf_info['manufacturer']} {pdf_info['model_number']}:")
        if download_pdf(pdf_info["url"], pdf_info["filename"]):
            success_count += 1

    print(f"\n完了: {success_count}/{len(TEST_PDFS)} ダウンロード成功")
    print(f"保存先: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
