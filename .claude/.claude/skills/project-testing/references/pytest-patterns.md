# pytest パターン

## 基本構成

```python
# tests/conftest.py
import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.main import app
from app.db import Base, get_db

# テスト用DB
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

@pytest.fixture(scope="session")
def event_loop():
    """セッション全体で1つのイベントループを使用"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(engine) as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

## 非同期テスト

```python
import pytest

@pytest.mark.asyncio
async def test_async_function():
    result = await some_async_function()
    assert result == expected

# 複数の非同期呼び出し
@pytest.mark.asyncio
async def test_multiple_async():
    results = await asyncio.gather(
        async_func1(),
        async_func2(),
    )
    assert all(r.success for r in results)
```

## モック

### 基本モック

```python
from unittest.mock import patch, MagicMock, AsyncMock

def test_with_mock():
    with patch('app.services.external_api.call') as mock_call:
        mock_call.return_value = {"status": "ok"}
        result = my_function()
        mock_call.assert_called_once()

# 非同期モック
@pytest.mark.asyncio
async def test_async_mock():
    with patch('app.services.api.fetch', new_callable=AsyncMock) as mock:
        mock.return_value = {"data": "test"}
        result = await fetch_data()
        assert result["data"] == "test"
```

### Gemini APIモック

```python
@pytest.fixture
def mock_gemini():
    with patch('google.generativeai.GenerativeModel') as mock:
        instance = MagicMock()
        instance.generate_content.return_value = MagicMock(
            text='{"manufacturer": "テスト", "model_number": "T-001"}'
        )
        mock.return_value = instance
        yield mock

def test_image_recognition(mock_gemini):
    service = ImageRecognitionService()
    result = service.analyze(b"image_data")
    assert result["manufacturer"] == "テスト"
```

### Supabaseモック

```python
@pytest.fixture
def mock_supabase():
    with patch('supabase.create_client') as mock:
        client = MagicMock()
        client.table.return_value.select.return_value.execute.return_value = MagicMock(
            data=[{"id": "1", "name": "Test"}]
        )
        mock.return_value = client
        yield client

@pytest.mark.asyncio
async def test_get_appliances(mock_supabase):
    result = await get_appliances()
    assert len(result) == 1
```

## パラメータ化テスト

```python
import pytest

@pytest.mark.parametrize("frequency,expected_days", [
    ("毎日", 1),
    ("週1回", 7),
    ("月1回", 30),
    ("年1回", 365),
    ("適宜", None),
])
def test_parse_frequency(frequency, expected_days):
    result = parse_frequency(frequency)
    assert result == expected_days

@pytest.mark.parametrize("input_data,expected_error", [
    ({"name": ""}, "名前は必須です"),
    ({"name": "a" * 101}, "名前は100文字以内"),
])
def test_validation_errors(input_data, expected_error):
    with pytest.raises(ValidationError) as exc:
        validate_appliance(input_data)
    assert expected_error in str(exc.value)
```

## ファイルアップロードテスト

```python
import io

@pytest.mark.asyncio
async def test_upload_image(client):
    # テスト画像作成
    image_content = b"fake image content"
    files = {"image": ("test.jpg", io.BytesIO(image_content), "image/jpeg")}

    response = await client.post("/analyze/image", files=files)
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_upload_pdf(client):
    pdf_content = b"%PDF-1.4 fake pdf content"
    files = {"file": ("manual.pdf", io.BytesIO(pdf_content), "application/pdf")}

    response = await client.post("/manuals/upload", files=files)
    assert response.status_code == 201
```

## 例外テスト

```python
import pytest
from app.exceptions import NotFoundError, ValidationError

def test_raises_not_found():
    with pytest.raises(NotFoundError) as exc_info:
        get_appliance("nonexistent")
    assert exc_info.value.code == "NOT_FOUND"

def test_raises_validation_error():
    with pytest.raises(ValidationError, match="名前は必須"):
        validate_appliance({})
```

## カバレッジ

```bash
# 実行
uv run pytest --cov=app --cov-report=html

# 特定ディレクトリ
uv run pytest tests/test_api --cov=app/api

# 最小カバレッジを要求
uv run pytest --cov=app --cov-fail-under=80
```

```toml
# pyproject.toml
[tool.coverage.run]
source = ["app"]
omit = ["app/tests/*", "app/__init__.py"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
]
```
