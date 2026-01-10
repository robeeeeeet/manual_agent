---
paths: {scripts/*.sh,backend/app/api/routes/cron.py,backend/app/config.py}
---

# GCP Secret Manager & シークレット認証

## 問題: シークレット値の不一致によるINVALID認証エラー

Cloud Scheduler から Cloud Run へのリクエストで `X-Cron-Secret` ヘッダー認証が失敗する場合、以下を確認:

### よくある原因

1. **改行文字の混入**: `gcloud secrets versions access` の出力に `\r` や `\n` が含まれる
2. **バージョン不一致**: Cloud Run が古いシークレットバージョンを参照している
3. **前後の空白**: シークレット登録時に意図しない空白が含まれる

### シェルスクリプトでの対策

```bash
# Secret Manager から値を取得する際は \r\n を除去
get_secret() {
    gcloud secrets versions access latest --secret=SECRET_NAME --project=PROJECT_ID 2>/dev/null | tr -d '\r\n'
}

# シークレット登録時は echo -n で改行なし
echo -n "$SECRET_VALUE" | gcloud secrets create SECRET_NAME --data-file=- --project=PROJECT_ID
```

### Python での対策

```python
import secrets
import hashlib

def _normalize_secret(value: str) -> str:
    """前後の空白・改行を除去"""
    return value.strip()

def _fingerprint_secret(value: str) -> str:
    """デバッグ用の非可逆フィンガープリント（秘密情報を漏らさない）"""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]

def verify_secret(received: str, expected: str) -> bool:
    """セキュアな比較（タイミング攻撃対策）"""
    return secrets.compare_digest(
        _normalize_secret(received),
        _normalize_secret(expected)
    )
```

### デバッグログのベストプラクティス

秘密情報をログに出力しない。代わりに以下の情報を記録:

```python
{
    "present": True,
    "len": len(value),
    "has_cr": "\r" in value,
    "has_lf": "\n" in value,
    "has_surrounding_ws": value != value.strip(),
    "fingerprint": hashlib.sha256(value.encode()).hexdigest()[:12],
}
```

### Cloud Run デプロイ時の注意

- シークレット更新後は Cloud Run を再デプロイ
- 明示的にバージョン指定する場合: `--set-secrets="SECRET=SECRET:2"`
- 最新版を使用する場合: `--set-secrets="SECRET=SECRET:latest"`
