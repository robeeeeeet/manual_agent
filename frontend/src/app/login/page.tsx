import AuthForm from "@/components/auth/AuthForm";

export const metadata = {
  title: "ログイン - 説明書管理アプリ",
  description: "説明書管理アプリにログイン",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
