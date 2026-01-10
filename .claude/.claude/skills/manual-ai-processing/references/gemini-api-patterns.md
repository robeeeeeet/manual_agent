# Gemini API パターン

> ⚠️ **本プロジェクトは `google-genai` パッケージを使用**（`google.generativeai` ではない）

## 使用モデル

| モデル | 用途 | 特徴 |
|-------|------|------|
| `gemini-2.0-flash-exp` | 画像認識 | 高速、HEIC対応、マルチモーダル |
| `gemini-2.5-flash` | PDF解析 | 長文対応、構造化出力 |

## 画像認識パターン

### 基本構造

```python
from google import genai
from google.genai import types
from pathlib import Path
import os

def analyze_image(image_path: str) -> dict:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    # MIMEタイプ判定
    mime_types = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".heic": "image/heic"
    }
    mime_type = mime_types.get(Path(image_path).suffix.lower(), "image/jpeg")

    # 画像読み込み
    with open(image_path, "rb") as f:
        image_data = f.read()

    response = client.models.generate_content(
        model="gemini-2.0-flash-exp",
        contents=[
            types.Part.from_bytes(data=image_data, mime_type=mime_type),
            prompt
        ]
    )
    return parse_json_response(response.text)
```

### 構造化出力プロンプト

```
この画像から以下を抽出してJSON形式で出力:
{
  "status": "success" | "need_label_photo",
  "manufacturer": {"ja": "日本語名", "en": "English"},
  "model_number": "型番" | null,
  "category": "製品カテゴリ",
  "confidence": "high" | "medium" | "low"
}

型番が読めない場合は label_guide も含める:
{
  "label_guide": {
    "locations": [{"position": "位置", "priority": 1}],
    "photo_tips": "撮影のコツ"
  }
}
```

## PDF処理パターン

### ファイルアップロード

```python
from google import genai
from google.genai import types

def upload_and_process_pdf(pdf_path: str):
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    # アップロード
    file = client.files.upload(
        file=str(pdf_path),
        config=types.UploadFileConfig(
            display_name=Path(pdf_path).stem,
            mime_type='application/pdf'
        )
    )

    # 処理完了待機（重要）
    while file.state.name == 'PROCESSING':
        time.sleep(2)
        file = client.files.get(name=file.name)

    if file.state.name == 'FAILED':
        raise Exception(f"処理失敗: {file.state.name}")

    return file
```

### PDF解析

```python
def extract_from_pdf(client, uploaded_file, prompt: str):
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[uploaded_file, prompt]
    )
    return parse_json_response(response.text)
```

## JSONレスポンス解析

```python
def parse_json_response(text: str) -> dict:
    text = text.strip()

    # ```json ... ``` 形式の抽出
    if "```json" in text:
        start = text.find("```json") + 7
        end = text.find("```", start)
        text = text[start:end].strip()
    elif "```" in text:
        start = text.find("```") + 3
        end = text.find("```", start)
        text = text[start:end].strip()

    return json.loads(text)
```

## エラー処理

```python
from google.api_core.exceptions import ResourceExhausted
from tenacity import retry, stop_after_attempt, wait_exponential
import json
import time

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=lambda e: isinstance(e, ResourceExhausted)
)
def analyze_with_retry(client, image_path: str) -> dict:
    """リトライ付きの画像解析"""
    return analyze_image(image_path)

# 使用例
try:
    result = analyze_with_retry(client, path)
except ResourceExhausted:
    # 全リトライ失敗
    result = {"error": "RATE_LIMIT", "message": "レート制限に達しました"}
except json.JSONDecodeError as e:
    # JSON解析失敗
    result = {"error": "PARSE_ERROR", "message": "AIの応答を解析できませんでした"}
```

## 環境設定

```bash
# .env
GEMINI_API_KEY=your_api_key_here
```

```python
from dotenv import load_dotenv
load_dotenv(project_root / ".env")
```
