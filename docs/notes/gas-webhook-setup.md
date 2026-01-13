# Google Apps Script Webhook セットアップ手順

お問い合わせフォームからGoogle Sheetsへデータを送信するためのWebhook設定手順。

## 1. Google Sheetsの準備

1. [Google Sheets](https://sheets.google.com) で新規スプレッドシートを作成
2. シート名を「お問い合わせ」に変更
3. 1行目にヘッダーを追加:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| タイムスタンプ | メールアドレス | 種類 | 画面 | 内容 | 発生手順 | スクリーンショット | ユーザーID |

4. スプレッドシートのIDをメモ（URLの`/d/`と`/edit`の間の文字列）
   例: `https://docs.google.com/spreadsheets/d/ABC123.../edit` → `ABC123...`

## 2. Google Apps Scriptの作成

1. スプレッドシートのメニューから「拡張機能」→「Apps Script」を選択
2. 以下のコードを貼り付け:

```javascript
/**
 * お問い合わせフォームWebhook
 * POSTリクエストを受け取り、スプレッドシートに記録する
 */
function doPost(e) {
  try {
    // リクエストボディをパース
    const data = JSON.parse(e.postData.contents);

    // スプレッドシートを取得
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('お問い合わせ');

    if (!sheet) {
      return createResponse(false, 'Sheet not found');
    }

    // スクリーンショットURLを生成（Supabase Storage）
    let screenshotUrl = '';
    if (data.screenshot_path) {
      // 注意: 実際のSupabase URLに置き換えてください
      const supabaseUrl = 'https://nuuukueocvvdoynqkmol.supabase.co';
      screenshotUrl = `${supabaseUrl}/storage/v1/object/public/contact-screenshots/${data.screenshot_path}`;
    }

    // 行を追加
    sheet.appendRow([
      data.timestamp,
      data.user_email,
      data.type,
      data.screen,
      data.content,
      data.reproduction_steps || '',
      screenshotUrl,
      data.user_id,
    ]);

    return createResponse(true, 'Success');

  } catch (error) {
    console.error('Error:', error);
    return createResponse(false, error.message);
  }
}

/**
 * レスポンスを作成
 */
function createResponse(success, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: success, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * テスト用関数
 */
function testDoPost() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        timestamp: new Date().toISOString(),
        user_id: 'test-user-id',
        user_email: 'test@example.com',
        type: '機能リクエスト',
        screen: '家電一覧',
        content: 'テストメッセージです',
        reproduction_steps: '',
        screenshot_path: '',
      })
    }
  };

  const result = doPost(testData);
  console.log(result.getContent());
}
```

3. プロジェクト名を「ContactFormWebhook」などに変更して保存（Ctrl+S）

## 3. Webアプリとしてデプロイ

1. 「デプロイ」→「新しいデプロイ」をクリック
2. 「種類の選択」で「ウェブアプリ」を選択
3. 設定:
   - **説明**: お問い合わせフォームWebhook
   - **次のユーザーとして実行**: 自分
   - **アクセスできるユーザー**: 全員
4. 「デプロイ」をクリック
5. 初回は「アクセスを承認」が必要
   - Googleアカウントを選択
   - 「詳細」→「（安全ではないページ）に移動」→「許可」
6. **ウェブアプリのURL**をコピー
   例: `https://script.google.com/macros/s/AKfycb.../exec`

## 4. 環境変数の設定

### ローカル開発

`backend/.env` に追加:

```bash
GAS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

### 本番環境（Cloud Run）

```bash
# Secret Managerに登録
echo -n "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec" | \
  gcloud secrets create gas-webhook-url --data-file=- --project=YOUR_PROJECT_ID

# または既存のシークレットを更新
echo -n "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec" | \
  gcloud secrets versions add gas-webhook-url --data-file=- --project=YOUR_PROJECT_ID
```

Cloud Runデプロイ時に環境変数として設定:

```bash
gcloud run deploy backend \
  --set-secrets="GAS_WEBHOOK_URL=gas-webhook-url:latest"
```

## 5. 動作確認

### curlでテスト

```bash
curl -X POST "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2024-01-01T12:00:00",
    "user_id": "test-123",
    "user_email": "test@example.com",
    "type": "機能リクエスト",
    "screen": "家電一覧",
    "content": "テストメッセージ",
    "reproduction_steps": "",
    "screenshot_path": ""
  }'
```

成功時のレスポンス:
```json
{"success":true,"message":"Success"}
```

### Apps Scriptでテスト

1. Apps Scriptエディタで`testDoPost`関数を選択
2. 「実行」をクリック
3. スプレッドシートにテストデータが追加されることを確認

## トラブルシューティング

### よくあるエラー

1. **「スクリプトにアクセスする権限がありません」**
   - デプロイ時に「アクセスできるユーザー」を「全員」に設定しているか確認

2. **「Sheet not found」**
   - シート名が「お問い合わせ」になっているか確認

3. **CORS エラー**
   - GASはサーバーサイドからのみ呼び出すため、フロントエンドから直接呼び出さないこと
   - 必ずバックエンド（FastAPI）経由で呼び出す

4. **URLが変わった場合**
   - 新しいバージョンをデプロイすると新しいURLが発行される
   - 環境変数を更新し、Cloud Runを再デプロイする

## セキュリティ考慮事項

- Webhook URLは秘匿情報として扱う（環境変数で管理）
- GASはGoogleアカウントで認証されるが、URLを知っていれば誰でもPOSTできる
- 必要に応じてGAS側でシークレットキーによる認証を追加することも可能
