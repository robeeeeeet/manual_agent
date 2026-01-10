# App Router パターン

## ルーティング

### 基本ルート

```
app/
├── page.tsx           → /
├── about/page.tsx     → /about
├── blog/
│   ├── page.tsx       → /blog
│   └── [slug]/page.tsx → /blog/:slug
```

### 動的ルート

```tsx
// app/appliances/[id]/page.tsx
interface Props {
  params: { id: string }
}

export default async function AppliancePage({ params }: Props) {
  const appliance = await getAppliance(params.id)
  return <ApplianceDetail appliance={appliance} />
}

// 静的生成
export async function generateStaticParams() {
  const appliances = await getAppliances()
  return appliances.map(a => ({ id: a.id }))
}
```

### ルートグループ

```
app/
├── (auth)/           # URLに影響しない
│   ├── layout.tsx    # 認証用レイアウト
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx    # ダッシュボード用レイアウト
│   └── settings/page.tsx
```

## レイアウト

### ルートレイアウト

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: '説明書管理アプリ',
  description: '家電のメンテナンスをリマインド',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
```

### ネストレイアウト

```tsx
// app/(dashboard)/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 p-6">{children}</div>
    </div>
  )
}
```

## Loading & Error

### Loading UI

```tsx
// app/appliances/loading.tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )
}
```

### Error UI

```tsx
// app/appliances/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="text-center p-8">
      <h2 className="text-xl font-bold text-red-600">エラーが発生しました</h2>
      <p className="text-gray-600 mt-2">{error.message}</p>
      <button onClick={reset} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">
        再試行
      </button>
    </div>
  )
}
```

### Not Found

```tsx
// app/not-found.tsx
export default function NotFound() {
  return (
    <div className="text-center p-8">
      <h2 className="text-2xl font-bold">ページが見つかりません</h2>
      <Link href="/" className="text-blue-600 hover:underline mt-4 block">
        ホームに戻る
      </Link>
    </div>
  )
}
```

## データフェッチ

### Server Component

```tsx
async function getAppliances() {
  const res = await fetch(`${process.env.API_URL}/appliances`, {
    cache: 'no-store', // 常に最新
    // next: { revalidate: 60 }, // 60秒キャッシュ
  })
  return res.json()
}

export default async function Page() {
  const appliances = await getAppliances()
  return <ApplianceList appliances={appliances} />
}
```

### Server Actions

```tsx
// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createAppliance(formData: FormData) {
  const name = formData.get('name')
  // DB保存処理
  await db.appliances.create({ name })

  revalidatePath('/appliances')
}
```

```tsx
// 使用側
<form action={createAppliance}>
  <input name="name" />
  <button type="submit">登録</button>
</form>
```

## Metadata

```tsx
// 静的
export const metadata = {
  title: 'ページタイトル',
  description: '説明',
}

// 動的
export async function generateMetadata({ params }: Props) {
  const appliance = await getAppliance(params.id)
  return {
    title: `${appliance.name} | 説明書管理`,
    description: appliance.description,
  }
}
```
