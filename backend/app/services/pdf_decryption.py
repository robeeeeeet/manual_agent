"""
PDF暗号化解除サービス

pikepdfを使用してPDFの暗号化を解除する。
- オーナーパスワード（編集制限）: 解除可能
- ユーザーパスワード（閲覧制限）: 解除不可
"""

import logging
from io import BytesIO

import pikepdf

logger = logging.getLogger(__name__)


def is_pdf_encrypted(pdf_content: bytes) -> bool:
    """
    PDFが暗号化されているかチェック

    Args:
        pdf_content: PDFファイルのバイト列

    Returns:
        True if encrypted, False otherwise
    """
    try:
        with pikepdf.open(BytesIO(pdf_content)) as pdf:
            return pdf.is_encrypted
    except pikepdf.PasswordError:
        # ユーザーパスワードが必要な場合
        return True
    except Exception as e:
        logger.warning(f"PDF encryption check failed: {e}")
        return False


def decrypt_pdf(pdf_content: bytes) -> tuple[bytes, bool, bool]:
    """
    PDFの暗号化を解除する

    Args:
        pdf_content: PDFファイルのバイト列

    Returns:
        tuple[bytes, bool, bool]:
            - PDFバイト列（解除成功時は新しいバイト列、それ以外は元のバイト列）
            - 解除が行われたかどうか
            - まだ暗号化されているかどうか（ユーザーパスワード必要で解除不可）

        戻り値のパターン:
            - (decrypted_bytes, True, False): オーナーパスワード解除成功
            - (original_bytes, False, False): 元々暗号化されていない
            - (original_bytes, False, True): ユーザーパスワード必要で解除不可
    """
    try:
        with pikepdf.open(BytesIO(pdf_content)) as pdf:
            if not pdf.is_encrypted:
                logger.debug("PDF is not encrypted")
                return pdf_content, False, False  # 暗号化なし

            # オーナーパスワードのみの場合は解除可能
            # pikepdfは空のパスワードで開けるPDFを自動的に解除できる
            output = BytesIO()
            pdf.save(output)
            logger.info("PDF decryption successful (owner password removed)")
            return output.getvalue(), True, False  # 解除成功

    except pikepdf.PasswordError:
        # ユーザーパスワードが必要 - 解除不可
        logger.warning("PDF requires user password - cannot decrypt")
        return pdf_content, False, True  # 暗号化のまま

    except Exception as e:
        logger.error(f"PDF decryption failed: {e}")
        # エラー時は暗号化なしと扱う（元のPDFをそのまま使用）
        return pdf_content, False, False
