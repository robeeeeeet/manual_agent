# 認証パターン

## Supabase Auth設定

### メール認証有効化

Supabase Dashboard > Authentication > Providers > Email

- Enable Email: ON
- Confirm email: ON（確認メール送信）
- Secure email change: ON

### リダイレクトURL設定

Supabase Dashboard > Authentication > URL Configuration

```
Site URL: http://localhost:3000
Redirect URLs:
  - http://localhost:3000/auth/callback
  - https://your-domain.com/auth/callback
```

## サーバーサイド認証

### Middleware

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // 保護されたルート
  const protectedPaths = ['/appliances', '/settings']
  const isProtected = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 認証済みユーザーがログインページにアクセス
  if (session && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/appliances', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### Server Actions

```typescript
// app/actions/auth.ts
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function signOut() {
  const cookieStore = cookies()
  const supabase = createServerClient(/* ... */)

  await supabase.auth.signOut()
  redirect('/login')
}
```

## Python (FastAPI) 認証

### JWT検証

```python
# app/api/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    token = credentials.credentials

    try:
        # Supabase JWT検証
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED)

        return {"id": user_id, "email": payload.get("email")}

    except JWTError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

# 使用
@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user
```

### Service Role（管理者操作）

```python
from supabase import create_client

# Service Role Keyでクライアント作成（RLSバイパス）
admin_supabase = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY
)

# 管理者操作（例: 全ユーザーの通知送信）
all_users = admin_supabase.table("users").select("*").execute()
```

## ユーザー作成フック

```sql
-- auth.usersに新規ユーザー作成時、usersテーブルにも追加
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```
