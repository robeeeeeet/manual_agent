# 開発ガイド

## クイックスタート

### 1. セットアップ

```bash
# プロジェクトルートに移動
cd /home/robert/applications/manual_agent/backend

# 依存関係インストール
uv sync
```

### 2. 環境変数確認

プロジェクトルート (`/home/robert/applications/manual_agent/.env`) に以下が設定されていることを確認：

```bash
GEMINI_API_KEY=...
GOOGLE_CSE_API_KEY=...
GOOGLE_CSE_ID=...
```

### 3. サーバー起動

```bash
# 開発サーバー起動（ホットリロード有効）
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 動作確認

別のターミナルで：

```bash
# 簡易テスト実行
uv run python test_api.py

# または curl でテスト
curl http://localhost:8000/health
```

ブラウザで以下にアクセス：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API エンドポイント詳細

### GET /health

ヘルスチェック

```bash
curl http://localhost:8000/health
```

### POST /api/v1/appliances/recognize

画像から家電情報を認識

```bash
curl -X POST http://localhost:8000/api/v1/appliances/recognize \
  -F "image=@/path/to/image.jpg"
```

### POST /api/v1/manuals/search

マニュアルPDFを検索

```bash
curl -X POST http://localhost:8000/api/v1/manuals/search \
  -H "Content-Type: application/json" \
  -d '{
    "manufacturer": "日立",
    "model_number": "MRO-S7D",
    "official_domains": ["kadenfan.hitachi.co.jp"]
  }'
```

### POST /api/v1/manuals/extract-maintenance

メンテナンス項目を抽出（URL指定）

```bash
curl -X POST "http://localhost:8000/api/v1/manuals/extract-maintenance?pdf_url=https://example.com/manual.pdf&manufacturer=日立&model_number=MRO-S7D"
```

メンテナンス項目を抽出（ファイルアップロード）

```bash
curl -X POST http://localhost:8000/api/v1/manuals/extract-maintenance \
  -F "pdf_file=@/path/to/manual.pdf" \
  -F "manufacturer=日立" \
  -F "model_number=MRO-S7D"
```

## 開発ワークフロー

### コード変更時

FastAPIの `--reload` オプションを使用しているため、コード変更は自動的に反映されます。

### 新しい依存関係の追加

```bash
uv add package-name
```

### エンドポイント追加

1. `app/services/` にビジネスロジックを実装
2. `app/schemas/` にPydanticスキーマを定義
3. `app/api/routes/` に新しいルーターを作成
4. `app/main.py` でルーターを登録

### エラーハンドリング

すべてのエラーレスポンスは以下の形式で統一：

```json
{
  "error": "エラーメッセージ",
  "code": "ERROR_CODE",
  "details": "詳細情報（optional）"
}
```

## トラブルシューティング

### サーバーが起動しない

1. 環境変数が正しく設定されているか確認
   ```bash
   cat /home/robert/applications/manual_agent/.env
   ```

2. ポート8000が使用中でないか確認
   ```bash
   lsof -i :8000
   ```

3. 依存関係が正しくインストールされているか確認
   ```bash
   uv sync
   ```

### Gemini API エラー

1. API キーが有効か確認
2. クォータ制限に達していないか確認
3. ネットワーク接続を確認

### Google Custom Search API エラー

1. API キーと検索エンジンIDが正しいか確認
2. 1日の検索クォータを確認（無料枠: 100件/日）

## Phase 0 との違い

| 項目 | Phase 0 | Backend API |
|------|---------|-------------|
| 実行方法 | スクリプト単体実行 | REST API経由 |
| 画像入力 | ファイルパス | multipart/form-data |
| PDF入力 | ファイルパス or URL | URL or multipart/form-data |
| エラー処理 | print + sys.exit | HTTPException + 統一フォーマット |
| 型検証 | なし | Pydantic による厳格な検証 |

## 次のステップ (Phase 1)

- [ ] BFF → Backend 認証の実装 (`X-Backend-Key`)
- [ ] Supabase 連携
- [ ] エラーログの永続化
- [ ] レート制限の実装
- [ ] テストの追加 (pytest)

## 参考リンク

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Google Custom Search API](https://developers.google.com/custom-search)
