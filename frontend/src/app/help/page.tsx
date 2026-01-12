"use client";

import { useState } from "react";
import Link from "next/link";

type Section = {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
};

export default function HelpPage() {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    const isOpening = openSection !== id;
    setOpenSection(isOpening ? id : null);

    // セクションを開いたときに、見やすい位置にスムーズスクロール
    if (isOpening) {
      // アニメーション完了を待ってからスクロール
      requestAnimationFrame(() => {
        setTimeout(() => {
          const element = document.getElementById(`section-${id}`);
          if (element) {
            const headerOffset = 80; // ヘッダーの高さ + 余白
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = window.scrollY + elementPosition - headerOffset;

            window.scrollTo({
              top: offsetPosition,
              behavior: "smooth",
            });
          }
        }, 50);
      });
    }
  };

  const sections: Section[] = [
    {
      id: "intro",
      title: "はじめに",
      icon: "📖",
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            <strong>トリセツコンシェルジュ</strong>は、家電や住宅設備の取扱説明書を管理し、メンテナンス作業を忘れないようにサポートするWebアプリです。
          </p>
          <div className="bg-[#007AFF]/10 border border-[#007AFF]/20 rounded-xl p-4">
            <h4 className="font-semibold text-[#007AFF] mb-2">このアプリでできること</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <span>📸</span>
                <span>写真を撮るだけで家電を自動登録（メーカー・型番認識、説明書取得、メンテナンス項目抽出）</span>
              </li>
              <li className="flex gap-2">
                <span>📚</span>
                <span>すべての家電の説明書を1ヶ所で管理、スマホからいつでも閲覧</span>
              </li>
              <li className="flex gap-2">
                <span>🔔</span>
                <span>定期的なお手入れを通知でお知らせ、完了記録で次回日を自動計算</span>
              </li>
              <li className="flex gap-2">
                <span>💬</span>
                <span>AIによる質問応答で、使い方やトラブルに即座に回答</span>
              </li>
              <li className="flex gap-2">
                <span>👨‍👩‍👧‍👦</span>
                <span>グループを作成して家電を家族で共有</span>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "getting-started",
      title: "使い始める",
      icon: "🚀",
      content: (
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">新規登録</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li>トップページの「新規登録」ボタンをクリック</li>
              <li>メールアドレスとパスワード（8文字以上）を入力</li>
              <li>「確認コードを送信」をクリック</li>
              <li>メールに届いた <strong>6桁の確認コード</strong> を入力</li>
              <li>「登録を完了する」をクリック</li>
            </ol>
            <p className="text-sm text-gray-600 mt-2">
              💡 確認コードが届かない場合は「再送信」ボタンをクリック（60秒間隔）
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">通知許可（重要）</h4>
            <p className="text-sm text-gray-700 mb-2">
              初回サインアップ後、通知許可の確認画面が表示されます。
            </p>
            <div className="bg-[#34C759]/10 border border-[#34C759]/20 rounded p-3 text-sm">
              <p className="font-semibold text-[#34C759]">通知を有効にすると:</p>
              <ul className="list-disc list-inside ml-2 text-gray-700">
                <li>メンテナンス期限のリマインドが届く</li>
                <li>期限超過の場合も毎日通知</li>
              </ul>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              後で「マイページ」の「通知設定」から変更できます。
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">アプリとしてホームに追加</h4>
            <p className="text-sm text-gray-700 mb-2">
              スマホで頻繁に使う場合は、ホーム画面に追加すると便利です。
            </p>
            <div className="bg-[#34C759]/10 border border-[#34C759]/20 rounded p-3 mb-3 text-sm">
              <p className="font-semibold text-[#34C759] mb-1">📱 ホームに追加すると:</p>
              <ul className="list-disc list-inside ml-2 text-gray-700">
                <li>アプリのようにホーム画面から起動できます</li>
                <li><strong>プッシュ通知が届くようになります</strong>（メンテナンスリマインド）</li>
              </ul>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="border border-gray-200 rounded p-3">
                <p className="font-semibold text-gray-900 mb-1">iOS（iPhone/iPad）</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-2">
                  <li>Safari でアプリを開く</li>
                  <li>画面下部の「共有」アイコンをタップ</li>
                  <li>「ホーム画面に追加」を選択</li>
                </ol>
              </div>
              <div className="border border-gray-200 rounded p-3">
                <p className="font-semibold text-gray-900 mb-1">Android</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-2">
                  <li>Chrome でアプリを開く</li>
                  <li>メニュー（︙）から「ホーム画面に追加」を選択</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "register-appliance",
      title: "家電を登録する",
      icon: "📸",
      content: (
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">写真撮影で自動登録（推奨）</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li>ヘッダーの「家電を登録」ボタンをクリック</li>
              <li>「写真で登録」を選択</li>
              <li>家電の型番ラベルを撮影（または既存の写真をアップロード）</li>
              <li>AI がメーカー・型番を自動認識</li>
              <li>カテゴリ・設置場所を入力</li>
              <li>「次へ」をクリック</li>
            </ol>
            <div className="bg-[#007AFF]/10 border border-[#007AFF]/20 rounded p-3 mt-2 text-sm">
              <p className="font-semibold text-[#007AFF] mb-1">撮影のコツ:</p>
              <ul className="list-disc list-inside ml-2 text-gray-700">
                <li>型番シールが明確に写るようにする</li>
                <li>明るい場所で撮影する</li>
                <li>ピントを合わせる</li>
              </ul>
            </div>
            <div className="bg-[#FF9500]/10 border border-[#FF9500]/20 rounded p-3 mt-2 text-sm">
              <p className="font-semibold text-[#FF9500] mb-1">💡 型番ラベルが見つからないとき:</p>
              <p className="text-gray-700">
                家電の全体像を撮影してください。AIが製品の特徴から型番ラベルの位置を推測し、どこを撮影すればよいかアドバイスしてくれます。
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">手動入力</h4>
            <p className="text-sm text-gray-700 mb-2">
              型番が分かっている場合や、AI 認識が失敗した場合:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li>「手動で入力」を選択</li>
              <li>メーカー名・型番・カテゴリ・設置場所を入力</li>
              <li>「次へ」をクリック</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">説明書取得とメンテナンス項目</h4>
            <p className="text-sm text-gray-700 mb-2">
              登録後、AI が自動的に公式の取扱説明書を検索し、メンテナンス項目を抽出します。
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li><strong>検索成功</strong>: PDF が自動ダウンロードされます</li>
              <li><strong>検索失敗</strong>: 「手動でアップロード」ボタンが表示されます</li>
            </ul>
            <p className="text-sm text-gray-600 mt-2">
              ※ メンテナンス項目は自動抽出後、必要なものを選択してください
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "manage-appliance",
      title: "家電を管理する",
      icon: "🏠",
      content: (
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">家電一覧の見方</h4>
            <p className="text-sm text-gray-700 mb-2">
              ヘッダーの「家電一覧」から、登録済みの家電を確認できます。
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-[#34C759]/100"></span>
                <span className="text-gray-700"><strong>予定通り</strong>: 1週間以上先</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-[#FF9500]/100"></span>
                <span className="text-gray-700"><strong>今週</strong>: 7日以内</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-[#FF3B30]/100"></span>
                <span className="text-gray-700"><strong>超過</strong>: 期限を過ぎている</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">家電詳細ページでできること</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <span>📄</span>
                <span><strong>説明書PDF閲覧</strong>: 「説明書を開く」ボタンで表示</span>
              </li>
              <li className="flex gap-2">
                <span>🔧</span>
                <span><strong>メンテナンス項目の確認</strong>: 次回実施日、周期、重要度を確認</span>
              </li>
              <li className="flex gap-2">
                <span>✅</span>
                <span><strong>完了記録</strong>: 完了ボタン（✓）をクリックして記録</span>
              </li>
              <li className="flex gap-2">
                <span>📜</span>
                <span><strong>履歴の確認</strong>: 過去の実施日とメモを確認</span>
              </li>
              <li className="flex gap-2">
                <span>💬</span>
                <span><strong>AI に質問</strong>: 使い方やトラブルについて質問</span>
              </li>
              <li className="flex gap-2">
                <span>🔗</span>
                <span><strong>家族と共有</strong>: 「共有する」ボタンでグループと共有</span>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "maintenance",
      title: "メンテナンスを管理する",
      icon: "🔧",
      content: (
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">メンテナンス一覧ページ</h4>
            <p className="text-sm text-gray-700 mb-2">
              ヘッダーの「メンテナンス」から、すべてのメンテナンス項目を確認できます。
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">ステータス別タブ</h4>
            <div className="space-y-2 text-sm">
              <div className="border border-gray-200 rounded p-2">
                <span className="font-semibold">すべて</span>
                <span className="text-gray-600 ml-2">すべてのメンテナンス項目を表示</span>
              </div>
              <div className="border border-[#FF3B30]/20 rounded p-2 bg-[#FF3B30]/10">
                <span className="font-semibold text-[#FF3B30]">期限超過 🔴</span>
                <span className="text-gray-600 ml-2">期限を過ぎた項目のみ表示（優先対応）</span>
              </div>
              <div className="border border-[#FF9500]/20 rounded p-2 bg-[#FF9500]/10">
                <span className="font-semibold text-[#FF9500]">今週 🟡</span>
                <span className="text-gray-600 ml-2">7日以内に期限が来る項目を表示</span>
              </div>
              <div className="border border-[#34C759]/20 rounded p-2 bg-[#34C759]/10">
                <span className="font-semibold text-[#34C759]">予定通り 🟢</span>
                <span className="text-gray-600 ml-2">1週間以上先の項目を表示</span>
              </div>
              <div className="border border-gray-200 rounded p-2">
                <span className="font-semibold">手動</span>
                <span className="text-gray-600 ml-2">「使用後」「異常時」など周期が決まっていない項目</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">完了記録と次回日の計算</h4>
            <p className="text-sm text-gray-700 mb-2">
              各項目の「完了」ボタンをクリックして記録すると、次回実施日が自動計算されます。
            </p>
            <div className="bg-[#007AFF]/10 border border-[#007AFF]/20 rounded p-3 text-sm">
              <p className="font-semibold text-[#007AFF] mb-1">次回日の仕組み:</p>
              <ul className="list-disc list-inside ml-2 text-gray-700 space-y-1">
                <li><strong>定期項目（3ヶ月ごと、年1回など）</strong>: 完了日から周期を加算</li>
                <li><strong>手動項目</strong>: 次回日は「未設定」のまま</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "qa",
      title: "QA 機能（AI 質問応答）",
      icon: "💬",
      content: (
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">質問の仕方</h4>
            <p className="text-sm text-gray-700 mb-2">
              家電詳細ページの「AI に質問」セクションで質問できます。
            </p>
            <div className="bg-[#007AFF]/10 border border-[#007AFF]/20 rounded p-3 text-sm">
              <p className="font-semibold text-[#007AFF] mb-1">質問例:</p>
              <ul className="list-disc list-inside ml-2 text-gray-700 space-y-1">
                <li>「エラーコード E01 の原因は何ですか？」</li>
                <li>「フィルターの掃除方法を教えてください」</li>
                <li>「温度設定を変更するにはどうすればいいですか？」</li>
              </ul>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">回答の見方</h4>
            <p className="text-sm text-gray-700 mb-2">
              AI は以下の順で最適な情報を検索します:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li><strong>QA 検索</strong>: 事前生成された QA データから検索</li>
              <li><strong>テキスト検索</strong>: 説明書全文からキーワード検索</li>
              <li><strong>PDF 分析</strong>: PDF を直接分析して回答生成</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">フィードバックと会話履歴</h4>
            <p className="text-sm text-gray-700 mb-2">
              回答の下に「解決しましたか？」と表示されます。「はい ✓」または「いいえ ✗」で評価してください。
            </p>
            <div className="bg-[#007AFF]/10 border border-[#007AFF]/20 rounded p-3 mb-3 text-sm">
              <p className="font-semibold text-[#007AFF] mb-1">🙏 ご協力のお願い</p>
              <p className="text-gray-700">
                フィードバックは回答の精度向上に活用されます。ぜひ評価にご協力ください！
              </p>
            </div>
            <p className="text-sm text-gray-700">
              過去の質問と回答は自動的に保存されます。「会話履歴」ボタンから確認できます。
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">利用制限</h4>
            <p className="text-sm text-gray-700 mb-2">
              以下のような質問は不正利用とみなされ、段階的に制限されます:
            </p>
            <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded p-3 mb-3 text-sm">
              <p className="font-semibold text-[#FF3B30] mb-1">⚠️ 不正利用の例:</p>
              <ul className="list-disc list-inside ml-2 text-gray-700">
                <li>家電の使い方に関係ない質問（雑談、一般知識など）</li>
                <li>攻撃的・不適切な内容を含む質問</li>
                <li>AIを騙そうとする質問</li>
              </ul>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              違反が検出された場合の制限:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li><strong>1回目</strong>: 警告のみ</li>
              <li><strong>2回目</strong>: 1時間の利用制限</li>
              <li><strong>3回目</strong>: 24時間の利用制限</li>
              <li><strong>4回目以降</strong>: 7日間の利用制限</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "groups",
      title: "家族と共有する",
      icon: "👨‍👩‍👧‍👦",
      content: (
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">グループ作成</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li>ヘッダーの「グループ」をクリック</li>
              <li>「新しいグループを作成」ボタンをクリック</li>
              <li>グループ名を入力</li>
              <li>「作成」をクリック</li>
            </ol>
            <p className="text-sm text-gray-600 mt-2">
              作成すると <strong>招待コード</strong>（6文字の英数字）が発行されます。
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">グループに参加</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li>家族から招待コードを受け取る</li>
              <li>「グループに参加」ボタンをクリック</li>
              <li>招待コードを入力</li>
              <li>「参加」をクリック</li>
            </ol>
            <p className="text-sm text-[#FF3B30] mt-2">
              ⚠️ 1ユーザーは1つのグループにのみ参加できます。
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">家電を共有</h4>
            <p className="text-sm text-gray-700 mb-2">
              家電詳細ページの「共有する」トグルスイッチをONにすると、即座にグループメンバー全員が閲覧・編集可能になります。
            </p>
            <div className="bg-[#FF9500]/10 border border-[#FF9500]/20 rounded p-3 text-sm">
              <p className="font-semibold text-[#FF9500] mb-1">注意:</p>
              <ul className="list-disc list-inside ml-2 text-gray-700">
                <li>すべてのメンバーが閲覧・編集・削除可能</li>
                <li>メンテナンス完了は全員に反映</li>
                <li>削除すると全員から見えなくなります</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "mypage",
      title: "マイページ・設定",
      icon: "⚙️",
      content: (
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">プラン & 利用状況</h4>
            <p className="text-sm text-gray-700 mb-2">
              現在のプランと利用状況を確認できます:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li>登録家電: 現在の登録数 / 上限</li>
              <li>説明書検索（今日）: 本日の検索回数 / 上限</li>
              <li>QA 質問（今日）: 本日の質問回数 / 上限</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">メンテナンス統計</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-[#007AFF]/20 rounded p-2 bg-[#007AFF]/10">
                <span className="font-semibold text-[#007AFF]">今週</span>
                <span className="text-gray-600 ml-2">7日以内の項目数</span>
              </div>
              <div className="border border-[#FF3B30]/20 rounded p-2 bg-[#FF3B30]/10">
                <span className="font-semibold text-[#FF3B30]">超過</span>
                <span className="text-gray-600 ml-2">期限を過ぎた項目数</span>
              </div>
              <div className="border border-[#34C759]/20 rounded p-2 bg-[#34C759]/10">
                <span className="font-semibold text-[#34C759]">今月</span>
                <span className="text-gray-600 ml-2">今月完了した項目数</span>
              </div>
              <div className="border border-[#AF52DE]/20 rounded p-2 bg-[#AF52DE]/10">
                <span className="font-semibold text-[#AF52DE]">累計</span>
                <span className="text-gray-600 ml-2">総完了数</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">通知設定</h4>
            <p className="text-sm text-gray-700 mb-2">
              Push 通知の有効化/無効化ができます。
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li><strong>期限当日の通知</strong>: 設定した時刻に送信</li>
              <li><strong>期限間近の通知</strong>: 3日前に送信</li>
              <li><strong>期限超過の通知</strong>: 毎日1回送信（最大7日間）</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">通知時刻変更</h4>
            <p className="text-sm text-gray-700">
              毎日のリマインド通知を送信する時刻を変更できます（00:00〜23:00、1時間単位）。
            </p>
            <p className="text-sm text-gray-600 mt-1">
              デフォルト: 09:00
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "faq",
      title: "よくある質問（FAQ）",
      icon: "❓",
      content: (
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">登録・ログイン</h4>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-gray-800">Q: 確認コードが届きません</p>
                <p className="text-gray-700 ml-4">A: メールアドレスが正しいか確認し、迷惑メールフォルダもチェックしてください。60秒待ってから「再送信」ボタンをクリックしてください。</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Q: パスワードを忘れました</p>
                <p className="text-gray-700 ml-4">A: ログイン画面の「パスワードをお忘れですか？」からリセットできます。</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">家電登録</h4>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-gray-800">Q: AI が型番を認識してくれません</p>
                <p className="text-gray-700 ml-4">A: 明るい場所で型番シールをアップで撮影し直してください。それでも失敗する場合は「手動で入力」を選択してください。</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Q: 説明書が見つかりません</p>
                <p className="text-gray-700 ml-4">A: メーカー公式サイトからダウンロードして「手動でアップロード」してください。また、メーカー名と型番をお問い合わせフォームからご連絡いただければ、対応を検討いたします。</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">メンテナンス</h4>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-gray-800">Q: 完了記録を間違えて押してしまいました</p>
                <p className="text-gray-700 ml-4">A: 現在、完了記録の取り消し機能は未実装です。履歴は残りますが、次回日が再計算されます。</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">通知</h4>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-gray-800">Q: 通知が届きません</p>
                <p className="text-gray-700 ml-4">A: マイページの「通知設定」で「許可」になっているか確認し、ブラウザ/OS の通知設定も確認してください。</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Q: 通知時刻を変更できますか？</p>
                <p className="text-gray-700 ml-4">A: はい、マイページの「通知時刻」セクションで変更できます（00:00〜23:00、1時間単位）。</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">グループ共有</h4>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-gray-800">Q: 複数のグループに参加できますか？</p>
                <p className="text-gray-700 ml-4">A: いいえ、1ユーザーは1つのグループにのみ参加できます。</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Q: 共有を解除すると家電は削除されますか？</p>
                <p className="text-gray-700 ml-4">A: いいえ、削除されません。個人所有に戻るだけです。</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "troubleshooting",
      title: "トラブルシューティング",
      icon: "🔧",
      content: (
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">アプリが起動しない</h4>
            <p className="text-sm text-gray-700 mb-2">
              <strong>症状</strong>: ページが真っ白、または読み込み中のまま
            </p>
            <p className="text-sm text-gray-700 mb-1"><strong>対処法</strong>:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li>アプリを完全に終了し、再度起動する</li>
              <li>スマホを再起動する</li>
              <li>アプリを一度削除し、再度ホーム画面に追加する</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">ログインできない</h4>
            <p className="text-sm text-gray-700 mb-2">
              <strong>症状</strong>: 「メールアドレスまたはパスワードが正しくありません」
            </p>
            <p className="text-sm text-gray-700 mb-1"><strong>対処法</strong>:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li>大文字・小文字を確認</li>
              <li>パスワードリセットを試す</li>
              <li>新規登録からやり直す</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">通知が届かない</h4>
            <p className="text-sm text-gray-700 mb-2">
              <strong>症状</strong>: メンテナンス期限なのに通知が来ない
            </p>
            <p className="text-sm text-gray-700 mb-1"><strong>対処法</strong>:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li>マイページで「通知設定」を確認</li>
              <li>ブラウザ設定で通知が許可されているか確認</li>
              <li>PWA の場合、ホーム画面から起動し直す</li>
              <li>テスト通知を送信して確認（許可ユーザーのみ）</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">PDF が開けない</h4>
            <p className="text-sm text-gray-700 mb-2">
              <strong>症状</strong>: 「説明書を開く」をタップしても何も起きない
            </p>
            <p className="text-sm text-gray-700 mb-1"><strong>対処法</strong>:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 ml-2">
              <li>アプリを再起動して再度試す</li>
              <li>Safari や Chrome でサイト（manual-agent-seven.vercel.app）を直接開いて試す</li>
            </ol>
            <p className="text-sm text-gray-600 mt-2">
              上記を試しても開けない場合は、該当の家電名をお伝えの上 <a href="https://forms.gle/ffkRYfvQVJkLG1xWA" target="_blank" rel="noopener noreferrer" className="text-[#007AFF] hover:text-[#0066DD]">お問い合わせフォーム</a> からご連絡ください。
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-24">
      {/* iOS-style Header */}
      <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">使い方ガイド</h1>
          <p className="text-sm text-gray-500">トリセツコンシェルジュの使い方を解説</p>
        </div>
      </header>

      <div className="px-4 pt-4">
        {/* Quick Links */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">クイックリンク</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link
              href="/appliances"
              className="flex items-center gap-2 text-sm text-[#007AFF] hover:text-[#0066DD] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              家電一覧
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-2 text-sm text-[#007AFF] hover:text-[#0066DD] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              家電を登録
            </Link>
            <Link
              href="/maintenance"
              className="flex items-center gap-2 text-sm text-[#007AFF] hover:text-[#0066DD] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              メンテナンス
            </Link>
            <Link
              href="/groups"
              className="flex items-center gap-2 text-sm text-[#007AFF] hover:text-[#0066DD] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              グループ
            </Link>
            <Link
              href="/mypage"
              className="flex items-center gap-2 text-sm text-[#007AFF] hover:text-[#0066DD] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              マイページ
            </Link>
            <a
              href="https://forms.gle/ffkRYfvQVJkLG1xWA"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[#007AFF] hover:text-[#0066DD] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              お問い合わせ
            </a>
          </div>
        </div>

        {/* Accordion Sections */}
        <div className="space-y-3">
          {sections.map((section) => (
            <div
              key={section.id}
              id={`section-${section.id}`}
              className="bg-white rounded-2xl shadow-sm overflow-hidden scroll-mt-20"
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{section.icon}</span>
                  <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform duration-300 ease-out ${
                    openSection === section.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openSection === section.id && (
                <div
                  className="px-5 pb-5 border-t border-gray-200 pt-5 animate-accordion-open"
                  style={{
                    animation: "accordion-open 0.3s ease-out forwards",
                  }}
                >
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 p-4 bg-white rounded-2xl shadow-sm text-center">
          <p className="text-sm text-gray-500">
            ご不明な点やご要望がございましたら、
            <a href="https://forms.gle/ffkRYfvQVJkLG1xWA" target="_blank" rel="noopener noreferrer" className="text-[#007AFF] hover:text-[#0066DD] font-medium">
              お問い合わせフォーム
            </a> からお気軽にご連絡ください。
          </p>
        </div>
      </div>
    </div>
  );
}
