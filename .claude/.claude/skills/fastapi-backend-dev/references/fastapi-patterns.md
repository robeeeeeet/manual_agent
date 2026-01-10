# FastAPI パターン

## BFF→FastAPI認証

**MVP**: 固定キーによる認証（将来JWT移行予定）

```python
# app/api/deps.py
from fastapi import Header, HTTPException, Depends
from app.config import settings

async def verify_backend_key(x_backend_key: str = Header(..., alias="X-Backend-Key")):
    """BFFからのリクエストを検証"""
    if x_backend_key != settings.BACKEND_API_KEY:
        raise HTTPException(
            status_code=401,
            detail={"error": "INVALID_KEY", "message": "Invalid backend key"}
        )
    return True

async def get_user_id(x_user_id: str = Header(..., alias="X-User-ID")):
    """BFFから転送されたユーザーIDを取得"""
    return x_user_id

# ルーターで使用
@router.post("/analyze", dependencies=[Depends(verify_backend_key)])
async def analyze_image(user_id: str = Depends(get_user_id)):
    ...
```

## エンドポイント設計

### RESTful設計

```python
from fastapi import APIRouter, HTTPException, status
from typing import List

router = APIRouter(prefix="/appliances", tags=["appliances"])

@router.get("/", response_model=List[Appliance])
async def list_appliances(skip: int = 0, limit: int = 20):
    """家電一覧を取得"""
    return await get_appliances(skip=skip, limit=limit)

@router.get("/{appliance_id}", response_model=Appliance)
async def get_appliance(appliance_id: str):
    """家電詳細を取得"""
    appliance = await find_appliance(appliance_id)
    if not appliance:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "家電が見つかりません")
    return appliance

@router.post("/", response_model=Appliance, status_code=status.HTTP_201_CREATED)
async def create_appliance(data: ApplianceCreate):
    """家電を登録"""
    return await insert_appliance(data)

@router.put("/{appliance_id}", response_model=Appliance)
async def update_appliance(appliance_id: str, data: ApplianceUpdate):
    """家電を更新"""
    return await modify_appliance(appliance_id, data)

@router.delete("/{appliance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_appliance(appliance_id: str):
    """家電を削除"""
    await remove_appliance(appliance_id)
```

### ファイルアップロード

```python
from fastapi import UploadFile, File, Form

@router.post("/upload")
async def upload_manual(
    file: UploadFile = File(...),
    appliance_id: str = Form(...),
):
    """マニュアルPDFをアップロード"""
    if file.content_type != "application/pdf":
        raise HTTPException(400, "PDFファイルのみ対応")

    if file.size > 50 * 1024 * 1024:  # 50MB
        raise HTTPException(400, "ファイルサイズは50MB以下")

    content = await file.read()
    # 保存処理...
    return {"filename": file.filename, "size": len(content)}
```

## エラー処理

### 統一エラーレスポンス形式

**プロジェクト全体で統一：**

```python
# app/schemas/error.py
from pydantic import BaseModel
from typing import Optional, Any

class ErrorResponse(BaseModel):
    error: str           # エラーコード（例: "NOT_FOUND", "VALIDATION_ERROR"）
    message: str         # ユーザー向けメッセージ
    details: Optional[Any] = None  # 開発者向け詳細情報
```

### カスタム例外

```python
# app/exceptions.py
class AppException(Exception):
    def __init__(self, message: str, code: str, details: Any = None):
        self.message = message
        self.code = code
        self.details = details

class NotFoundError(AppException):
    def __init__(self, resource: str):
        super().__init__(f"{resource}が見つかりません", "NOT_FOUND")

class ValidationError(AppException):
    def __init__(self, message: str, details: Any = None):
        super().__init__(message, "VALIDATION_ERROR", details)

class LLMError(AppException):
    def __init__(self, message: str = "AI処理に失敗しました"):
        super().__init__(message, "LLM_ERROR")
```

### 例外ハンドラ

```python
# app/main.py
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=400,
        content={
            "error": exc.code,
            "message": exc.message,
            "details": exc.details
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    # 本番環境では詳細を隠す
    return JSONResponse(
        status_code=500,
        content={
            "error": "INTERNAL_ERROR",
            "message": "内部エラーが発生しました"
        }
    )
```

## バリデーション

### Pydanticバリデータ

```python
from pydantic import BaseModel, validator, Field

class ApplianceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    maker: str = Field(..., min_length=1)
    model_number: str = Field(..., pattern=r"^[A-Za-z0-9\-]+$")
    category: str

    @validator("category")
    def validate_category(cls, v):
        allowed = ["aircon", "kitchen", "laundry", "bathroom", "other"]
        if v not in allowed:
            raise ValueError(f"カテゴリは {allowed} のいずれか")
        return v
```

### カスタムバリデーション

```python
from fastapi import Depends

async def validate_file_size(file: UploadFile = File(...)):
    if file.size > 10 * 1024 * 1024:
        raise HTTPException(400, "10MB以下のファイルを指定")
    return file

@router.post("/upload")
async def upload(file: UploadFile = Depends(validate_file_size)):
    ...
```

## 非同期処理

### バックグラウンドタスク

```python
from fastapi import BackgroundTasks

def process_pdf(pdf_path: str, appliance_id: str):
    """バックグラウンドでPDF処理"""
    # 重い処理...
    pass

@router.post("/process")
async def start_processing(
    data: ProcessRequest,
    background_tasks: BackgroundTasks
):
    background_tasks.add_task(process_pdf, data.pdf_path, data.appliance_id)
    return {"status": "processing"}
```

### 非同期HTTP

```python
import httpx

async def fetch_manual_pdf(url: str) -> bytes:
    async with httpx.AsyncClient() as client:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
        return response.content
```

## 設定管理

```python
# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GEMINI_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_KEY: str
    BACKEND_URL: str = "http://localhost:8000"

    class Config:
        env_file = ".env"

settings = Settings()
```

## ミドルウェア

```python
import time
from fastapi import Request

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response
```
