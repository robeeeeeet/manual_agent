# Skillsレビュー（一覧）

対象: `/home/robert/applications/manual_agent/.claude/skills`

このディレクトリ配下の `SKILL.md` と `references/*.md` を読み、Claude Code Skillsとしての有用性・再現性・安全性の観点でレビューした。

## 対象Skill一覧

- `fastapi-backend-dev` → `REVIEW_skill_fastapi-backend-dev_2026-01-02.md`
- `nextjs-frontend-dev` → `REVIEW_skill_nextjs-frontend-dev_2026-01-02.md`
- `supabase-integration` → `REVIEW_skill_supabase-integration_2026-01-02.md`
- `hybrid-architecture` → `REVIEW_skill_hybrid-architecture_2026-01-02.md`
- `pwa-notification` → `REVIEW_skill_pwa-notification_2026-01-02.md`
- `manual-ai-processing` → `REVIEW_skill_manual-ai-processing_2026-01-02.md`
- `project-testing` → `REVIEW_skill_project-testing_2026-01-02.md`

## 横断所見（要約）

- **構成が良い**: `SKILL.md`（最短導線）と `references/`（深掘り）の役割分担が明確で、着手しやすい。
- **改善余地**: サンプルコード間の命名揺れ・前提差分があり、コピペ実装時に詰まりやすい。各Skillに「前提」「完了条件（DoD）」「セキュリティ必須チェック」を短く固定すると再現性が上がる。


