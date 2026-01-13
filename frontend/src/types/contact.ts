/**
 * お問い合わせ関連の型定義
 */

// お問い合わせ種類
export type ContactType = "feature_request" | "bug_report" | "other";

// 画面種類
export type ContactScreen =
  | "register" // 家電登録
  | "appliance_list" // 家電一覧
  | "appliance_detail" // 家電詳細
  | "maintenance" // メンテナンス一覧
  | "qa" // QA機能
  | "groups" // グループ
  | "mypage" // マイページ
  | "other"; // その他

// フォームデータ
export interface ContactFormData {
  type: ContactType | "";
  screen: ContactScreen | "";
  content: string;
  reproductionSteps: string;
}

// APIレスポンス
export interface ContactResponse {
  success: boolean;
  message: string;
}

// 選択肢ラベル（日本語表示用）
export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  feature_request: "機能リクエスト",
  bug_report: "バグ報告",
  other: "その他",
};

export const CONTACT_SCREEN_LABELS: Record<ContactScreen, string> = {
  register: "家電登録",
  appliance_list: "家電一覧",
  appliance_detail: "家電詳細",
  maintenance: "メンテナンス一覧",
  qa: "QA機能",
  groups: "グループ",
  mypage: "マイページ",
  other: "その他",
};

// 選択肢配列（セレクトボックス用）
export const CONTACT_TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: "feature_request", label: "機能リクエスト" },
  { value: "bug_report", label: "バグ報告" },
  { value: "other", label: "その他" },
];

export const CONTACT_SCREEN_OPTIONS: { value: ContactScreen; label: string }[] =
  [
    { value: "register", label: "家電登録" },
    { value: "appliance_list", label: "家電一覧" },
    { value: "appliance_detail", label: "家電詳細" },
    { value: "maintenance", label: "メンテナンス一覧" },
    { value: "qa", label: "QA機能" },
    { value: "groups", label: "グループ" },
    { value: "mypage", label: "マイページ" },
    { value: "other", label: "その他" },
  ];
