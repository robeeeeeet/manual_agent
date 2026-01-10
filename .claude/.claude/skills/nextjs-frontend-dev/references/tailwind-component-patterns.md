# Tailwind コンポーネントパターン

## フォーム

### 入力フィールド

```tsx
<div className="space-y-2">
  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
    製品名
  </label>
  <input
    id="name"
    type="text"
    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
               focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    placeholder="例: エアコン"
  />
</div>
```

### セレクト

```tsx
<select className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
  <option value="">カテゴリを選択</option>
  <option value="aircon">エアコン・空調</option>
  <option value="kitchen">キッチン</option>
</select>
```

### ファイルアップロード

```tsx
<div className="border-2 border-dashed border-gray-300 rounded-lg p-6
                hover:border-blue-500 transition-colors cursor-pointer">
  <input type="file" className="hidden" id="file" />
  <label htmlFor="file" className="flex flex-col items-center cursor-pointer">
    <svg className="w-12 h-12 text-gray-400" /* upload icon */ />
    <span className="mt-2 text-sm text-gray-600">
      クリックまたはドラッグ＆ドロップ
    </span>
  </label>
</div>
```

## カード

### 基本カード

```tsx
<div className="bg-white rounded-lg shadow-md overflow-hidden">
  <div className="p-6">
    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    <p className="text-gray-600 mt-2">{description}</p>
  </div>
  <div className="bg-gray-50 px-6 py-3">
    <button className="text-blue-600 hover:text-blue-800">詳細を見る</button>
  </div>
</div>
```

### 家電カード（期限表示付き）

```tsx
interface ApplianceCardProps {
  name: string
  nextDueAt: Date | null
  task: string
}

function ApplianceCard({ name, nextDueAt, task }: ApplianceCardProps) {
  const isOverdue = nextDueAt && nextDueAt < new Date()

  return (
    <div className={`rounded-lg shadow-md p-4 ${
      isOverdue ? 'bg-red-50 border-l-4 border-red-500' : 'bg-white'
    }`}>
      <h3 className="font-semibold text-gray-900">{name}</h3>
      <p className="text-sm text-gray-600 mt-1">{task}</p>
      <p className={`text-sm mt-2 ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
        {nextDueAt ? formatDate(nextDueAt) : '未設定'}
      </p>
    </div>
  )
}
```

## ナビゲーション

### ヘッダー

```tsx
<header className="bg-white shadow-sm">
  <div className="container mx-auto px-4 py-4 flex items-center justify-between">
    <Link href="/" className="text-xl font-bold text-gray-900">
      説明書管理
    </Link>
    <nav className="flex items-center gap-4">
      <Link href="/appliances" className="text-gray-600 hover:text-gray-900">
        家電一覧
      </Link>
      <Link href="/settings" className="text-gray-600 hover:text-gray-900">
        設定
      </Link>
    </nav>
  </div>
</header>
```

### モバイルメニュー

```tsx
'use client'

import { useState } from 'react'

function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        className="lg:hidden p-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg className="w-6 h-6" /* menu icon */ />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-64 bg-white p-6">
            {/* メニュー内容 */}
          </div>
        </div>
      )}
    </>
  )
}
```

## ステップフォーム

```tsx
interface StepIndicatorProps {
  currentStep: number
  steps: string[]
}

function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center space-x-4">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center
            ${index <= currentStep
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-600'
            }`}>
            {index + 1}
          </div>
          <span className="ml-2 text-sm hidden sm:block">{step}</span>
          {index < steps.length - 1 && (
            <div className={`w-12 h-1 mx-2
              ${index < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
```

## アラート・通知

```tsx
// 成功
<div className="bg-green-50 border-l-4 border-green-500 p-4">
  <p className="text-green-700">登録が完了しました</p>
</div>

// エラー
<div className="bg-red-50 border-l-4 border-red-500 p-4">
  <p className="text-red-700">エラーが発生しました</p>
</div>

// 警告
<div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
  <p className="text-yellow-700">メンテナンス期限が近づいています</p>
</div>
```

## レスポンシブ

```tsx
// モバイルファースト
<div className="
  px-4          // モバイル: 16px
  sm:px-6       // 640px以上: 24px
  lg:px-8       // 1024px以上: 32px
">

// グリッド
<div className="
  grid
  grid-cols-1   // モバイル: 1列
  md:grid-cols-2 // 768px以上: 2列
  lg:grid-cols-3 // 1024px以上: 3列
  gap-4
">
```
