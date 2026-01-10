"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const { resetPasswordForEmail, updatePassword, session } = useAuth();
  const router = useRouter();

  // URLにaccess_tokenがある場合（メールリンクからのアクセス）はパスワード更新モード
  useEffect(() => {
    // URLのhash（#access_token=...）をチェック
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      setIsRecoveryMode(true);
    }
    setIsCheckingSession(false);
  }, []);

  // セッションがある場合もパスワード更新モードに
  useEffect(() => {
    if (session && !isCheckingSession) {
      setIsRecoveryMode(true);
    }
  }, [session, isCheckingSession]);

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    if (!email) {
      setError("メールアドレスを入力してください");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await resetPasswordForEmail(email);
      if (error) {
        setError(error.message);
      } else {
        setIsEmailSent(true);
        setMessage("パスワードリセット用のメールを送信しました。メールに記載されたリンクをクリックしてください。");
      }
    } catch {
      setError("予期せぬエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    if (!password) {
      setError("新しいパスワードを入力してください");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await updatePassword(password);
      if (error) {
        setError(error.message);
      } else {
        setMessage("パスワードを更新しました。ログインページに移動します...");
        // 2秒後にログインページへリダイレクト
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch {
      setError("予期せぬエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  // セッションチェック中
  if (isCheckingSession) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // パスワード更新フォーム（リカバリーモード）
  if (isRecoveryMode) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="text-2xl font-bold text-center text-gray-900">
              新しいパスワードを設定
            </h1>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
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
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  新しいパスワード
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="6文字以上"
                  autoComplete="new-password"
                  disabled={isLoading || !!message}
                />
              </div>

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
                  disabled={isLoading || !!message}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isLoading}
                disabled={!!message}
              >
                パスワードを更新
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    );
  }

  // メール送信完了画面
  if (isEmailSent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="text-2xl font-bold text-center text-gray-900">
              メールを送信しました
            </h1>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {message}
              </div>
              <p className="text-sm text-gray-600 text-center">
                <strong>{email}</strong> にパスワードリセット用のメールを送信しました。
                メールが届かない場合は、迷惑メールフォルダをご確認ください。
              </p>
            </div>
          </CardBody>
          <CardFooter className="text-center">
            <Link
              href="/login"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← ログインページに戻る
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // メールアドレス入力フォーム
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold text-center text-gray-900">
            パスワードをリセット
          </h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSendResetEmail} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <p className="text-sm text-gray-600">
              登録したメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
            </p>

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

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isLoading}
            >
              リセットメールを送信
            </Button>
          </form>
        </CardBody>
        <CardFooter className="text-center">
          <Link
            href="/login"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ← ログインページに戻る
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
