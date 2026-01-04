#!/usr/bin/env python3
"""
VAPID鍵ペア生成スクリプト

Web Push通知に必要なVAPID（Voluntary Application Server Identification）鍵ペアを生成します。

使用方法:
    cd backend && uv run python ../scripts/generate-vapid-keys.py

生成された鍵は .env ファイルに手動で設定してください。
"""

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
import base64


def generate_vapid_keys():
    """VAPID鍵ペアを生成してBase64エンコードする"""
    # VAPID鍵ペアを生成
    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    public_key = private_key.public_key()

    # 公開鍵を未圧縮形式でエクスポート
    public_numbers = public_key.public_numbers()
    x = public_numbers.x.to_bytes(32, "big")
    y = public_numbers.y.to_bytes(32, "big")
    public_key_uncompressed = b"\x04" + x + y

    # Base64エンコード（URLセーフ、パディングなし）
    public_key_b64 = (
        base64.urlsafe_b64encode(public_key_uncompressed).decode("utf-8").rstrip("=")
    )

    # 秘密鍵もBase64エンコード
    private_numbers = private_key.private_numbers()
    private_key_int = private_numbers.private_value.to_bytes(32, "big")
    private_key_b64 = (
        base64.urlsafe_b64encode(private_key_int).decode("utf-8").rstrip("=")
    )

    return public_key_b64, private_key_b64


def main():
    print("=" * 80)
    print("VAPID鍵ペア生成")
    print("=" * 80)
    print()

    public_key, private_key = generate_vapid_keys()

    print("生成された鍵を .env ファイルに設定してください:")
    print()
    print("【プロジェクトルート .env に追加】")
    print(f"VAPID_PUBLIC_KEY={public_key}")
    print(f"VAPID_PRIVATE_KEY={private_key}")
    print("VAPID_SUBJECT=mailto:your-email@example.com")
    print()
    print("【frontend/.env.local に追加】")
    print(f"NEXT_PUBLIC_VAPID_PUBLIC_KEY={public_key}")
    print()
    print("=" * 80)
    print("注意:")
    print("  - VAPID_PRIVATE_KEY は秘密にしてください")
    print("  - VAPID_SUBJECT にはメールアドレスまたはHTTPSのURLを設定")
    print("  - 本番環境とテスト環境で異なる鍵を使用することを推奨")
    print("=" * 80)


if __name__ == "__main__":
    main()
