# Skillレビュー: `pwa-notification`

対象: `.claude/skills/pwa-notification/`

## 良い点

- **Push実装が一通り揃っている**: VAPID生成、購読保存、送信、410（expired）処理、Cronまで導線がある。
- **Service Workerの実務要素**: フェッチ戦略、通知クリック、オフライン、同期などの雛形があり現場で役立つ。

## 懸念点

- **Next.js設定の前提差**: `next.config.js` の `api.bodyParser.sizeLimit` などは、App RouterのRoute Handlerでは期待通りに効かないケースがあり、混乱しやすい。
- **前提条件の集約不足**: Pushの前提（HTTPS必須、対応ブラウザ、権限がdeniedになった場合のUI/導線）が `SKILL.md` にもう少し欲しい。
- **鍵管理の強調**: VAPID秘密鍵やCronシークレットなどの秘匿情報の取り扱いを、より強く明記したい。

## 改善提案（優先度順）

1. **（高）Pushの前提条件チェックリストを `SKILL.md` に追記**
   - HTTPS、ブラウザ/OS制限、許諾フロー、denied時の案内など。
2. **（中）送信処理は必ずサーバー側に固定**
   - VAPID秘密鍵がクライアントに出ない設計を太字で明記。
3. **（中）DoD（完了条件）を追加**
   - 例: 購読がDBに保存される、Cronで当日分が送れる、410時に購読が削除される、等。
