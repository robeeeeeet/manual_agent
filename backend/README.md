# Manual Agent Backend

FastAPI + Gemini AI バックエンド for 説明書管理アプリ

## セットアップ

### 1. 依存関係のインストール

```bash
cd backend
uv sync
```

### 2. 環境変数の設定

プロジェクトルートの `.env` ファイルに以下を設定：

```bash
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CSE_API_KEY=your_google_cse_api_key
GOOGLE_CSE_ID=your_google_cse_id
```

### 3. サーバー起動

**注意**: `uvicorn` コマンドは許可されていないため、手動で実行する必要があります。

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

サーバーが起動したら以下のURLにアクセス：

- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API エンドポイント

### ヘルスチェック

```bash
GET /health
```

### 画像認識

```bash
POST /api/v1/appliances/recognize
Content-Type: multipart/form-data

Parameters:
- image: 画像ファイル（JPEG, PNG, WebP, HEIC）

Response:
{
  "status": "success" | "need_label_photo",
  "manufacturer": {"ja": "日立", "en": "Hitachi"},
  "model_number": "MRO-S7D",
  "category": "オーブンレンジ",
  "confidence": "high" | "medium" | "low",
  "label_guide": { ... }  // status が need_label_photo の場合
}
```

### マニュアル検索

```bash
POST /api/v1/manuals/search
Content-Type: application/json

Body:
{
  "manufacturer": "日立",
  "model_number": "MRO-S7D",
  "official_domains": ["kadenfan.hitachi.co.jp", "hitachi.co.jp"]  // optional
}

Response:
{
  "success": true,
  "pdf_url": "https://...",
  "method": "direct_search"
}
```

### メンテナンス項目抽出

#### URL指定

```bash
POST /api/v1/manuals/extract-maintenance?pdf_url=https://example.com/manual.pdf
Content-Type: application/json

Optional Query Parameters:
- pdf_url: PDF URL
- manufacturer: メーカー名
- model_number: 型番
- category: カテゴリ

Response:
{
  "product": {
    "manufacturer": "日立",
    "model_number": "MRO-S7D",
    "category": "オーブンレンジ"
  },
  "maintenance_items": [
    {
      "item_name": "庫内の清掃",
      "description": "...",
      "frequency": "使用後毎回",
      "frequency_days": 1,
      "category": "cleaning",
      "importance": "high",
      "page_reference": "p.12"
    }
  ],
  "notes": "..."
}
```

#### ファイルアップロード

```bash
POST /api/v1/manuals/extract-maintenance
Content-Type: multipart/form-data

Parameters:
- pdf_file: PDFファイル
- manufacturer: メーカー名（optional）
- model_number: 型番（optional）
- category: カテゴリ（optional）
```

## ディレクトリ構造

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI アプリケーション
│   ├── config.py            # 設定（環境変数）
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── health.py         # ヘルスチェック
│   │       ├── appliances.py     # 画像認識API
│   │       └── manuals.py        # マニュアル検索・抽出API
│   ├── services/
│   │   ├── __init__.py
│   │   ├── image_recognition.py       # 画像認識サービス
│   │   ├── manual_search.py           # PDF検索サービス
│   │   └── maintenance_extraction.py  # メンテナンス抽出サービス
│   └── schemas/
│       ├── __init__.py
│       └── appliance.py     # Pydanticスキーマ
├── pyproject.toml
└── README.md
```

## 技術スタック

- **FastAPI**: Webフレームワーク
- **Pydantic**: データバリデーション
- **google-genai**: Gemini API クライアント
- **BeautifulSoup4**: HTML解析
- **Requests**: HTTP クライアント

## Phase 0 からの移植

このバックエンドは以下の Phase 0 検証スクリプトのロジックを移植しています：

1. **画像認識** (`tests/phase0/scripts/test_image_recognition.py`)
   - Gemini 2.0 Flash を使用
   - 型番ラベル読み取り + 撮影ガイド

2. **PDF検索** (`tests/phase0/scripts/test_custom_search_api.py`)
   - Google Custom Search API
   - 2段階戦略: 直接PDF検索 → マニュアルページ検索

3. **メンテナンス抽出** (`tests/phase0/scripts/test_maintenance_extraction.py`)
   - Gemini 2.5 Flash を使用
   - PDFアップロード + 構造化抽出

## 開発

### コードフォーマット

```bash
# TODO: ruff または black を追加
```

### テスト

```bash
# TODO: pytest テストを追加
uv run pytest
```

## 注意事項

### 実行権限

このプロジェクトでは一部のコマンドのみが自動許可されています：

- ✅ 自動許可: `uv add`, `uv run python`, `ls`
- ❌ 要許可: `uvicorn`, `pytest`, `npm`, etc.

許可が必要なコマンドを実行する場合は、手動で実行してください。

### 環境変数

`.env` ファイルはプロジェクトルート (`/home/robert/applications/manual_agent/.env`) に配置してください。
`app/config.py` が自動的に読み込みます。

### CORS設定

デフォルトで `http://localhost:3000` からのアクセスを許可しています。
本番環境では `config.py` の `cors_origins` を適切に設定してください。
