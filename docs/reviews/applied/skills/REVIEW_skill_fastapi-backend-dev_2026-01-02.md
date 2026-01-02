# Skillレビュー: `fastapi-backend-dev`

対象: `.claude/skills/fastapi-backend-dev/`

## 良い点

- **層分けが明確**: router / service / model / agent の例があり、拡張しやすい。
- **参照が実務的**: `references/fastapi-patterns.md` に例外ハンドラ、バリデーション、非同期、設定管理などが揃っている。
- **AI統合の導線**: LangChain/LangGraphの入口が `SKILL.md` から辿れる。

## 懸念点

- **ファイルサイズ検証の例**: `UploadFile.size` 参照は環境依存になり得るため、実装時に「常に取れる」前提だと事故りやすい。
- **運用ガードが薄め**: LLM呼び出しのタイムアウト、リトライ、JSONパース失敗時の扱い、観測性（ログ/メトリクス）が `SKILL.md` 側に集約されていない。
- **認証境界の曖昧さ**: BFFが付与するヘッダ（例: `X-User-ID`）をFastAPIがどう検証するかがSkill間で固定されていない。

## 改善提案（優先度順）

1. **（高）LLM呼び出しの標準ガードを `SKILL.md` に追記**
   - タイムアウト、リトライ（指数バックオフ）、JSON抽出/パース失敗時のフォールバック、レート制限時の待機など。
2. **（高）認証方式を明文化**
   - 「BFF→FastAPIは固定キー/JWTどちらか」「FastAPI側で必ず検証」などを固定する。
3. **（中）DoD（完了条件）を追加**
   - 例: `/health` が200、画像解析APIが1ケース通る、LLM失敗時もエラーフォーマットが統一される、等。


