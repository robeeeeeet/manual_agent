# Skill再レビュー: `hybrid-architecture`（v2）

対象: `.claude/skills/hybrid-architecture/`

## 改善が確認できた点

- **通信パスの原則（BFF経由）**が明文化され、CORSの位置付けも整理されている。
- **BFF→FastAPIの認証方式**が「MVP: 固定キー（将来JWT）」として明記され、実装の迷いが減っている。
- **エラーレスポンス形式**を `{error, code, details?}` に統一する方針が入っている。
- DoDに「未認証で401」「本番で直アクセスブロック」などが入り、実運用を意識できている。

## 残っている課題（優先度順）

1. **（高）環境変数名の統一**
   - Next側は `BACKEND_API_KEY`、FastAPI側例は `API_KEY` になっている箇所があり、`fastapi-backend-dev` 側の前提とも揺れる。
2. **（中）“本番で直アクセスブロック”の担保レイヤが不明確**
   - ネットワーク（private subnet / security group / ingress）か、アプリ層（認証必須）か、どこで担保するかを短く補足すると再現性が上がる。

## 追加で良くなる提案

- **（中）BFFの実装テンプレの分割**
  - JSON / FormData / Stream を別々に提示すると、コピペ実装時の事故が減る。
