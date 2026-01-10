# トップページ改善

## ブランチ名
`feature/top-page`

## 背景
トップページの機能説明セクションが目立ちすぎて邪魔になっている。

## タスク

### 機能説明セクションの移動と改善
- 現在: ページ上部に大きく表示
- 要望:
  1. ページ下部に移動（メインコンテンツの後）
  2. 3列レイアウトで表示（デスクトップ）、スマホは1列
  3. 内容を簡素化（見やすく邪魔にならない程度に）

### 対象セクション
- 「AI画像認識」
- 「説明書自動取得」
- 「リマインド通知」

### デザイン案
```
[メインコンテンツ（家電一覧、メンテナンス予定等）]

──────────────────────────────────────────────────

[AI画像認識]     [説明書自動取得]   [リマインド通知]
  アイコン          アイコン           アイコン
  短い説明          短い説明           短い説明
```

## 関連ファイル
- `frontend/src/app/page.tsx`

## 実装
- Tailwind CSSの `grid-cols-3` を活用
- アイコンは既存のものを流用または Heroicons
- 説明文は1-2行に収める

```tsx
// 実装例
<section className="mt-12 border-t pt-8">
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <FeatureCard icon={CameraIcon} title="AI画像認識" description="..." />
    <FeatureCard icon={DocumentIcon} title="説明書自動取得" description="..." />
    <FeatureCard icon={BellIcon} title="リマインド通知" description="..." />
  </div>
</section>
```

## 確認事項
- スマホでは1列表示になるか確認
- メインコンテンツの視認性が上がったか確認
