# トラブルシューティング

## よくある問題

### 1. CORS エラー

**症状**: `Access-Control-Allow-Origin` エラー

**原因**:
- FastAPIのCORS設定が不正
- Next.jsからのオリジンが許可されていない

**解決策**:

```python
# FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # 開発環境
        os.getenv("FRONTEND_URL"),  # 本番環境
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**確認**:
```bash
curl -I -X OPTIONS http://localhost:8000/api/endpoint \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"
```

### 2. 認証エラー

**症状**: 401 Unauthorized

**チェックポイント**:

1. Supabaseセッションの有効性
```typescript
const { data: { session }, error } = await supabase.auth.getSession()
console.log('Session:', session, 'Error:', error)
```

2. BFFでのセッション確認
```typescript
const { data: { user }, error } = await supabase.auth.getUser()
if (error) console.log('Auth error:', error)
```

3. FastAPIでのトークン検証
```python
@app.middleware("http")
async def log_auth(request: Request, call_next):
    auth = request.headers.get("Authorization")
    print(f"Auth header: {auth}")
    return await call_next(request)
```

### 3. ファイルアップロード失敗

**症状**: ファイルが届かない、サイズエラー

**Next.js設定**:
```javascript
// next.config.js
module.exports = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
}
```

**FastAPI設定**:
```python
from fastapi import UploadFile

@router.post("/upload")
async def upload(file: UploadFile):
    # ファイルサイズ確認
    contents = await file.read()
    print(f"Received: {len(contents)} bytes")
```

**FormData確認**:
```typescript
const formData = new FormData()
formData.append('file', file)

// デバッグ
for (const [key, value] of formData.entries()) {
  console.log(key, value)
}
```

### 4. タイムアウト

**症状**: 504 Gateway Timeout

**Next.js API Route**:
```typescript
// Vercel: 最大60秒
export const maxDuration = 60

export async function POST(request: NextRequest) {
  // AbortController使用
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55000)

  try {
    const response = await fetch(BACKEND_URL, {
      signal: controller.signal,
    })
    return NextResponse.json(await response.json())
  } finally {
    clearTimeout(timeout)
  }
}
```

**FastAPI**:
```python
from fastapi import BackgroundTasks

@router.post("/long-task")
async def long_task(background_tasks: BackgroundTasks):
    # 長時間処理はバックグラウンドで
    background_tasks.add_task(process_heavy_task)
    return {"status": "processing", "task_id": task_id}
```

### 5. 環境変数が読めない

**症状**: `undefined` や接続エラー

**チェックリスト**:

1. `.env.local`（Next.js）
```bash
# クライアントで使う場合は NEXT_PUBLIC_ プレフィックス
NEXT_PUBLIC_SUPABASE_URL=...

# サーバーのみ
BACKEND_URL=...
```

2. `.env`（FastAPI）
```bash
GEMINI_API_KEY=...
SUPABASE_URL=...
```

3. 読み込み確認
```typescript
// Next.js
console.log('BACKEND_URL:', process.env.BACKEND_URL)
```

```python
# FastAPI
from dotenv import load_dotenv
load_dotenv()
print(f"API_KEY: {os.getenv('GEMINI_API_KEY')[:10]}...")
```

### 6. JSON解析エラー

**症状**: `SyntaxError: Unexpected token`

**原因**: レスポンスがJSONでない

**デバッグ**:
```typescript
const response = await fetch(url)
const text = await response.text()
console.log('Raw response:', text)

try {
  return JSON.parse(text)
} catch (e) {
  console.error('Parse error:', e)
  throw new Error(`Invalid JSON: ${text.slice(0, 100)}`)
}
```

## デバッグツール

### リクエスト/レスポンスログ

```typescript
// lib/fetch-with-log.ts
export async function fetchWithLog(url: string, options: RequestInit) {
  console.log(`>>> ${options.method || 'GET'} ${url}`)
  console.log('Headers:', options.headers)

  const start = Date.now()
  const response = await fetch(url, options)
  const duration = Date.now() - start

  console.log(`<<< ${response.status} (${duration}ms)`)

  return response
}
```

### FastAPIミドルウェア

```python
import time
from fastapi import Request

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()

    print(f">>> {request.method} {request.url.path}")
    print(f"Headers: {dict(request.headers)}")

    response = await call_next(request)

    duration = time.time() - start
    print(f"<<< {response.status_code} ({duration:.2f}s)")

    return response
```

### ヘルスチェック

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    frontend: true,
    backend: false,
    database: false,
  }

  try {
    const backendRes = await fetch(`${BACKEND_URL}/health`)
    checks.backend = backendRes.ok
  } catch (e) {
    console.error('Backend health check failed:', e)
  }

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('users').select('id').limit(1)
    checks.database = !error
  } catch (e) {
    console.error('Database health check failed:', e)
  }

  const healthy = Object.values(checks).every(Boolean)

  return NextResponse.json(checks, {
    status: healthy ? 200 : 503,
  })
}
```

```python
# FastAPI
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "gemini": check_gemini_api(),
        "supabase": check_supabase(),
    }
```
