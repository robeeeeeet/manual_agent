import AuthForm from "@/components/auth/AuthForm";

export const metadata = {
  title: "新規登録 - 説明書管理アプリ",
  description: "説明書管理アプリの新規アカウント作成",
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
