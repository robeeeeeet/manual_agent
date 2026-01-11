import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";

export const metadata = {
  title: "新規登録 - トリセツコンシェルジュ",
  description: "トリセツコンシェルジュの新規アカウント作成",
};

function SignupFormFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFormFallback />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
