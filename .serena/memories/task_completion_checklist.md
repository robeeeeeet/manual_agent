# タスク完了時のチェックリスト

## コード変更後

### バックエンド (Python)
1. 型ヒントが適切に付いているか確認
2. 必要に応じてテストを実行: `cd backend && uv run pytest`
3. 開発サーバーでエンドポイント動作確認

### フロントエンド (TypeScript)
1. Lint実行: `cd frontend && npm run lint`
2. 開発サーバーで動作確認
3. Playwright MCP でブラウザテスト（UIの場合）

## フロントエンド開発時

**スキル活用**:
- UIコンポーネント作成時は `frontend-design` スキルを参照
- E2Eテストは `webapp-testing` スキルを参照

**テスト観点**:
- HEICなど特殊フォーマットのファイルアップロード
- API連携を含むE2Eフロー
- エラーケース（API失敗、バリデーションエラー等）

## コミット前

1. 変更内容を確認: `git diff`
2. コミットメッセージ規約に従う
3. 不要なデバッグコードがないか確認

## ドキュメント更新

重要な変更時は以下を確認:
- `CHANGELOG.md` - 変更履歴
- `docs/development-plan.md` - タスク完了チェック
- `docs/requirements.md` - 要件変更時
