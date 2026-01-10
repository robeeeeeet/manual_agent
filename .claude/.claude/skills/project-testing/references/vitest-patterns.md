# Vitest パターン

## セットアップ

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// グローバルモック
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
```

## コンポーネントテスト

### 基本

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('クリックでonClickが呼ばれる', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)

    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disabled時はクリック不可', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick} disabled>Click me</Button>)

    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

### フォーム

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApplianceForm } from '@/components/ApplianceForm'

describe('ApplianceForm', () => {
  it('入力値を送信する', async () => {
    const onSubmit = vi.fn()
    render(<ApplianceForm onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText('製品名'), 'エアコン')
    await userEvent.type(screen.getByLabelText('メーカー'), 'テストメーカー')
    await userEvent.click(screen.getByRole('button', { name: '登録' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'エアコン',
        maker: 'テストメーカー',
      })
    })
  })

  it('バリデーションエラーを表示', async () => {
    render(<ApplianceForm onSubmit={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: '登録' }))

    expect(screen.getByText('製品名は必須です')).toBeInTheDocument()
  })
})
```

### 非同期データ

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ApplianceList } from '@/components/ApplianceList'

vi.mock('@/lib/api', () => ({
  getAppliances: vi.fn(),
}))

import { getAppliances } from '@/lib/api'

describe('ApplianceList', () => {
  it('データを取得して表示', async () => {
    vi.mocked(getAppliances).mockResolvedValue([
      { id: '1', name: 'エアコン' },
      { id: '2', name: '冷蔵庫' },
    ])

    render(<ApplianceList />)

    await waitFor(() => {
      expect(screen.getByText('エアコン')).toBeInTheDocument()
      expect(screen.getByText('冷蔵庫')).toBeInTheDocument()
    })
  })

  it('ローディング状態を表示', () => {
    vi.mocked(getAppliances).mockImplementation(
      () => new Promise(() => {}) // 解決しないPromise
    )

    render(<ApplianceList />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('エラー時にエラーメッセージを表示', async () => {
    vi.mocked(getAppliances).mockRejectedValue(new Error('Failed'))

    render(<ApplianceList />)

    await waitFor(() => {
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument()
    })
  })
})
```

## カスタムフック

```tsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAppliances } from '@/hooks/useAppliances'

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        execute: () => Promise.resolve({
          data: [{ id: '1', name: 'Test' }],
          error: null,
        }),
      }),
    }),
  }),
}))

describe('useAppliances', () => {
  it('家電一覧を取得', async () => {
    const { result } = renderHook(() => useAppliances())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.appliances).toHaveLength(1)
  })

  it('refetchで再取得', async () => {
    const { result } = renderHook(() => useAppliances())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.refetch()
    })

    expect(result.current.loading).toBe(true)
  })
})
```

## モック

### fetch モック

```typescript
import { vi } from 'vitest'

beforeEach(() => {
  global.fetch = vi.fn()
})

it('APIを呼び出す', async () => {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: 'test' }),
  } as Response)

  const result = await fetchData()
  expect(result.data).toBe('test')
})
```

### next/navigation モック

```typescript
import { vi } from 'vitest'
import { useRouter } from 'next/navigation'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

it('登録後にリダイレクト', async () => {
  const push = vi.fn()
  vi.mocked(useRouter).mockReturnValue({ push } as any)

  render(<RegistrationForm />)
  await userEvent.click(screen.getByText('登録'))

  await waitFor(() => {
    expect(push).toHaveBeenCalledWith('/appliances')
  })
})
```

## スナップショット

```tsx
import { render } from '@testing-library/react'
import { ApplianceCard } from '@/components/ApplianceCard'

it('スナップショットと一致', () => {
  const { container } = render(
    <ApplianceCard appliance={{ id: '1', name: 'Test' }} />
  )
  expect(container).toMatchSnapshot()
})
```

## カバレッジ

```bash
npm run test:coverage
```

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
      ],
    },
  },
})
```
