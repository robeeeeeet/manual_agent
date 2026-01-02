# Skills再レビュー（一覧 / v2）

対象: `/home/robert/applications/manual_agent/.claude/skills`

前回レビューを反映して `.claude/skills` 配下が更新されたため、内容ベースで再レビューした（パッチ適用は行わない）。

## 対象Skill一覧

- `fastapi-backend-dev` → `REVIEW_skill_fastapi-backend-dev_2026-01-02_v2.md`
- `nextjs-frontend-dev` → `REVIEW_skill_nextjs-frontend-dev_2026-01-02_v2.md`
- `supabase-integration` → `REVIEW_skill_supabase-integration_2026-01-02_v2.md`
- `hybrid-architecture` → `REVIEW_skill_hybrid-architecture_2026-01-02_v2.md`
- `pwa-notification` → `REVIEW_skill_pwa-notification_2026-01-02_v2.md`
- `manual-ai-processing` → `REVIEW_skill_manual-ai-processing_2026-01-02_v2.md`
- `project-testing` → `REVIEW_skill_project-testing_2026-01-02_v2.md`

## 横断所見（要約）

- **大幅改善**: 多くのSkillに「前提条件 / DoD / セキュリティ必須チェック」が追加され、再現性が上がった。
- **残課題の中心**: `SKILL.md` で宣言した統一ルール（命名・エラー形式・環境変数）が、`references/` や一部サンプルに追従しきれていない。


