# Skill再レビュー: `pwa-notification`（v2）

対象: `.claude/skills/pwa-notification/`

## 改善が確認できた点

- **前提条件チェックリスト**（HTTPS、ブラウザ制限、permission denied時の導線）が `SKILL.md` に追加され、落とし穴が減っている。
- **DoD**（購読保存、Cron送信、410削除、クリック遷移）が具体化されている。
- **秘密鍵をクライアントに出さない**、**送信はサーバー側**など、セキュリティの重要点が強調されている。
- App Routerにおける `next.config.js` 設定の注意が入り、混乱が減る。

## 残っている課題（優先度順）

1. **（中）references側のSupabase命名が統一に追従していない**
   - `references/web-push-patterns.md` に `createServerClient()` の例が残っており、`nextjs-frontend-dev` の命名規則（`createServerSupabaseClient()`）とズレる。
2. **（中）Admin clientの定義場所が固定されていない**
   - `createAdminClient()` の前提（service role key）と配置場所をSkills横断で固定すると実装が迷わない。

## 追加で良くなる提案

- **（中）DoDの検証手順（最小）**
  - 例: subscribe APIでDBに1件入る、Cronで通知が届く、410を擬似的に起こして削除される、など。


