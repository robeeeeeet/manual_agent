"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { isHeicFile, convertHeicToJpeg } from "@/lib/heicConverter";

type Step = 1 | 2 | 3 | 4 | 5;

export default function RegisterPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [inputMethod, setInputMethod] = useState<"image" | "manual" | null>(
    null
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    manufacturer: "",
    modelNumber: "",
    category: "",
    name: "",
  });

  // Dynamic categories - can be extended by AI
  const [categories, setCategories] = useState([
    "エアコン・空調",
    "洗濯・乾燥",
    "キッチン",
    "給湯・暖房",
    "掃除",
    "住宅設備",
    "その他",
  ]);

  const steps = [
    { number: 1, title: "入力方法選択" },
    { number: 2, title: "製品情報" },
    { number: 3, title: "説明書取得" },
    { number: 4, title: "メンテナンス" },
    { number: 5, title: "完了" },
  ];

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);

    // Check if file is HEIC/HEIF
    if (isHeicFile(file)) {
      setIsConverting(true);
      setImagePreview(null); // Clear previous preview

      try {
        const result = await convertHeicToJpeg(file);

        if (result.success && result.dataUrl) {
          setImagePreview(result.dataUrl);
        } else {
          // Fallback to placeholder if conversion fails
          setImagePreview("heic-placeholder");
          console.warn("HEIC conversion failed, using placeholder:", result.error);
        }
      } catch (error) {
        console.error("HEIC conversion error:", error);
        setImagePreview("heic-placeholder");
      } finally {
        setIsConverting(false);
      }
    } else {
      // For other image formats, create preview using FileReader
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!imageFile) return;

    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      // Send current categories to LLM for intelligent selection
      formData.append("categories", JSON.stringify(categories));

      const response = await fetch("/api/appliances/recognize", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();

        // If LLM suggested a new category, add it to the list
        if (data.is_new_category && data.category) {
          setCategories((prev) => {
            // Add before "その他" if it exists, otherwise append
            const otherIndex = prev.indexOf("その他");
            if (otherIndex >= 0) {
              const newCategories = [...prev];
              newCategories.splice(otherIndex, 0, data.category);
              return newCategories;
            }
            return [...prev, data.category];
          });
        }

        setFormData({
          manufacturer: data.manufacturer?.ja || "",
          modelNumber: data.model_number || "",
          category: data.category || "",
          name: "",
        });
        setCurrentStep(2);
      } else {
        alert("画像解析に失敗しました。手動入力をお試しください。");
      }
    } catch {
      alert("エラーが発生しました。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">家電を登録</h1>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step.number
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step.number}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-full h-1 mx-2 ${
                    currentStep > step.number ? "bg-blue-600" : "bg-gray-200"
                  }`}
                  style={{ width: "40px" }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((step) => (
            <span
              key={step.number}
              className={`text-xs ${
                currentStep >= step.number ? "text-blue-600" : "text-gray-400"
              }`}
            >
              {step.title}
            </span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <h2 className="font-bold text-gray-900">
            Step {currentStep}: {steps[currentStep - 1].title}
          </h2>
        </CardHeader>
        <CardBody>
          {/* Step 1: Input Method Selection */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-gray-600 mb-6">
                家電の登録方法を選択してください
              </p>

              <button
                className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                  inputMethod === "image"
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setInputMethod("image")}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
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
                  <div>
                    <h3 className="font-medium text-gray-900">
                      📷 写真から自動認識
                    </h3>
                    <p className="text-sm text-gray-500">
                      家電の写真からAIがメーカー・型番を読み取ります
                    </p>
                  </div>
                </div>
              </button>

              <button
                className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                  inputMethod === "manual"
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setInputMethod("manual")}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">✏️ 手動で入力</h3>
                    <p className="text-sm text-gray-500">
                      メーカー名・型番を直接入力します
                    </p>
                  </div>
                </div>
              </button>

              {inputMethod === "image" && (
                <div className="mt-6 space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {isConverting ? (
                      // HEIC変換中のローディング表示
                      <div className="py-8">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">HEIC画像を変換中...</p>
                        <p className="text-sm text-gray-400 mt-1">
                          しばらくお待ちください
                        </p>
                      </div>
                    ) : imagePreview ? (
                      <div className="space-y-4">
                        {imagePreview === "heic-placeholder" ? (
                          // HEIC変換失敗時のフォールバック表示
                          <div className="py-8">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg
                                className="w-8 h-8 text-blue-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                            </div>
                            <p className="text-gray-700 font-medium">{imageFile?.name}</p>
                            <p className="text-sm text-gray-500 mt-1">
                              HEIC形式のためプレビューできませんが、解析可能です
                            </p>
                          </div>
                        ) : (
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="max-h-64 mx-auto rounded-lg"
                          />
                        )}
                        <button
                          className="text-sm text-blue-600 hover:text-blue-700"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                          }}
                        >
                          別の画像を選択
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <div className="space-y-2">
                          <svg
                            className="w-12 h-12 text-gray-400 mx-auto"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <p className="text-gray-600">
                            クリックして画像をアップロード
                          </p>
                          <p className="text-sm text-gray-400">
                            または家電の写真を撮影
                          </p>
                        </div>
                      </label>
                    )}
                  </div>

                  {imageFile && (
                    <Button
                      onClick={handleAnalyzeImage}
                      isLoading={isAnalyzing}
                      className="w-full"
                    >
                      {isAnalyzing ? "解析中..." : "画像を解析する"}
                    </Button>
                  )}
                </div>
              )}

              {inputMethod === "manual" && (
                <div className="mt-4">
                  <Button onClick={() => setCurrentStep(2)} className="w-full">
                    次へ進む
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Product Information */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メーカー名 *
                </label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) =>
                    setFormData({ ...formData, manufacturer: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例: 日立"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  型番 *
                </label>
                <input
                  type="text"
                  value={formData.modelNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, modelNumber: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例: MRO-S7D"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  カテゴリ *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">選択してください</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  表示名（任意）
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例: リビングのオーブンレンジ"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="flex-1"
                >
                  戻る
                </Button>
                <Button
                  onClick={() => setCurrentStep(3)}
                  className="flex-1"
                  disabled={
                    !formData.manufacturer ||
                    !formData.modelNumber ||
                    !formData.category
                  }
                >
                  次へ
                </Button>
              </div>
            </div>
          )}

          {/* Step 3-5: Placeholder */}
          {currentStep >= 3 && currentStep <= 5 && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-6">
                {currentStep === 3 && "説明書の検索・取得機能（実装予定）"}
                {currentStep === 4 && "メンテナンス項目の抽出（実装予定）"}
                {currentStep === 5 && "登録完了"}
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep((currentStep - 1) as Step)}
                >
                  戻る
                </Button>
                {currentStep < 5 && (
                  <Button
                    onClick={() => setCurrentStep((currentStep + 1) as Step)}
                  >
                    次へ
                  </Button>
                )}
                {currentStep === 5 && (
                  <Link href="/">
                    <Button>ホームへ戻る</Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
