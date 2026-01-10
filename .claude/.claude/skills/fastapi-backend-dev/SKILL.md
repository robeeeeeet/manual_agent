---
name: fastapi-backend-dev
description: FastAPI + LangChain/LangGraph AIバックエンド開発。"APIエンドポイント作成", "LangChainチェーン", "LangGraphエージェント", "Pydanticモデル", "サービス実装", "FastAPIルーター", "dependency injection"などで使用。Python AIバックエンドの実装パターンを参照。
---

# FastAPI バックエンド開発

FastAPI + LangChain/LangGraph + Pydanticを使用したAIバックエンド開発ガイド。

## 前提条件

- [ ] Python 3.11+
- [ ] `uv` パッケージマネージャー
- [ ] 環境変数: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`
- [ ] 依存Skill: `supabase-integration`, `hybrid-architecture`

## 完了条件（DoD）

- [ ] `/health` エンドポイントが200を返す
- [ ] 画像解析APIが1ケース正常動作する
- [ ] LLM失敗時もエラーフォーマットが統一されている
- [ ] BFF→FastAPI認証（`X-Backend-Key`）が実装されている

## セキュリティ必須チェック

- [ ] `BACKEND_API_KEY` はサーバー環境変数のみ（クライアントに露出しない）
- [ ] ファイルアップロードのサイズ・MIMEタイプ検証を実装
- [ ] LLM応答のJSONパース失敗時にユーザー入力を露出しない

## プロジェクト構造

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPIアプリ
│   ├── config.py            # 設定
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py          # 依存性注入
│   │   └── routes/
│   │       ├── analyze.py   # 画像解析
│   │       ├── manuals.py   # マニュアル処理
│   │       └── maintenance.py
│   ├── services/
│   │   ├── image_recognition.py
│   │   ├── pdf_search.py
│   │   └── maintenance_extraction.py
│   ├── models/
│   │   ├── appliance.py
│   │   └── maintenance.py
│   └── agents/
│       └── manual_agent.py  # LangGraph
├── pyproject.toml
└── tests/
```

## エンドポイント実装

### 基本ルーター

```python
# app/api/routes/analyze.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.image_recognition import ImageRecognitionService
from app.models.appliance import RecognitionResult

router = APIRouter(prefix="/analyze", tags=["analyze"])

@router.post("/image", response_model=RecognitionResult)
async def analyze_image(image: UploadFile = File(...)):
    """画像からメーカー・型番を認識"""
    if not image.content_type.startswith("image/"):
        raise HTTPException(400, "画像ファイルを指定してください")

    service = ImageRecognitionService()
    result = await service.analyze(await image.read())
    return result
```

### アプリ登録

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import analyze, manuals, maintenance

app = FastAPI(title="Manual Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(manuals.router)
app.include_router(maintenance.router)
```

## Pydantic モデル

```python
# app/models/appliance.py
from pydantic import BaseModel, Field
from typing import Literal, Optional

class Manufacturer(BaseModel):
    ja: str
    en: str

class RecognitionResult(BaseModel):
    status: Literal["success", "need_label_photo"]
    manufacturer: Manufacturer
    model_number: Optional[str] = None
    category: str
    confidence: Literal["high", "medium", "low"]

class MaintenanceItem(BaseModel):
    item_name: str
    description: str
    frequency: str
    frequency_days: Optional[int] = None
    category: Literal["cleaning", "inspection", "replacement", "safety"]
    importance: Literal["high", "medium", "low"]
```

## サービス層

**本プロジェクトは `google-genai` パッケージを使用**（`google.generativeai` ではない）

```python
# app/services/image_recognition.py
from google import genai
from google.genai import types
from app.config import settings
from app.models.appliance import RecognitionResult

class ImageRecognitionService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def analyze(self, image_data: bytes) -> RecognitionResult:
        # 実装...
        pass
```

## LLM呼び出しの標準ガード

すべてのLLM呼び出しに以下のガードを適用：

```python
import asyncio
import json
import re
from tenacity import retry, stop_after_attempt, wait_exponential
from google.api_core.exceptions import ResourceExhausted

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=lambda e: isinstance(e, ResourceExhausted)
)
async def call_llm_with_guard(client, prompt: str, timeout: int = 60):
    """LLM呼び出しの標準ガード"""
    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.0-flash-exp",
                contents=prompt
            ),
            timeout=timeout
        )
        return extract_json(response.text)
    except asyncio.TimeoutError:
        raise HTTPException(504, {"error": "AI処理がタイムアウトしました", "code": "LLM_TIMEOUT"})
    except ResourceExhausted:
        raise  # リトライ対象
    except Exception as e:
        raise HTTPException(500, {"error": "AI処理に失敗しました", "code": "LLM_ERROR"})

def extract_json(text: str) -> dict:
    """LLM応答からJSONを抽出"""
    # コードブロック内のJSON
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if match:
        return json.loads(match.group(1))
    # 直接JSON
    return json.loads(text)
```

## BFF→FastAPI認証

**MVP**: 固定キーによる認証（将来JWT移行予定）

```python
# app/api/deps.py
from fastapi import Header, HTTPException, Depends
from app.config import settings

async def verify_backend_key(x_backend_key: str = Header(...)):
    """BFFからのリクエストを検証"""
    if x_backend_key != settings.BACKEND_API_KEY:
        raise HTTPException(401, "Invalid backend key")
    return True

# ルーターで使用
@router.post("/analyze", dependencies=[Depends(verify_backend_key)])
async def analyze_image(...):
    ...
```

## 依存性注入

```python
# app/api/deps.py
from functools import lru_cache
from app.config import Settings
from supabase import create_client, Client

@lru_cache()
def get_settings() -> Settings:
    return Settings()

def get_supabase() -> Client:
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
```

## 詳細リファレンス

- [FastAPIパターン](references/fastapi-patterns.md) - エンドポイント、エラー処理
- [LangChain統合](references/langchain-integration.md) - チェーン、プロンプト
- [LangGraphエージェント](references/langgraph-agent-patterns.md) - 状態管理、フロー

## コマンド

```bash
# 開発サーバー
cd backend && uv run uvicorn app.main:app --reload

# テスト
uv run pytest

# 依存関係追加
uv add fastapi

# Gemini API直接利用（本プロジェクトはこちら）
uv add google-genai

# LangChain経由で利用する場合
uv add langchain-google-genai
```
