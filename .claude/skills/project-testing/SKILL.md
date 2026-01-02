---
name: project-testing
description: フロントエンド/バックエンドテスト実装。"テスト作成", "pytest", "Vitest", "Jest", "コンポーネントテスト", "APIテスト", "E2Eテスト", "Playwright", "単体テスト", "統合テスト"などで使用。Next.js/FastAPIのテストパターンを参照。
---

# プロジェクトテスト

Next.js（Vitest）とFastAPI（pytest）のテスト実装ガイド。

## 前提条件

- [ ] Python 3.11+ / Node.js 18+
- [ ] `uv` / `npm`
- [ ] 依存パッケージ: `pytest`, `vitest`, `playwright`

## 完了条件（DoD）

- [ ] 代表APIのpytestが通る
- [ ] 代表UIのvitestが通る
- [ ] 最低1本のE2Eテストが通る
- [ ] カバレッジレポートが生成される

## テスト戦略（最小指針）

| 環境 | 実行テスト | トリガー |
|------|-----------|---------|
| PR | unit + lint | プルリクエスト作成時 |
| main | unit + integration + e2e | mainマージ時 |
| リリース前 | 全テスト + 手動確認 | リリースタグ作成時 |

### テストピラミッド

```
        /\
       /E2E\        ← 少数・重要フローのみ
      /──────\
     /Integration\   ← API・DB連携
    /──────────────\
   /    Unit Tests   \ ← 多数・高速
  ──────────────────────
```

## テスト構成

```
frontend/
├── __tests__/
│   ├── components/      # コンポーネントテスト
│   ├── hooks/           # カスタムフックテスト
│   └── e2e/             # E2Eテスト（Playwright）
├── vitest.config.ts
└── playwright.config.ts

backend/
├── tests/
│   ├── conftest.py      # フィクスチャ
│   ├── test_api/        # APIテスト
│   └── test_services/   # サービステスト
└── pyproject.toml
```

## バックエンド（pytest）

### セットアップ

```bash
uv add --dev pytest pytest-asyncio httpx
```

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

### テンプレート2系統

| 系統 | 用途 | 特徴 |
|------|------|------|
| **DBなし** | 純サービス/外部モック中心 | 高速、CI向け |
| **DBあり** | 統合テスト/fixture | Supabase接続、本格検証 |

#### DBなしテスト（推奨スタート）

```python
# tests/unit/test_image_recognition.py
import pytest
from unittest.mock import patch, MagicMock

@pytest.mark.asyncio
async def test_analyze_image_success():
    """外部API（Gemini）をモック"""
    with patch('app.services.image_recognition.genai.Client') as mock_client:
        mock_client.return_value.models.generate_content.return_value = MagicMock(
            text='{"manufacturer": "Test", "model_number": "T-001"}'
        )
        from app.services.image_recognition import ImageRecognitionService
        service = ImageRecognitionService()
        result = await service.analyze(b"fake_image")
        assert result["manufacturer"] == "Test"
```

#### DBありテスト（統合テスト）

```python
# tests/integration/test_appliances_api.py
import pytest
from httpx import AsyncClient

@pytest.fixture
async def test_user(supabase_client):
    """テスト用ユーザー作成"""
    # Supabase Authでテストユーザー作成
    user = await supabase_client.auth.sign_up(...)
    yield user
    # クリーンアップ
    await supabase_client.auth.admin.delete_user(user.id)

@pytest.mark.asyncio
async def test_create_appliance_with_db(client, test_user):
    """実際のDB接続でテスト"""
    response = await client.post("/appliances", json={...})
    assert response.status_code == 201
```

### フィクスチャ

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.fixture
def sample_appliance():
    return {
        "name": "テストエアコン",
        "maker": "テストメーカー",
        "model_number": "TEST-001",
        "category": "aircon"
    }
```

### APIテスト

```python
# tests/test_api/test_appliances.py
import pytest

@pytest.mark.asyncio
async def test_create_appliance(client, sample_appliance):
    response = await client.post("/appliances", json=sample_appliance)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == sample_appliance["name"]

@pytest.mark.asyncio
async def test_get_appliance_not_found(client):
    response = await client.get("/appliances/nonexistent-id")
    assert response.status_code == 404
```

### サービステスト

```python
# tests/test_services/test_image_recognition.py
import pytest
from unittest.mock import patch, MagicMock
from app.services.image_recognition import ImageRecognitionService

@pytest.fixture
def service():
    return ImageRecognitionService()

@pytest.mark.asyncio
async def test_analyze_image(service):
    with patch.object(service, 'model') as mock_model:
        mock_model.generate_content.return_value = MagicMock(
            text='{"manufacturer": "Test", "model_number": "T-001"}'
        )
        result = await service.analyze(b"fake_image_data")
        assert result["manufacturer"] == "Test"
```

## フロントエンド（Vitest）

### セットアップ

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

### コンポーネントテスト

```tsx
// __tests__/components/ApplianceCard.test.tsx
import { render, screen } from '@testing-library/react'
import { ApplianceCard } from '@/components/ApplianceCard'

describe('ApplianceCard', () => {
  const appliance = {
    id: '1',
    name: 'テストエアコン',
    nextDueAt: new Date('2024-12-01'),
    task: 'フィルター清掃'
  }

  it('家電名を表示する', () => {
    render(<ApplianceCard appliance={appliance} />)
    expect(screen.getByText('テストエアコン')).toBeInTheDocument()
  })

  it('期限超過時に赤くなる', () => {
    const overdue = { ...appliance, nextDueAt: new Date('2024-01-01') }
    render(<ApplianceCard appliance={overdue} />)
    expect(screen.getByRole('article')).toHaveClass('bg-red-50')
  })
})
```

## E2E（Playwright）

### セットアップ

```bash
npm install -D @playwright/test
npx playwright install
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### E2Eテスト

```typescript
// __tests__/e2e/appliance-registration.spec.ts
import { test, expect } from '@playwright/test'

test('家電登録フロー', async ({ page }) => {
  await page.goto('/appliances/new')

  // Step 1: 画像アップロード
  await page.setInputFiles('input[type="file"]', 'test-image.jpg')
  await page.click('button:has-text("解析")')

  // Step 2: 確認
  await expect(page.getByText('メーカー')).toBeVisible()
  await page.click('button:has-text("次へ")')

  // Step 3: 登録完了
  await page.click('button:has-text("登録")')
  await expect(page).toHaveURL(/\/appliances\//)
})
```

## 詳細リファレンス

- [pytestパターン](references/pytest-patterns.md) - モック、非同期テスト
- [Vitestパターン](references/vitest-patterns.md) - コンポーネント、フック

## コマンド

```bash
# バックエンド
cd backend && uv run pytest
uv run pytest -v --cov=app  # カバレッジ

# フロントエンド
cd frontend && npm test
npm run test:coverage

# E2E
npx playwright test
npx playwright test --ui  # UIモード
```
