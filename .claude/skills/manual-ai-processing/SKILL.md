---
name: manual-ai-processing
description: PDF/画像解析とメンテナンス項目抽出のAI処理パイプライン。"PDFを解析", "メンテナンス項目を抽出", "画像から型番を読み取り", "マニュアル処理", "Gemini APIで解析", "appliance recognition", "extract maintenance items"などで使用。LangChain/LangGraphとGemini APIを活用した文書処理を実装する際に参照。
---

# マニュアルAI処理パイプライン

家電・住宅設備の説明書を処理するAIパイプラインの実装ガイド。

## 前提条件

- [ ] Python 3.11+
- [ ] `uv` パッケージマネージャー
- [ ] 環境変数: `GEMINI_API_KEY`
- [ ] 依存パッケージ: `google-genai`, `pydantic`
- [ ] 依存Skill: `fastapi-backend-dev`

## 完了条件（DoD）

- [ ] 代表画像1件で型番認識が通る
- [ ] 代表PDF1件でメンテナンス項目抽出が通る
- [ ] JSONパース失敗時もエラーが構造化される
- [ ] 抽出結果がスキーマバリデーションを通過する

## セキュリティ必須チェック

- [ ] `GEMINI_API_KEY` はサーバー環境変数のみ（クライアントに露出しない）
- [ ] ユーザーアップロードファイルのサイズ・MIME検証を実装
- [ ] LLM応答に含まれる可能性のある悪意あるコードをエスケープ

## 採用SDK

**本プロジェクトは `google-genai` パッケージを使用**

```bash
uv add google-genai
```

> ⚠️ `google-generativeai` (google.generativeai) は使用しない

## 抽出パイプライン（必須3段階）

すべてのAI抽出処理は以下の3段階を必ず経由する：

```
1. Schema Validation  →  2. 正規化  →  3. 保存
   (Pydantic検証)         (frequency_days等)    (Supabase)
```

## コアAI機能

| 機能 | 技術 | 参照スクリプト |
|------|------|---------------|
| 画像認識 | Gemini 2.0 Flash | `tests/phase0/scripts/test_image_recognition.py` |
| PDF検索 | Custom Search API | `tests/phase0/scripts/test_custom_search_api.py` |
| メンテナンス抽出 | Gemini 2.5 Flash | `tests/phase0/scripts/test_maintenance_extraction.py` |

## クイックスタート

### 画像からメーカー/型番認識

```python
from google import genai
from google.genai import types
import base64
import os

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

with open(image_path, "rb") as f:
    image_data = base64.standard_b64encode(f.read()).decode("utf-8")

response = client.models.generate_content(
    model="gemini-2.0-flash-exp",
    contents=[
        types.Part.from_bytes(data=open(image_path, "rb").read(), mime_type="image/jpeg"),
        "この画像から家電のメーカー・型番を抽出。JSON: {manufacturer, model_number}"
    ]
)
```

### PDFからメンテナンス項目抽出

```python
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

# PDFアップロード（処理完了まで待機）
file = client.files.upload(file=str(pdf_path),
    config=types.UploadFileConfig(mime_type='application/pdf'))

while file.state.name == 'PROCESSING':
    time.sleep(2)
    file = client.files.get(name=file.name)

response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents=[file, extraction_prompt]
)
```

## データスキーマ

### メンテナンス項目

```python
class MaintenanceItem(BaseModel):
    item_name: str           # "フィルター清掃"
    description: str
    frequency: str           # "月1回", "年1回", "適宜"
    frequency_days: int | None  # 30, 365, None
    category: Literal["cleaning", "inspection", "replacement", "safety"]
    importance: Literal["high", "medium", "low"]
    page_reference: str | None
```

### 周期マッピング

| 表現 | frequency_days |
|------|---------------|
| 毎日 | 1 |
| 週1回 | 7 |
| 月1回 | 30 |
| 年1回 | 365 |
| 適宜/使用後 | None |

## 詳細リファレンス

- [Gemini APIパターン](references/gemini-api-patterns.md) - API使用パターン、エラー処理
- [LangChain PDF処理](references/langchain-pdf-processing.md) - チェーン構築、RAG統合
- [メンテナンス抽出スキーマ](references/maintenance-extraction-schema.md) - 出力スキーマ詳細

## 不確実性の扱い（標準ルール）

抽出できない場合の値を以下に統一：

| フィールド | 抽出不可時の値 |
|-----------|---------------|
| `frequency_days` | `null` |
| `source_page` | `null` |
| `confidence` | `"low"` |
| `description` | `""` (空文字列) |

```python
# 例: 正規化処理
def normalize_maintenance_item(raw: dict) -> MaintenanceItem:
    return MaintenanceItem(
        item_name=raw.get("item_name", "不明な項目"),
        description=raw.get("description", ""),
        frequency=raw.get("frequency", "適宜"),
        frequency_days=raw.get("frequency_days"),  # None許容
        category=raw.get("category", "inspection"),
        importance=raw.get("importance", "medium"),
        page_reference=raw.get("page_reference"),  # None許容
    )
```

## 注意事項

- **APIキー**: `.env` に `GEMINI_API_KEY` を設定
- **レート制限**: Gemini無料枠は60 QPM
- **PDFサイズ**: 50MB以下推奨
- **HEIC対応**: Gemini 2.0 FlashはHEIC形式に対応
