# Skill再レビュー: `fastapi-backend-dev`（v2）

対象: `.claude/skills/fastapi-backend-dev/`

## 改善が確認できた点

- **前提条件 / DoD / セキュリティ必須チェック** が追加され、Skillsとしての再現性が上がっている。
- **SDK統一**: `google-genai` 採用が明記され、関連Skill（`manual-ai-processing`）とも整合している。
- **LLM呼び出しの標準ガード**（timeout / retry / JSON抽出）が `SKILL.md` に入り、運用事故が減る。
- **BFF→FastAPI認証**（`X-Backend-Key`）をMVP固定キーとして明文化し、`hybrid-architecture` と方針が揃った。

## 残っている課題（優先度順）

1. **（高）エラーフォーマットの“統一”が未完**
   - DoDは「統一」を掲げているが、例では `{"error": "...", "message": "..."}` のような形になっており、
     `hybrid-architecture` 側の `{error, code, details?}` とズレる。
2. **（中）例コードのimport/前提不足**
   - `HTTPException` など、ブロック単体ではimportが省略されており、コピペ実行で詰まる可能性がある。
3. **（中）依存追加コマンドの整合**
   - `google-genai` 採用と、`uv add ... langchain-google-genai` の例の関係が読み手に誤解されやすい。

## 追加で良くなる提案

- **（中）DoDの検証手順を1〜2個追記**
  - 例: `curl` で `/health` が200、BFF付与ヘッダなしで401、付与ありで200、など。
