"""
Phase 0-1: 画像からメーカー・型番読み取りの検証スクリプト

使用方法:
1. プロジェクトルートに .env ファイルを作成し、GEMINI_API_KEY を設定
2. 実行: python test_image_recognition.py <画像パス>
"""

import os
import sys
import base64
import json
from pathlib import Path

# .envファイルを読み込み（プロジェクトルートから）
try:
    from dotenv import load_dotenv
    # プロジェクトルートの.envを読み込む
    project_root = Path(__file__).parent.parent.parent
    load_dotenv(project_root / ".env")
except ImportError:
    print("python-dotenv パッケージをインストールしてください:")
    print("  pip install python-dotenv")
    sys.exit(1)

try:
    import google.generativeai as genai
except ImportError:
    print("google-generativeai パッケージをインストールしてください:")
    print("  pip install google-generativeai")
    sys.exit(1)


def encode_image(image_path: str) -> tuple[str, str]:
    """画像をbase64エンコードし、MIMEタイプを返す"""
    path = Path(image_path)
    suffix = path.suffix.lower()

    mime_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".heic": "image/heic",
        ".heif": "image/heif",
    }

    mime_type = mime_types.get(suffix, "image/jpeg")

    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    return image_data, mime_type


def analyze_appliance_image(image_path: str) -> dict:
    """
    家電の画像を解析し、メーカー名と型番を抽出する
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("環境変数 GEMINI_API_KEY が設定されていません")

    genai.configure(api_key=api_key)

    # Gemini 2.0 Flash を使用（画像対応、高速、無料枠あり）
    model = genai.GenerativeModel("gemini-2.0-flash-exp")

    # 画像を読み込み
    image_data, mime_type = encode_image(image_path)

    prompt = """この画像は家電製品または住宅設備の写真です。

## タスク
画像から以下の情報を抽出してください。

### 1. 型番ラベルが見える場合
型番・メーカー名を正確に読み取ってください。

### 2. 型番ラベルが見えない/読めない場合
【重要】型番を推測・予測しないでください。
代わりに以下を行ってください：
- メーカーをロゴや外観から特定
- 製品カテゴリを特定
- 型番ラベルの位置を具体的に案内（撮り直しガイド）

## 出力形式（JSON）

型番が読み取れた場合:
{
  "status": "success",
  "manufacturer": {"ja": "メーカー名", "en": "Manufacturer"},
  "model_number": "読み取った型番",
  "category": "製品カテゴリ",
  "confidence": "high"
}

型番が読み取れない場合:
{
  "status": "need_label_photo",
  "manufacturer": {"ja": "メーカー名", "en": "Manufacturer"},
  "model_number": null,
  "category": "製品カテゴリ",
  "confidence": "medium",
  "label_guide": {
    "locations": [
      {"position": "具体的な位置", "description": "詳細説明", "priority": 1},
      {"position": "別の候補位置", "description": "詳細説明", "priority": 2}
    ],
    "photo_tips": "撮影のコツ（明るさ、角度など）"
  }
}

JSON形式のみで回答してください。"""

    response = model.generate_content([
        {"mime_type": mime_type, "data": image_data},
        prompt
    ])

    # レスポンスをパース
    response_text = response.text.strip()

    # JSONブロックを抽出（```json ... ``` 形式の場合に対応）
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        json_lines = []
        in_json = False
        for line in lines:
            if line.startswith("```json"):
                in_json = True
                continue
            elif line.startswith("```"):
                in_json = False
                continue
            if in_json:
                json_lines.append(line)
        response_text = "\n".join(json_lines)

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        result = {
            "raw_response": response_text,
            "error": "JSON parse error"
        }

    return result


def main():
    if len(sys.argv) < 2:
        print("使用方法: python test_image_recognition.py <画像パス>")
        print("")
        print("例:")
        print("  python test_image_recognition.py ./test_images/aircon.jpg")
        sys.exit(1)

    image_path = sys.argv[1]

    if not os.path.exists(image_path):
        print(f"エラー: ファイルが見つかりません: {image_path}")
        sys.exit(1)

    print(f"画像を解析中: {image_path}")
    print("-" * 50)

    try:
        result = analyze_appliance_image(image_path)
        print(json.dumps(result, ensure_ascii=False, indent=2))

        # 検証結果のサマリー
        print("-" * 50)
        if "error" in result:
            print("❌ 解析失敗")
        elif result.get("status") == "success":
            print("✅ 型番を読み取りました")
            print(f"   メーカー: {result.get('manufacturer', {}).get('ja', '不明')}")
            print(f"   型番: {result.get('model_number', '不明')}")
        elif result.get("status") == "need_label_photo":
            print("📸 型番ラベルの撮影が必要です")
            print(f"   メーカー: {result.get('manufacturer', {}).get('ja', '不明')}")
            print(f"   カテゴリ: {result.get('category', '不明')}")
            label_guide = result.get("label_guide", {})
            locations = label_guide.get("locations", [])
            if locations:
                print("   ラベル位置の候補:")
                for loc in locations:
                    print(f"     {loc.get('priority', '-')}. {loc.get('position', '')}")
            if label_guide.get("photo_tips"):
                print(f"   撮影のコツ: {label_guide.get('photo_tips')}")
        else:
            # 旧形式との互換性
            if result.get("confidence") == "high":
                print("✅ 高確信度で情報を抽出できました")
            else:
                print("⚠️ 情報を抽出しました")

    except Exception as e:
        print(f"エラー: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
