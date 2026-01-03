# Cloud Run デプロイ時の Insights

Phase 1.5 の Cloud Run デプロイ作業で得られた知見をまとめる。

---

## 1. デプロイプラットフォームの選定

### 比較検討したサービス

| プラットフォーム | 無料枠 | 特徴 |
|-----------------|--------|------|
| **Vercel** | 100GB帯域/月 | Next.js開発元、最適化済み |
| **Cloudflare Pages** | 帯域無制限 | 超高速CDN、商用利用OK |
| **Render** | 750時間/月 | 無料枠充実、コールドスタートあり |
| **Railway** | $5クレジット/月 | DX最高、常時起動 |
| **Google Cloud Run** | 200万リクエスト/月 | 無料枠大、自動スケール |
| **Fly.io** | 3 VM | エッジデプロイ、常時起動 |

### 選定結果

- **フロントエンド**: Vercel（Next.js最適化、代替なし）
- **バックエンド**: Cloud Run（無料枠大、GCPエコシステム）

### 選定理由

1. **Vercel の優位性**: Next.js App Router の最新機能（Server Components, Server Actions）をフルサポート
2. **Cloud Run vs Render**: Cloud Run は無料枠が圧倒的に大きい（200万リクエスト vs 750時間）
3. **GCP エコシステム**: Secret Manager、Cloud Build との連携がスムーズ

---

## 2. Dockerfile 設計

### マルチステージビルドの採用

```dockerfile
FROM python:3.12-slim AS builder   # ステージ1: 依存関係インストール
FROM python:3.12-slim AS runtime   # ステージ2: 実行環境（軽量）
```

**メリット**:
- 最終イメージから uv やビルドツールを除外
- イメージサイズ約50%削減
- セキュリティ向上（不要なツールが含まれない）

### 非rootユーザーでの実行

```dockerfile
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
USER appuser
```

**理由**:
- Cloud Run のベストプラクティス
- コンテナエスケープ攻撃のリスク軽減
- 最小権限の原則

### uv の活用

```dockerfile
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
RUN uv sync --frozen --no-dev --no-editable
```

**メリット**:
- `uv.lock` に完全準拠（ローカルと本番で同一の依存関係）
- pip より高速（10倍以上）
- `--no-editable` で本番用に最適化

---

## 3. Cloud Build での注意点

### `.gcloudignore` と `.dockerignore` の関係

Cloud Build は **2段階で除外を適用** する：

1. **gcloud**: `.gcloudignore`（なければ `.gitignore`）を参照してアップロード対象を決定
2. **Docker**: `.dockerignore` を参照してビルドコンテキストを決定

**重要**: 両方の設定が整合している必要がある。

### 発生した問題と解決策

#### 問題1: `uv.lock` がアップロードされない

```
COPY failed: file not found in build context: stat uv.lock: file does not exist
```

**原因**: `.gitignore` に `uv.lock` が含まれており、`.gcloudignore` がないため `.gitignore` が使用された

**解決策**: `.gcloudignore` を作成し、`uv.lock` を除外リストから外す

#### 問題2: `README.md` がビルドコンテキストにない

```
OSError: Readme file does not exist: README.md
```

**原因**:
- `pyproject.toml` で `readme = "README.md"` を指定
- `.dockerignore` で `*.md` を除外

**解決策**: `.dockerignore` で `README.md` を除外しないよう修正

```diff
- *.md
+ DEVELOPMENT.md
```

### ベストプラクティス

1. **`.gcloudignore` を明示的に作成** する（`.gitignore` に依存しない）
2. **ビルドに必要なファイル** は両方の ignore ファイルで除外しない
3. **README.md が必須** な場合は `pyproject.toml` の `readme` フィールドに注意

---

## 4. Workload Identity Federation（推奨）

GitHub Actions から GCP へ認証する際、サービスアカウントキーの代わりに OIDC トークンを使用。

**メリット**:
- キー漏洩リスクゼロ
- キーのローテーション不要
- 監査ログが詳細

**設定手順**:
1. Workload Identity Pool 作成
2. GitHub OIDC プロバイダー登録
3. サービスアカウントへのバインディング

詳細は `docs/deploy-setup.md` を参照。

---

## 5. コスト見積もり

### 無料枠での運用

| サービス | 無料枠 | 想定使用量 | 月額 |
|----------|--------|-----------|------|
| Vercel | 100GB帯域 | 〜10GB | $0 |
| Cloud Run | 200万リクエスト | 〜10万 | $0 |
| Supabase | 500MB DB | 〜100MB | $0 |
| **合計** | - | - | **$0** |

### コールドスタート対策

開発段階: `min-instances=0`（無料、30秒〜1分のコールドスタート）
本番運用: `min-instances=1`（約$5/月、常時起動）

---

## 6. デプロイ時のトラブルシューティング

### 6.1 Secret Manager アクセス拒否

**エラーメッセージ:**
```
Permission denied on secret: projects/xxx/secrets/GEMINI_API_KEY/versions/latest
for Revision service account xxx-compute@developer.gserviceaccount.com.
The service account used must be granted the 'Secret Manager Secret Accessor' role
```

**原因:**
Cloud Run のデフォルトサービスアカウント（Compute Engine default service account）には Secret Manager へのアクセス権限がない。

**解決策:**
```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**ベストプラクティス:**
- 本番環境では専用のサービスアカウントを作成し、最小権限を付与する
- デフォルトの Compute Engine サービスアカウントは使わない

---

### 6.2 非rootユーザーでのファイル権限エラー

**エラーメッセージ:**
```
PermissionError: [Errno 13] Permission denied: '/app/app/__init__.py'
```

**原因:**
Dockerfile で `USER appuser` に切り替えた後、`COPY` でコピーしたファイルの所有者が root のままになっている。

**解決策:**
```dockerfile
# NG: 所有者が root のまま
COPY app ./app

# OK: 所有者を appuser に変更
COPY --chown=appuser:appgroup app ./app
```

**補足:**
マルチステージビルドで `COPY --from=builder` を使う場合も同様に `--chown` を指定できるが、仮想環境（`.venv`）は実行時に書き込みが不要なため root 所有でも問題ない。

---

### 6.3 `.gcloudignore` と `.dockerignore` の競合

**問題:**
Cloud Build でファイルがアップロードされているのに、Docker ビルド時に「file not found」エラーが発生。

**原因:**
- `.gcloudignore`: Cloud Build へのアップロード対象を制御
- `.dockerignore`: Docker ビルドコンテキストを制御

両方の設定が整合していないと、gcloud ではアップロードされても Docker で除外される。

**例:**
```
# .gcloudignore では README.md を含める
# .dockerignore で *.md を除外
→ Docker ビルド時に README.md が見つからない
```

**解決策:**
ビルドに必要なファイル（`README.md`, `uv.lock` など）は両方の ignore ファイルで除外しないこと。

---

## 7. デプロイスクリプトの活用

### 作成したスクリプト

| スクリプト | 用途 | 使用頻度 |
|-----------|------|---------|
| `scripts/deploy-backend.sh` | ビルド & デプロイ | 高（コード変更ごと） |
| `scripts/setup-secrets.sh` | シークレット登録 | 低（初回 or 値変更時） |

### 使用方法

```bash
# ビルド & デプロイ（最も頻繁に使用）
./scripts/deploy-backend.sh

# ビルドのみ
./scripts/deploy-backend.sh build

# デプロイのみ（既存イメージ使用）
./scripts/deploy-backend.sh deploy

# シークレット登録（.env から読み込み）
./scripts/setup-secrets.sh

# シークレット一覧表示
./scripts/setup-secrets.sh --list
```

---

## 8. 今後の課題

1. **CI/CD パイプライン構築**: GitHub Actions で自動デプロイ
2. **CORS 設定**: Vercel ドメインを Cloud Run で許可
3. **ヘルスチェック最適化**: コールドスタート時のタイムアウト対策
4. **ログ・モニタリング**: Cloud Logging / Error Reporting の活用

---

## 参考リンク

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [uv Documentation](https://docs.astral.sh/uv/)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
