# スクリプトディレクトリ

このディレクトリには、プロジェクトのセットアップとデプロイに関連するスクリプトが含まれています。

## スクリプト一覧

### デプロイ関連

#### `deploy-backend.sh`
FastAPIバックエンドをGoogle Cloud Runにデプロイします。

```bash
# ビルド & デプロイ
./scripts/deploy-backend.sh

# ビルドのみ
./scripts/deploy-backend.sh build

# デプロイのみ（ビルド済みの場合）
./scripts/deploy-backend.sh deploy
```

**前提条件:**
- Google Cloud CLI (`gcloud`) がインストール済み
- プロジェクトIDが設定済み
- 必要な権限が付与されている

#### `setup-secrets.sh`
環境変数をGoogle Cloud Secret Managerに登録します。

```bash
# シークレットを登録
./scripts/setup-secrets.sh

# シークレット一覧を表示
./scripts/setup-secrets.sh --list
```

**登録される環境変数:**
- `GEMINI_API_KEY`
- `GOOGLE_CSE_API_KEY`
- `GOOGLE_CSE_ID`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `VAPID_PUBLIC_KEY` (Phase 5)
- `VAPID_PRIVATE_KEY` (Phase 5)
- `VAPID_SUBJECT` (Phase 5)

### セットアップ関連

#### `generate-vapid-keys.py`
Web Push通知用のVAPID鍵ペアを生成します。

```bash
cd backend && uv run python ../scripts/generate-vapid-keys.py
```

**出力例:**
```
VAPID_PUBLIC_KEY=<生成された公開鍵がここに表示されます>
VAPID_PRIVATE_KEY=<生成された秘密鍵がここに表示されます>
VAPID_SUBJECT=mailto:your-email@example.com
```

> ⚠️ **重要**: 上記は例であり、実際のキーは絶対にドキュメントやコードにハードコードしないでください。

**使用方法:**
1. スクリプトを実行してVAPID鍵ペアを生成
2. 生成された鍵を `.env` および `frontend/.env.local` に設定
3. `VAPID_SUBJECT` にメールアドレスまたはHTTPSのURLを設定

**セキュリティ:**
- `VAPID_PRIVATE_KEY` は秘密鍵です。絶対に公開しないでください
- 本番環境とテスト環境で異なる鍵を使用することを推奨します
- 鍵を紛失した場合は新しい鍵を生成し、再設定が必要です

## 注意事項

1. **環境変数の管理**
   - `.env` ファイルは `.gitignore` に含まれています
   - 本番環境の環境変数は Secret Manager で管理されます
   - ローカル開発では `.env` ファイルを使用します

2. **実行権限**
   - シェルスクリプトには実行権限が必要です: `chmod +x scripts/*.sh`

3. **依存関係**
   - `deploy-backend.sh`: Docker, gcloud CLI
   - `setup-secrets.sh`: gcloud CLI
   - `generate-vapid-keys.py`: Python 3.12+, cryptography パッケージ

## トラブルシューティング

### VAPID鍵生成エラー
```
TypeError: curve must be an EllipticCurve instance
```
**解決方法:** `cryptography` パッケージのバージョンを確認してください。
```bash
cd backend && uv run python -c "import cryptography; print(cryptography.__version__)"
```

### デプロイエラー
```
ERROR: (gcloud.run.deploy) PERMISSION_DENIED
```
**解決方法:**
1. `gcloud auth login` でログインを確認
2. プロジェクトIDが正しいか確認: `gcloud config get-value project`
3. 必要な権限（Cloud Run Admin, Service Account User）が付与されているか確認

### Secret Manager エラー
```
ERROR: (gcloud.secrets.create) ALREADY_EXISTS
```
**解決方法:** シークレットが既に存在する場合は、`gcloud secrets versions add` で新しいバージョンを追加してください。

## 関連ドキュメント

- [デプロイ手順書](/docs/deploy-setup.md)
- [環境変数設定](/CLAUDE.md#環境変数)
- [開発計画](/docs/development-plan.md)
