---
name: webapp-testing
description: Playwright MCPを使用したWebアプリのE2Eテスト・デバッグ。フロントエンド実装後の動作確認、フォーム操作、ファイルアップロード（HEIC含む）、API連携テストで使用。「動作確認して」「テストして」「ブラウザで確認」などのリクエストで発動。
---

# Webapp Testing with Playwright MCP

Playwright MCPを使用してWebアプリの動作確認・デバッグを行う。

## テストワークフロー

### 1. ページ遷移

```
browser_navigate: URLに遷移
browser_snapshot: ページ状態を取得（アクセシビリティツリー）
```

### 2. 要素操作

```
browser_click: ボタン・リンクをクリック（ref属性で指定）
browser_type: テキスト入力
browser_select_option: ドロップダウン選択
browser_fill_form: 複数フィールドを一括入力
```

### 3. ファイルアップロード

```
1. browser_click でアップロードエリアをクリック
2. browser_file_upload で絶対パスを指定
   - paths: ["/absolute/path/to/file.jpg"]
   - HEIC/HEIFも対応
```

### 4. 確認・デバッグ

```
browser_snapshot: 現在のページ状態（要素のref値を含む）
browser_take_screenshot: スクリーンショット保存
browser_console_messages: コンソールログ確認
browser_network_requests: APIリクエスト確認
```

## よくあるテストパターン

### フォーム送信テスト

```
1. browser_navigate → フォームページへ
2. browser_snapshot → 要素のref値を取得
3. browser_type/browser_fill_form → フォーム入力
4. browser_click → 送信ボタン
5. browser_snapshot → 結果確認
```

### 画像アップロード + API連携テスト

```
1. browser_navigate → アップロードページへ
2. browser_click → アップロードエリア
3. browser_file_upload → 画像ファイル指定
4. browser_snapshot → プレビュー確認
5. browser_click → 送信ボタン
6. browser_wait_for → API応答待ち
7. browser_snapshot → 結果確認
```

## 注意事項

- **ref属性**: browser_snapshotで取得したref値を使用して要素を特定
- **絶対パス**: ファイルアップロードは絶対パスのみ対応
- **待機**: API呼び出し後はbrowser_wait_forでテキスト出現を待つ
- **HEIC**: ブラウザプレビュー不可だがアップロード・API送信は可能
