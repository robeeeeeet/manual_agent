"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";

interface AuthFormProps {
  mode: "login" | "signup";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const { signIn, signUp, verifyOtp, resendOtp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  const isLogin = mode === "login";
  const title = isLogin ? "ログイン" : "新規登録";
  const submitText = isLogin ? "ログイン" : "アカウント作成";
  const switchText = isLogin
    ? "アカウントをお持ちでない方"
    : "すでにアカウントをお持ちの方";
  const baseSwitchLink = isLogin ? "/signup" : "/login";
  const switchLink =
    redirectTo !== "/" ? `${baseSwitchLink}?redirectTo=${encodeURIComponent(redirectTo)}` : baseSwitchLink;
  const switchLinkText = isLogin ? "新規登録" : "ログイン";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    // バリデーション
    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください");
      setIsLoading(false);
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError("パスワードが一致しません");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setError("メールアドレスまたはパスワードが正しくありません");
          } else {
            setError(error.message);
          }
        } else {
          // ログイン成功: フルスクリーンローディングを表示してから遷移
          // これによりヘッダーの状態変化とページ遷移のタイミングのずれを隠す
          setIsNavigating(true);
          router.push(redirectTo);
          router.refresh();
          return; // isLoadingをfalseにしない（ナビゲーション中のため）
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes("already registered")) {
            setError("このメールアドレスは既に登録されています");
          } else {
            setError(error.message);
          }
        } else {
          setMessage(
            "確認コードをメールで送信しました。メールに記載されたコードを入力してください。既にアカウントをお持ちの場合は、ログインページからサインインしてください。"
          );
          setShowOtpForm(true);
        }
      }
    } catch {
      setError("予期せぬエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!otpCode || otpCode.length < 6 || otpCode.length > 8) {
      setError("確認コードを入力してください");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await verifyOtp(email, otpCode);
      if (error) {
        if (error.message.includes("expired")) {
          setError("確認コードの有効期限が切れています。もう一度登録してください。");
        } else if (error.message.includes("invalid")) {
          setError("確認コードが正しくありません");
        } else {
          setError(error.message);
        }
      } else {
        // Set flag to show notification modal after redirect
        sessionStorage.setItem("showNotificationOnboarding", "true");
        // サインアップ成功: フルスクリーンローディングを表示してから遷移
        setIsNavigating(true);
        router.push(redirectTo);
        router.refresh();
        return; // isLoadingをfalseにしない
      }
    } catch {
      setError("予期せぬエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  // クールダウンタイマー
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await resendOtp(email);

      if (error) {
        // Supabaseのレート制限エラーから秒数を抽出
        const secondsMatch = error.message.match(/after (\d+) seconds/);
        if (secondsMatch) {
          const seconds = parseInt(secondsMatch[1], 10);
          setResendCooldown(seconds);
          // エラーではなくメッセージとして表示（カウントダウン中）
        } else if (error.message.includes("rate limit") || error.message.includes("security purposes")) {
          setError("送信回数の上限に達しました。しばらく待ってから再試行してください。");
        } else {
          setError(error.message);
        }
      } else {
        setMessage("確認コードを再送しました。メールをご確認ください。");
        setResendCooldown(60);
      }
    } catch {
      setError("予期せぬエラーが発生しました");
    } finally {
      setIsResending(false);
    }
  };

  // ログイン後の遷移中はフルスクリーンローディングを表示
  if (isNavigating) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">ログイン中...</p>
        </div>
      </div>
    );
  }

  // OTPコード入力フォーム
  if (showOtpForm) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="text-2xl font-bold text-center text-gray-900">
              確認コードを入力
            </h1>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              {message && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  {message}
                </div>
              )}

              <p className="text-sm text-gray-600 text-center">
                <strong>{email}</strong> に送信された確認コードを入力してください
              </p>

              <p className="text-sm text-gray-500 text-center">
                既にアカウントをお持ちの場合は{" "}
                <Link
                  href={redirectTo !== "/" ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login"}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  ログイン
                </Link>
              </p>

              <div>
                <label
                  htmlFor="otpCode"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  確認コード
                </label>
                <input
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-4 py-3 text-center text-2xl tracking-[0.3em] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="00000000"
                  autoComplete="one-time-code"
                  disabled={isLoading}
                />
              </div>

              <div className="text-center space-y-1">
                {resendCooldown > 0 && !message && (
                  <p className="text-sm text-gray-500">
                    あと {resendCooldown} 秒で再送できます
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending || resendCooldown > 0}
                  className="text-sm text-blue-600 hover:text-blue-500 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isResending
                    ? "送信中..."
                    : resendCooldown > 0
                      ? "コードを再送する"
                      : "コードを再送する"}
                </button>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isLoading}
              >
                確認する
              </Button>
            </form>
          </CardBody>
          <CardFooter className="text-center">
            <button
              type="button"
              onClick={() => {
                setShowOtpForm(false);
                setOtpCode("");
                setMessage(null);
                setError(null);
              }}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ← 登録画面に戻る
            </button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold text-center text-gray-900">
            {title}
          </h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {message}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="example@email.com"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="6文字以上"
                autoComplete={isLogin ? "current-password" : "new-password"}
                disabled={isLoading}
              />
              {isLogin && (
                <div className="mt-2 text-right">
                  <Link
                    href="/reset-password"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    パスワードを忘れた方
                  </Link>
                </div>
              )}
            </div>

            {!isLogin && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  パスワード（確認）
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="パスワードを再入力"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isLoading}
            >
              {submitText}
            </Button>
          </form>
        </CardBody>
        <CardFooter className="text-center">
          <p className="text-sm text-gray-600">
            {switchText}{" "}
            <Link
              href={switchLink}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {switchLinkText}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
