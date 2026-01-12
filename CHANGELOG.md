# Changelog

このプロジェクトのすべての注目すべき変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいています。
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

## [Unreleased]

### Added

#### QA回答セルフチェック機能 ✅ 完了

QA回答の品質を自動検証し、不正確な回答を防止する機能。

- LLMによる回答の妥当性検証（回答が質問に適切に答えているか）
- 検証失敗時の再生成ロジック
- AIプロンプト全体の改善（より正確で有用な回答生成）

#### モバイルレイアウト全面改善 ✅ 完了

スマートフォンでの使用体験を大幅に向上。

- 家電詳細ページのレイアウト最適化
- タッチ操作しやすいボタンサイズ調整
- スクロール挙動の改善
- フォントサイズ・余白の調整

#### メンテナンスアーカイブ機能 ✅ 完了

不要になったメンテナンス項目をアーカイブして非表示にする機能。

- アーカイブ/復元トグル
- アーカイブ済み項目の一覧表示
- 家電登録者の表示追加

#### スマホヘッダー改善

- キャッシュクリア更新ボタンを追加（SWRキャッシュを強制リフレッシュ）
- 家電カテゴリをメンテナンス詳細モーダルに表示

#### PDFページ番号分離機能 ✅ 完了

- `pdf_page_number`: PDFビューアで表示されるページ番号
- `printed_page_number`: 説明書に印刷されているページ番号
- Gemini APIによる既存データの自動マイグレーション
- マイグレーション 00019, 00020

#### PDF暗号化自動解除機能 ✅ 完了

react-pdfで表示できない暗号化PDF（オーナーパスワード付き）を自動解除する機能。

- `pikepdf`によるオーナーパスワード暗号化の自動解除
- 解除不可PDF（ユーザーパスワード付き）は`is_pdf_encrypted`フラグで管理
- 暗号化PDFはブラウザ表示にフォールバック（確認モーダル付き）
- 既存PDF一括変換スクリプト（`scripts/decrypt_existing_pdfs.py`）
- アップロード時のリトライロジック（大容量ファイル対応）
- マイグレーション 20260112000002

### Changed

- **説明書検索のドメインフィルタ無効化**: 検索時の `site:domain` フィルタを無効化し、全ドメインから説明書PDFを検索可能に。異なるドメイン（代理店、サポートサイト等）の説明書も発見できるようになった。ドメイン登録処理は将来利用に備えて継続。
- **PDFビューア方式変更**: モーダル内PDFビューアを削除し、外部ブラウザで開く方式に変更（ブラウザ互換性向上）

### Fixed

- **画像圧縮によるサイズ制限回避**: クライアントサイドで画像を圧縮し、Vercelの4.5MBサイズ制限を回避
- **interval_type制約違反修正**: メンテナンススケジュール登録時の制約エラーを修正
- **tier_serviceエラー修正**: ティアサービスの初期化エラーを修正
- **QA回答のマークダウン表記修正**: 回答内のマークダウンが正しくレンダリングされない問題を修正
- **メンテナンス詳細モーダル改善**: 家電カテゴリを表示するよう修正

---

### 過去の追加機能（Phase 7以前にリリース済み）

#### Phase 7: 家族グループ共有機能 ✅ 完了

**データベース**
- `groups` テーブル: グループ情報（名前、招待コード、オーナー）
- `group_members` テーブル: グループメンバー管理（role: owner/member）
- `user_appliances.group_id` カラム追加: グループ所有の家電管理
- 1ユーザー1グループ制約（`uq_group_members_user`）
- 個人所有/グループ所有の排他制約（`chk_user_appliances_owner`）
- マイグレーション 00010〜00014

**バックエンドサービス**
- `group_service.py`: グループCRUD、招待コード生成・検証、メンバー管理
  - `create_group()` - グループ作成（6文字招待コード自動生成）
  - `join_group()` - 招待コードでグループ参加
  - `leave_group()` - グループ離脱（共有家電は個人所有に移管）
  - `delete_group()` - グループ削除（家電はオーナーに移管）
  - `remove_member()` - メンバー削除（オーナー権限）
  - `regenerate_invite_code()` - 招待コード再生成
- `appliance_service.py` 拡張:
  - `share_appliance()` - 個人家電をグループに共有
  - `unshare_appliance()` - グループ家電を個人所有に戻す

**バックエンドAPI**
- `POST /api/v1/groups` - グループ作成
- `GET /api/v1/groups` - 所属グループ取得
- `GET /api/v1/groups/{id}` - グループ詳細
- `PATCH /api/v1/groups/{id}` - グループ更新
- `DELETE /api/v1/groups/{id}` - グループ削除
- `POST /api/v1/groups/{id}/regenerate-code` - 招待コード再生成
- `POST /api/v1/groups/join` - 招待コードで参加
- `POST /api/v1/groups/{id}/leave` - グループ離脱
- `GET /api/v1/groups/{id}/members` - メンバー一覧
- `DELETE /api/v1/groups/{id}/members/{userId}` - メンバー削除
- `POST /api/v1/appliances/{id}/share` - 家電をグループに共有
- `POST /api/v1/appliances/{id}/unshare` - 共有解除

**フロントエンドBFF層**
- `/api/groups` - グループ一覧・作成
- `/api/groups/[id]` - グループ詳細・更新・削除
- `/api/groups/[id]/regenerate-code` - 招待コード再生成
- `/api/groups/[id]/members` - メンバー一覧
- `/api/groups/[id]/members/[userId]` - メンバー削除
- `/api/groups/[id]/leave` - グループ離脱
- `/api/groups/join` - グループ参加
- `/api/appliances/[id]/share` - 家電共有
- `/api/appliances/[id]/unshare` - 共有解除

**フロントエンドUI**
- `/groups` ページ: グループ一覧、作成フォーム、招待コード入力
- `/groups/[id]` ページ: グループ詳細、メンバー管理、招待コード表示・コピー
- `ShareButton.tsx`: 家電共有/解除トグルスイッチ（コンファームモーダル付き）
- 家電一覧・詳細ページにグループ共有ボタン追加
- Headerにグループページへのリンク追加
- グループ参加済みユーザー向けUI制限（重複参加防止）
- モーダル背景の統一（半透明+ぼかし効果）

**技術的特徴**
- 招待コード: 6文字英数字（大文字）でエントロピー確保
- 共有モデル: グループ所有（全メンバーが編集・削除可能）
- スケジュール共有: 誰かが完了すると全員に反映
- 通知設定: 個人設定を維持（各メンバーの`notify_time`を尊重）
- グループ切替え: 既存グループ離脱→共有家電を個人所有に移管→新グループ参加

#### QA会話履歴機能 ✅ 完了

QAチャットで会話の文脈を保持し、「それ」「これ」などの指示語を正しく解釈できるようにする機能。

**データベース**
- `qa_sessions` テーブル: セッション管理（ユーザー、家電、アクティブ状態、要約タイトル）
- `qa_session_messages` テーブル: メッセージ履歴（質問/回答、ソース情報、参照メタデータ）
- マイグレーション 00016〜00018

**バックエンドサービス**
- `qa_session_service.py`: セッション管理サービス
  - `create_session()` - 新規セッション作成
  - `get_session()` / `get_user_sessions()` - セッション取得
  - `resume_session()` - セッション再開
  - `reset_session()` - 新規セッションでリセット
  - `save_message()` / `get_messages()` - メッセージ保存・取得
  - `generate_session_summary()` - LLMによるタイトル自動生成（Gemini API）
  - 6時間タイムアウトによる自動非アクティブ化

**バックエンドAPI**
- `GET /api/v1/qa/{shared_appliance_id}/sessions` - セッション一覧取得
- `GET /api/v1/qa/sessions/{session_id}` - セッション詳細取得
- `POST /api/v1/qa/sessions/{session_id}/resume` - セッション再開
- `POST /api/v1/qa/{shared_appliance_id}/reset-session` - 新規セッション作成

**フロントエンドBFF層**
- `/api/qa/[sharedApplianceId]/sessions` - セッション一覧
- `/api/qa/sessions/[sessionId]` - セッション詳細・再開
- `/api/qa/[sharedApplianceId]/reset-session` - セッションリセット

**フロントエンドUI**
- `QASessionHistory.tsx` - 会話履歴UI
  - セッション一覧表示（相対時間・メッセージ数）
  - LLM要約タイトル表示（2行制限）
  - セッション切り替え・新規作成
- `QASection.tsx` / `QAChat.tsx` - セッション管理統合

#### リッチテキスト対応 ✅ 完了

メンテナンス説明文のHTML表示対応とDBスキーマの正規化。

**データベース**
- `shared_maintenance_items` 中心の正規化構造に変更
- マイグレーション 00015

**フロントエンドUI**
- `SafeHtml.tsx` - DOMPurifyによるサニタイズ済みHTML表示コンポーネント
- メンテナンスカードを縦並びレイアウトに変更（スマホでの視認性向上）
- メーカー名・型番を表示

**バックエンド**
- `maintenance_extraction.py` - HTML形式の説明文生成対応
- `maintenance_log_service.py` - 正規化構造対応

**ユーティリティ**
- `scripts/migrate_maintenance_description.py` - 既存データのマイグレーションスクリプト

#### パフォーマンス改善 ✅ 完了

N+1問題解消とSWR導入によるデータフェッチ最適化。

**バックエンド**
- `appliance_service.py`: `get_user_appliances()` のN+1問題解消
  - ループ内個別クエリ → `in_()` による一括クエリ
  - 10家電で13クエリ→4クエリに削減（約70%改善）
- `maintenance_notification_service.py`: 2箇所のN+1問題解消
  - `_get_users_with_upcoming_maintenance()`: N→1クエリ
  - `_get_users_for_scheduled_notification()`: 2N→2クエリ（97%改善）

**フロントエンド**
- SWR v2.3.8 導入
- カスタムフック作成
  - `useAppliances.ts` - 家電一覧データフェッチ
  - `useMaintenance.ts` - メンテナンス一覧データフェッチ
- 3ページ（トップ、家電一覧、メンテナンス一覧）にSWR適用
- キャッシュ設定: `revalidateOnFocus=false`, `dedupingInterval=60秒`

#### 認証フロー改善 ✅ 完了

パスワードリセット機能とUI改善。

**フロントエンドUI**
- `/reset-password` ページ: パスワードリセットフロー
  - メールアドレス入力 → リセットリンク送信
  - トークン検証 → 新パスワード設定
- `AuthForm.tsx`: パスワードリセットリンク追加
- `FeatureCard.tsx`: トップページの機能説明カードコンポーネント

**AuthContext**
- `resetPassword()` - パスワードリセットメール送信
- `updatePassword()` - 新パスワード設定

#### トップページ改善 ✅ 完了

- 機能説明セクションをページ下部に移動してコンパクト化
- `FeatureCard.tsx` コンポーネントによるカード表示

#### UI改善: テキスト見切れ対策 ✅ 完了

- メンテナンス名の長いテキストが見切れる問題を改善
- `MaintenanceListItem.tsx` のレイアウト調整

#### 家電詳細ページ総合改善 ✅ 完了

- メンテナンスカードのレイアウト改善
- 完了ボタンの色統一（期限超過時は赤色）
- メーカー名・型番の表示追加

#### Phase 6.5: メンテナンス一覧機能 ✅ 完了

**バックエンドAPI**
- `GET /api/v1/maintenance` - 全メンテナンス項目取得（ステータス・重要度・家電IDでフィルタ可能）
- ステータス判定ロジック（overdue / upcoming / scheduled / manual）
- カウント集計（各ステータスの件数）

**フロントエンドBFF層**
- `/api/maintenance` - メンテナンス一覧取得

**フロントエンドUI**
- `/maintenance` ページ（メンテナンス一覧）
- 共通コンポーネント
  - `MaintenanceStatusTabs.tsx` - ステータス別タブ（すべて / 期限超過 / 今週 / 予定通り / 手動）
  - `MaintenanceFilter.tsx` - フィルター（重要度、家電別）
  - `MaintenanceListItem.tsx` - リストアイテム（コンパクト / フル表示切替）
  - `MaintenanceCompleteModal.tsx` - 完了モーダル（家電詳細ページから共通化）
- 家電詳細ページと統一されたUI/UX
- 認証保護追加（middleware.ts に `/maintenance` 追加）

#### 通知オンボーディング機能

**フロントエンドUI**
- `NotificationOnboarding.tsx` - 初回サインアップ時の通知許可モーダル
- `sessionStorage` によるオンボーディング表示フラグ管理
- スキップ可能（「今はスキップ」ボタン）
- `useDeviceContext` フックによるデバイス判定（PC/スマホ、ブラウザ/PWA）

#### 確認コード再送機能

**フロントエンドUI**
- `AuthForm.tsx` - 「コードを再送する」ボタン追加
- 60秒クールダウンタイマー（成功時）
- Supabaseレート制限エラーからの秒数抽出・カウントダウン表示
- 日本語メッセージ対応（「あと N 秒で再送できます」）

**AuthContext**
- `resendOtp()` メソッド追加（Supabase Auth `resend()` API使用）

### Changed

#### UI改善: ハンバーガーメニュー・Headerの改善

**Header コンポーネント（`Header.tsx`）**
- デスクトップ表示にログアウトボタンを追加（ユーザーメール横）
- モバイルメニュー（ハンバーガーメニュー）にログアウトボタンを追加
- ログインページ（`/login`）でハンバーガーメニューを非表示に変更

#### サインアップ時のエラーメッセージ改善

**AuthForm コンポーネント**
- 既存メールアドレスでサインアップ時の日本語エラーメッセージ追加
- 「このメールアドレスは既に登録されています」表示

#### UI改善: メンテナンス一覧のコンパクト化

**家電詳細ページ（`/appliances/[id]`）**
- メンテナンス一覧をコンパクト化（タスク名 + 重要度バッジ + 期限バッジ + 完了ボタン）
- 詳細モーダルを追加（項目クリックで表示）
  - 説明文、周期、参照ページ、日付情報を表示
  - 「完了履歴を表示」リンクで履歴モーダルへ遷移
  - 「完了する」ボタンで完了記録モーダルへ遷移
- 長い説明文が一覧を圧迫する問題を解消

### Added

#### Phase 6: QA不正利用防止機能 ✅ 完了

**データベース**
- `qa_violations` テーブル: 違反質問の記録（ユーザーID、質問内容、違反タイプ、検出方法）
- `qa_restrictions` テーブル: ユーザー別利用制限管理（違反回数、制限解除時刻）
- マイグレーション `00009_qa_abuse.sql`

**バックエンドサービス**
- `qa_abuse_service.py`: QA不正利用防止サービス
  - `check_user_restriction()` - ユーザーの制限状態確認
  - `validate_question()` - 質問検証（ルールベース + LLM ハイブリッド）
  - `record_violation()` - 違反記録
  - `update_restriction()` - 制限状態更新

**検証ロジック**
- ルールベース検出（高速・無料）: 天気、株価、ニュース等のキーワード
- LLMベース検出（高精度）: Gemini APIで文脈を理解して判定

**段階的制限**
- 1回目: 警告のみ（即座にリトライ可能）
- 2回目: 1時間制限
- 3回目: 24時間制限
- 4回目以降: 7日間制限

**フロントエンドUI**
- QAChat: エラー表示UI（制限中メッセージ、残り時間表示）
- 警告文に「関係のない質問を繰り返すと制限される」注意を追加

#### Phase 5: 通知・PWA ✅ 完了

**定期リマインド自動化**
- `send_scheduled_maintenance_reminders()`: ユーザーごとの`notify_time`・`timezone`を考慮したリマインド送信
- `_get_users_for_scheduled_notification()`: 現在の時刻に通知すべきユーザーを抽出
- `/api/v1/cron/send-reminders`: Cron用エンドポイント（シークレットキー認証）
- `scripts/setup-scheduler.sh`: Cloud Schedulerセットアップスクリプト
- `CRON_SECRET_KEY`: Cronジョブ認証用シークレット（Secret Manager）

**PWA基盤**
- `manifest.json`: アプリ名、アイコン、テーマカラー設定
- Service Worker（`sw.js`、`custom-sw.js`）
- PWAアイコン（192x192, 512x512, apple-touch-icon）
- next-pwa 設定（本番時のみ有効）

**バックエンドサービス**
- `push_subscription_service.py`: Push購読管理（subscribe/unsubscribe）
- `notification_service.py`: Web Push送信（pywebpush）
- `maintenance_notification_service.py`: メンテナンスリマインド通知
- `push_subscriptions` テーブル（Supabase）

**バックエンドAPI**
- `POST /api/v1/push/subscribe` - Push購読登録
- `DELETE /api/v1/push/unsubscribe` - Push購読解除
- `POST /api/v1/notifications/test` - テスト通知送信
- `POST /api/v1/notifications/reminders/send` - リマインド送信（全ユーザー/任意ユーザー）
- `POST /api/v1/notifications/reminders/my` - リマインド送信（自分のみ・簡易）

**フロントエンドBFF層**
- `/api/push/subscribe` - 購読登録
- `/api/push/unsubscribe` - 購読解除（DELETE）
- `/api/push/vapid-public-key` - VAPID公開鍵取得
- `/api/push/test` - テスト通知送信
- `/api/notifications/reminders` - リマインド送信

**フロントエンドUI**
- `NotificationPermission.tsx`: 通知許可リクエストUI（テスト通知ボタン追加）
- `serviceWorker.ts`: Service Worker登録ユーティリティ
- `src/hooks/` ディレクトリ
- `AuthForm.tsx`: OTPコード入力フォーム追加
- マイページ（`/mypage`）: メンテナンス統計、通知設定、通知時刻変更、ログアウト
- Headerにマイページアイコンリンク追加

**ユーザー設定API（バックエンド）**
- `user_service.py`: プロファイル取得、設定更新、メンテナンス統計
- `GET /api/v1/users/me` - プロファイル取得
- `PATCH /api/v1/users/settings` - 設定更新（notify_time）
- `GET /api/v1/users/me/maintenance-stats` - メンテナンス統計取得

**ユーザー設定API（BFF層）**
- `/api/user/me` - プロファイル取得
- `/api/user/settings` - 設定取得・更新
- `/api/user/maintenance-stats` - 統計取得

### Fixed
- 家電一覧と詳細ページのメンテナンス日数表示の不一致を修正
  - 一覧ページ: APIから取得した `days_until_due`（切り捨て計算）を使用
  - 詳細ページ: `Math.ceil`（切り上げ）を使用していたため1日多く表示される問題
  - `Math.floor` に統一してバックエンドAPIと一致させた

### Changed
- モバイルメニュー簡素化: ログインユーザーは「家電一覧」「マイページ」のみ表示（家電登録、通知設定、ログアウトはマイページに集約）

**認証フロー**
- サインアップ時のメール確認をOTPコード方式に変更（PWA対応）
  - メールリンクではなく6〜8桁の確認コードを入力
  - `AuthContext.verifyOtp()` メソッド追加
  - Supabaseメールテンプレートの設定手順追加（`docs/supabase-setup.md`）

**テスト通知機能**
- `/api/notifications/test` BFFルート: 許可ユーザーのみテスト通知送信可能
- `ALLOWED_TEST_NOTIFICATION_USERS` 環境変数でホワイトリスト管理

**ユーティリティ**
- `scripts/generate-vapid-keys.py`: VAPID鍵生成スクリプト

#### Phase 4: メンテナンス管理 ✅

**バックエンドサービス**
- `maintenance_log_service.py`: メンテナンス完了記録・履歴取得
  - `complete_maintenance()` - 完了記録・次回日再計算
  - `get_maintenance_logs()` - 履歴取得（ページネーション対応）
  - `get_upcoming_maintenance()` - 期限間近の項目取得
  - `get_appliance_next_maintenance()` - 家電別次回メンテナンス取得

**バックエンドAPI**
- `POST /api/v1/appliances/schedules/{schedule_id}/complete` - メンテナンス完了記録
- `GET /api/v1/appliances/schedules/{schedule_id}/logs` - 履歴取得
- `GET /api/v1/appliances/maintenance/upcoming` - 期限間近のメンテナンス取得

**フロントエンドBFF層**
- `/api/appliances/maintenance-schedules/[id]/complete` - 完了記録API
- `/api/appliances/maintenance-schedules/[id]/logs` - 履歴取得API

**フロントエンドUI**
- 家電詳細画面（`/appliances/[id]`）
  - メンテナンス項目に「完了」ボタン追加
  - 完了確認モーダル（メモ入力対応）
  - 最終完了日表示（`last_done_at`）
  - 履歴表示モーダル（「履歴を表示」ボタン）
- 家電一覧画面（`/appliances`）
  - 次回メンテナンス日バッジ表示
  - 色分け表示（期限切れ: 赤、間近: 黄、余裕あり: 緑）

#### Phase 2: 認証機能 ✅
- Supabase Auth連携（@supabase/ssr）
- ログイン/新規登録画面（AuthFormコンポーネント）
- 認証状態管理（AuthContext/AuthProvider）
- ミドルウェアによるルート保護
- メール確認コールバック処理

#### Phase 3: 家電登録・説明書取得 ✅

**データベース**
- `shared_appliances` テーブル: 家電マスターデータ（メーカー・型番・説明書情報）
- `user_appliances` テーブル: ユーザーの所有関係（表示名・画像）
- `shared_maintenance_items` テーブル: LLM抽出結果のキャッシュ
- `manufacturer_domains` テーブル: メーカー公式サイトドメイン管理
- Supabase Storage `manuals` バケット: 共有PDF保存
- マイグレーション 00002〜00006

**バックエンドサービス**
- `appliance_service.py`: 家電CRUD操作（共有家電の取得/作成、ユーザー家電の管理）
- `pdf_storage.py`: PDFダウンロード・アップロード、公開/署名付きURL生成
- `maintenance_cache_service.py`: メンテナンス項目キャッシュ取得・保存
- `supabase_client.py`: Supabaseクライアント
- `manufacturer_domain.py`: メーカードメイン管理

**バックエンドAPI**
- `POST /api/v1/appliances/register` - 家電登録（ユーザー所有関係を作成）
- `GET /api/v1/appliances` - 家電一覧取得
- `GET /api/v1/appliances/{id}` - 家電詳細取得
- `PATCH /api/v1/appliances/{id}` - 家電更新
- `DELETE /api/v1/appliances/{id}` - 家電削除
- `POST /api/v1/manuals/check-existing` - 既存PDFチェック（共有）
- `POST /api/v1/manuals/confirm` - 説明書確認・PDF保存（共有）+ ドメイン学習

**フロントエンドBFF層**
- `/api/appliances/register` - 家電登録
- `/api/appliances/check-existing` - 既存家電チェック
- `/api/appliances/confirm-manual` - 説明書確認・PDF保存
- `/api/appliances/search-manual-stream` - 説明書検索（ストリーミング）
- `/api/appliances/maintenance-items/[sharedApplianceId]` - メンテナンス項目取得
- `/api/appliances/extract-maintenance` - メンテナンス抽出
- `/api/appliances/maintenance-schedules/register` - スケジュール登録
- `/api/appliances/[id]` - 家電詳細・削除

**フロントエンドUI**
- `/appliances` ページ（家電一覧）
- `Modal` コンポーネント
- `src/types/appliance.ts` 型定義ファイル
- `src/lib/api.ts` バックエンドAPIクライアント

### Changed
- **データベース設計: 家電情報の共有マスター方式への移行**
  - `appliances` テーブルを `shared_appliances`（家電マスター）と `user_appliances`（所有関係）に分離
  - 同じ家電（同一メーカー・型番）の説明書PDFを複数ユーザーで共有可能に
  - `maintenance_schedules.appliance_id` → `user_appliance_id` へ変更
  - RLSポリシーを全面的に再設計（共有マスターは全ユーザー閲覧可能）
- バックエンドに家電CRUD APIを追加（`/api/appliances`）
  - 実装上のプレフィックスは `/api/v1`（`/api/v1/appliances`）
- フロントエンドBFF層に家電管理APIルートを追加
- Headerコンポーネントに認証UI追加（ログイン/ログアウト表示切替）
- `manual_search.py`: ストリーミング検索対応
- `maintenance_extraction.py`: キャッシュサービス連携

### Removed
- `frontend/src/app/api/appliances/search-manual/route.ts` - ストリーミング版に置き換え

### Migration Notes
- **破壊的変更**: マイグレーション 00002〜00006 の適用が必要
- 既存データがある場合は事前にバックアップを推奨
- `supabase db push` でリモートDBにマイグレーション適用

### Technical Notes
- **共有マスター方式**: 同じ家電（同一メーカー・型番）の情報を1レコードで管理し、複数ユーザーで共有
- **メンテナンスキャッシュ**: LLM抽出は1家電1回のみ、2人目以降は即座に項目取得可能（コスト削減）
- **PDFストレージ**: Supabase Storageの `manuals` バケットに保存、署名付きURL for 一時アクセス
- **ストリーミング検索（SSE）**: 検索の進捗状況をリアルタイムでフロントエンドに送信
- **再検索機能**: `excluded_urls`, `skip_domain_filter`, `cached_candidates` パラメータで再検索をサポート
- **メーカードメイン学習**: PDFが見つかったドメインを記録し、次回検索で優先的に使用
- **並行検索制限**: `max_concurrent_searches` (デフォルト5) で同時検索数を制限
- **メンテナンス完了記録**: 完了時にメモを記録し、次回日を自動再計算
- **次回メンテナンス表示**: 期限までの日数に応じた色分けバッジ（赤:期限切れ、黄:7日以内、緑:余裕あり）
- **PWA対応**: next-pwaによるService Worker管理、オフライン対応の基盤
- **Web Push通知**: pywebpush + VAPID認証によるセキュアなPush通知配信
- **メンテナンスリマインド**: 期限当日・期限間近の項目を自動で通知
- **OTPコード認証**: PWA対応のため、メール確認をリンク方式からOTPコード方式に変更（Safariでリンクが開かれる問題を回避）
- **テスト通知**: 環境変数でホワイトリスト管理されたユーザーのみテスト通知を送信可能

---

## [0.3.0] - 2025-01-02

### Added
- Phase 1.5: デプロイ基盤構築
  - Vercelデプロイ（フロントエンド）
  - Cloud Runデプロイ（バックエンド）
  - GitHub Actions CI/CDパイプライン
  - Workload Identity Federation設定
  - デプロイスクリプト（`scripts/deploy-backend.sh`、`scripts/setup-secrets.sh`）

### Technical Notes
- 本番URL: https://manual-agent-seven.vercel.app/
- バックエンドAPI: Cloud Run（自動スケール）

---

## [0.2.0] - 2025-01-01

### Added
- Phase 1: 基盤構築（ハイブリッドアーキテクチャ）
  - FastAPIバックエンド
    - 画像認識API（`/api/v1/appliances/recognize`）
    - 説明書検索API（`/api/v1/manuals/search`）
    - メンテナンス抽出API（`/api/v1/manuals/extract-maintenance`）
    - HEIC変換API（`/api/v1/appliances/convert-heic`）
  - Next.js 16フロントエンド
    - 基本レイアウト（Header, Footer, Button, Card）
    - 家電登録画面（画像アップロード → AI解析）
    - BFF層 API Routes
    - HEICプレビュー対応
  - Supabase設定
    - PostgreSQLスキーマ
    - pgvector拡張
    - Auth設定（メール認証）
    - Storageバケット（manuals, images）
    - RLSポリシー

### Technical Notes
- ハイブリッドアーキテクチャ: Next.js（TypeScript）+ FastAPI（Python）
- AI処理はPythonバックエンドで実行（Gemini API / google-genai）

---

## [0.1.0] - 2025-01-01

### Added
- Phase 0 フィジビリティ確認完了
  - Gemini APIを使用した画像からのメーカー・型番読み取り機能の検証
  - メーカー・型番からマニュアルPDF取得機能の検証
  - マニュアルからメンテナンス項目抽出機能の検証
- プロジェクト初期設定
  - Python環境セットアップ（uv + pyproject.toml）
  - 要件定義書の作成

### Technical Notes
- 3つのコアAI機能（画像認識、PDF取得、メンテナンス抽出）の実現可能性を確認
- Gemini APIの無料枠（60 QPM）で十分対応可能と判断
