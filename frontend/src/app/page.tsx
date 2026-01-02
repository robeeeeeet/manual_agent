import Link from "next/link";
import Button from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <section className="text-center py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          説明書管理 & メンテナンスリマインド
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          家電や住宅設備の説明書を管理し、
          <br className="hidden sm:inline" />
          メンテナンス項目を自動でリマインドします
        </p>
        <Link href="/register">
          <Button size="lg">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            家電を登録する
          </Button>
        </Link>
      </section>

      {/* Features */}
      <section className="py-8">
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardBody className="text-center py-8">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">AI画像認識</h3>
              <p className="text-sm text-gray-600">
                写真からメーカー・型番を自動認識
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-center py-8">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">説明書自動取得</h3>
              <p className="text-sm text-gray-600">
                公式PDFを自動で検索・保存
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-center py-8">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">リマインド通知</h3>
              <p className="text-sm text-gray-600">
                メンテナンス時期をPush通知でお知らせ
              </p>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* Appliance List */}
      <section className="py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">登録済みの家電</h2>
        </div>

        {/* Empty State */}
        <Card>
          <CardBody className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 mb-2">
              まだ家電が登録されていません
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              家電を登録して、メンテナンス管理を始めましょう
            </p>
            <Link href="/register">
              <Button variant="outline">家電を登録する</Button>
            </Link>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
