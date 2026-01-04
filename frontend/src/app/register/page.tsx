"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { isHeicFile, convertHeicToJpeg } from "@/lib/heicConverter";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import type {
  ManualSearchResponse,
  MaintenanceExtractionResponse,
  MaintenanceItem,
  ImageRecognitionResponse,
  LabelGuide,
  SharedMaintenanceItem,
  SharedMaintenanceItemList,
  PdfCandidate,
} from "@/types/appliance";

type Step = 1 | 2 | 3 | 4 | 5;

export default function RegisterPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [inputMethod, setInputMethod] = useState<"image" | "manual" | null>(
    null
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [labelGuide, setLabelGuide] = useState<LabelGuide | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    manufacturer: "",
    modelNumber: "",
    category: "",
    name: "",
  });

  // Step 3: Manual search
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [manualSearchResult, setManualSearchResult] =
    useState<ManualSearchResponse | null>(null);
  const [manualSearchError, setManualSearchError] = useState<string | null>(
    null
  );
  // SSE progress state
  interface SearchProgressState {
    main: string;
    sub: string;
    current?: number;
    total?: number;
  }
  const [searchProgress, setSearchProgress] = useState<SearchProgressState>({
    main: "検索を開始しています...",
    sub: "",
  });

  // Progress log for displaying search history
  interface ProgressLogEntry {
    id: number;
    step: string;
    message: string;
    detail: string;
    timestamp: Date;
  }
  const [progressLogs, setProgressLogs] = useState<ProgressLogEntry[]>([]);
  const progressLogIdRef = useRef(0);

  // Step 3: Manual PDF upload
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Step 3: Manual confirmation
  const [isConfirmingManual, setIsConfirmingManual] = useState(false);
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [storedPdfPath, setStoredPdfPath] = useState<string | null>(null);
  const [sharedApplianceId, setSharedApplianceId] = useState<string | null>(null);

  // Step 3: Retry search state
  const [excludedUrls, setExcludedUrls] = useState<string[]>([]);
  const [showRetryOptions, setShowRetryOptions] = useState(false);
  const [cachedCandidates, setCachedCandidates] = useState<PdfCandidate[]>([]);

  // Step 4: Maintenance extraction (legacy)
  const [isExtractingMaintenance, setIsExtractingMaintenance] = useState(false);
  const [maintenanceResult, setMaintenanceResult] =
    useState<MaintenanceExtractionResponse | null>(null);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);

  // Step 4: Maintenance items cache (new)
  const [sharedMaintenanceItems, setSharedMaintenanceItems] = useState<SharedMaintenanceItem[]>([]);
  const [isMaintenanceCached, setIsMaintenanceCached] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isFetchingMaintenanceItems, setIsFetchingMaintenanceItems] = useState(false);

  // Step 5: Saving
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedApplianceId, setSavedApplianceId] = useState<string | null>(null);

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

    if (isHeicFile(file)) {
      setIsConverting(true);
      setImagePreview(null);

      try {
        const result = await convertHeicToJpeg(file);

        if (result.success && result.dataUrl) {
          setImagePreview(result.dataUrl);
        } else {
          setImagePreview("heic-placeholder");
          console.warn(
            "HEIC conversion failed, using placeholder:",
            result.error
          );
        }
      } catch (error) {
        console.error("HEIC conversion error:", error);
        setImagePreview("heic-placeholder");
      } finally {
        setIsConverting(false);
      }
    } else {
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
    setLabelGuide(null); // Reset label guide

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("image", imageFile);
      formDataToSend.append("categories", JSON.stringify(categories));

      const response = await fetch("/api/appliances/recognize", {
        method: "POST",
        body: formDataToSend,
      });

      if (response.ok) {
        const data: ImageRecognitionResponse = await response.json();

        if (data.is_new_category && data.category) {
          setCategories((prev) => {
            const otherIndex = prev.indexOf("その他");
            if (otherIndex >= 0) {
              const newCategories = [...prev];
              newCategories.splice(otherIndex, 0, data.category);
              return newCategories;
            }
            return [...prev, data.category];
          });
        }

        // Handle status: need_label_photo (model number not detected)
        if (data.status === "need_label_photo" && data.label_guide) {
          setLabelGuide(data.label_guide);
          // Still set partial form data (manufacturer, category may be detected)
          setFormData({
            manufacturer: data.manufacturer?.ja || "",
            modelNumber: "", // Not detected
            category: data.category || "",
            name: "",
          });
          // Stay on Step 1 to show label guide and allow retake
        } else {
          // Success: model number detected
          setLabelGuide(null);
          setFormData({
            manufacturer: data.manufacturer?.ja || "",
            modelNumber: data.model_number || "",
            category: data.category || "",
            name: "",
          });
          setCurrentStep(2);
        }
      } else {
        alert("画像解析に失敗しました。手動入力をお試しください。");
      }
    } catch {
      alert("エラーが発生しました。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 3: Search for manual PDF with SSE progress
  const handleSearchManual = async (isRetry = false) => {
    setIsSearchingManual(true);
    setManualSearchError(null);
    setManualSearchResult(null);
    setShowRetryOptions(false);
    setSearchProgress({ main: isRetry ? "再検索を開始しています..." : "保存済み説明書を確認しています...", sub: "" });
    setProgressLogs([]); // Clear previous logs
    progressLogIdRef.current = 0;

    try {
      // Skip storage check on retry
      if (!isRetry) {
        // First, check if PDF already exists in storage (shared_appliances)
        const checkResponse = await fetch("/api/appliances/check-existing", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            manufacturer: formData.manufacturer,
            model_number: formData.modelNumber,
          }),
        });

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          if (checkData.found && checkData.storage_url) {
            // Found existing PDF - use it directly without searching
            console.log("Found existing PDF in storage:", checkData.storage_url);
            setManualSearchResult({
              success: true,
              pdf_url: checkData.storage_url,
              method: "existing_storage",
              reason: "保存済みの説明書PDFが見つかりました",
            });
            // Also set the stored path since we found it
            if (checkData.storage_path) {
              setStoredPdfPath(checkData.storage_path);
            }
            // Set shared_appliance_id for cache-based maintenance item fetching
            if (checkData.shared_appliance_id) {
              setSharedApplianceId(checkData.shared_appliance_id);
              console.log("Using existing shared appliance:", checkData.shared_appliance_id);
            }
            setIsSearchingManual(false);
            return;
          }
        }
      }

      // No existing PDF found - proceed with web search
      setSearchProgress({ main: isRetry ? "再検索中..." : "Web検索を開始しています...", sub: "" });

      const response = await fetch("/api/appliances/search-manual-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manufacturer: formData.manufacturer,
          model_number: formData.modelNumber,
          // For retry: exclude previously found URLs and skip domain filter
          excluded_urls: isRetry ? excludedUrls : null,
          skip_domain_filter: isRetry,
          // For retry: send cached candidates to process before new Google search
          cached_candidates: isRetry ? cachedCandidates : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setManualSearchError(errorData.error || "説明書の検索に失敗しました。");
        setIsSearchingManual(false);
        return;
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        setManualSearchError("ストリーミングレスポンスを読み取れませんでした。");
        setIsSearchingManual(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "progress") {
                // Update progress UI
                setSearchProgress({
                  main: data.message,
                  sub: data.detail,
                  current: data.current,
                  total: data.total,
                });
                // Add to progress log
                const logEntry: ProgressLogEntry = {
                  id: progressLogIdRef.current++,
                  step: data.step,
                  message: data.message,
                  detail: data.detail,
                  timestamp: new Date(),
                };
                setProgressLogs((prev) => [...prev, logEntry]);
              } else if (data.type === "result") {
                // Final result
                setManualSearchResult({
                  success: data.success,
                  pdf_url: data.pdf_url || null,
                  method: data.method || null,
                  reason: data.reason || null,
                  candidates: data.candidates || undefined,
                });
                // Cache candidates for retry search
                if (data.candidates && data.candidates.length > 0) {
                  setCachedCandidates(data.candidates);
                }
                setIsSearchingManual(false);
                return;
              } else if (data.type === "error") {
                setManualSearchError(data.message);
                setIsSearchingManual(false);
                return;
              }
            } catch (parseError) {
              console.error("Failed to parse SSE data:", parseError);
            }
          }
        }
      }

      // If we get here without a result, something went wrong
      setManualSearchError("検索が予期せず終了しました。");
    } catch (error) {
      console.error("Manual search error:", error);
      setManualSearchError("ネットワークエラーが発生しました。");
    } finally {
      setIsSearchingManual(false);
    }
  };

  // Step 3: Confirm manual PDF
  const handleConfirmManual = async () => {
    if (!manualSearchResult?.pdf_url) return;

    setIsConfirmingManual(true);

    try {
      // If PDF is from existing storage, skip API call (already saved)
      if (manualSearchResult.method === "existing_storage") {
        console.log("Using existing storage PDF, skipping confirm API call");
        setManualConfirmed(true);
        return;
      }

      // New PDF from web search - call confirm API to save to storage
      const response = await fetch("/api/appliances/confirm-manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manufacturer: formData.manufacturer,
          model_number: formData.modelNumber,
          category: formData.category,
          pdf_url: manualSearchResult.pdf_url,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setManualConfirmed(true);
        // Save storage_path for registration
        if (data.storage_path) {
          setStoredPdfPath(data.storage_path);
          console.log("PDF stored at:", data.storage_path);
        }
        // Save shared_appliance_id for maintenance items cache
        if (data.shared_appliance_id) {
          setSharedApplianceId(data.shared_appliance_id);
          console.log("Shared appliance created:", data.shared_appliance_id);
        }
      } else {
        console.error("Failed to confirm manual");
        // Still allow to proceed even if confirmation fails
        setManualConfirmed(true);
      }
    } catch (error) {
      console.error("Confirm manual error:", error);
      // Still allow to proceed even if confirmation fails
      setManualConfirmed(true);
    } finally {
      setIsConfirmingManual(false);
    }
  };

  // Step 3: Reject manual PDF and show retry options
  const handleRejectManual = () => {
    // Add current PDF URL to excluded list for retry
    if (manualSearchResult?.pdf_url) {
      setExcludedUrls((prev) => [...prev, manualSearchResult.pdf_url!]);
    }
    // Show retry options (upload or re-search)
    setShowRetryOptions(true);
  };

  // Step 3: Choose to retry search with excluded URLs
  const handleRetrySearch = () => {
    handleSearchManual(true);
  };

  // Step 3: Choose to upload PDF manually
  const handleChooseUpload = () => {
    setShowRetryOptions(false);
    setManualSearchResult({
      success: false,
      pdf_url: null,
      method: null,
      reason: null, // ユーザー選択の場合は理由を表示しない
    });
  };

  // Step 3: Handle PDF file selection
  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        alert("PDFファイルを選択してください。");
        return;
      }
      setPdfFile(file);
    }
  };

  // Step 3: Extract maintenance from uploaded PDF
  const handleExtractFromUploadedPdf = async () => {
    if (!pdfFile) return;

    setIsUploadingPdf(true);
    setMaintenanceError(null);
    setMaintenanceResult(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("pdf_file", pdfFile);
      formDataToSend.append("manufacturer", formData.manufacturer);
      formDataToSend.append("model_number", formData.modelNumber);
      formDataToSend.append("category", formData.category);

      const response = await fetch("/api/appliances/extract-maintenance", {
        method: "POST",
        body: formDataToSend,
      });

      if (response.ok) {
        const data: MaintenanceExtractionResponse = await response.json();
        setMaintenanceResult(data);
        // Set a placeholder for manual_source_url since we uploaded the PDF
        setManualSearchResult({
          success: true,
          pdf_url: null, // No URL, uploaded manually
          method: "manual_upload",
          reason: null,
        });
        setCurrentStep(4);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setMaintenanceError(
          errorData.error || "メンテナンス項目の抽出に失敗しました。"
        );
      }
    } catch (error) {
      console.error("PDF upload error:", error);
      setMaintenanceError("ネットワークエラーが発生しました。");
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Step 4: Fetch maintenance items (using cache if available)
  const handleFetchMaintenanceItems = async () => {
    if (!sharedApplianceId) {
      // Fallback to legacy extraction if no shared_appliance_id
      return handleExtractMaintenanceLegacy();
    }

    setIsFetchingMaintenanceItems(true);
    setMaintenanceError(null);
    setSharedMaintenanceItems([]);
    setSelectedItemIds(new Set());

    try {
      // Build query params
      const params = new URLSearchParams();
      if (manualSearchResult?.pdf_url) {
        params.set("pdf_url", manualSearchResult.pdf_url);
      }
      params.set("manufacturer", formData.manufacturer);
      params.set("model_number", formData.modelNumber);
      params.set("category", formData.category);

      const response = await fetch(
        `/api/appliances/maintenance-items/${sharedApplianceId}?${params.toString()}`
      );

      if (response.ok) {
        const data: SharedMaintenanceItemList = await response.json();
        setSharedMaintenanceItems(data.items);
        setIsMaintenanceCached(data.is_cached);
        // Select all items by default
        setSelectedItemIds(new Set(data.items.map((item) => item.id)));
        setCurrentStep(4);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setMaintenanceError(
          errorData.error || "メンテナンス項目の取得に失敗しました。"
        );
      }
    } catch (error) {
      console.error("Maintenance items fetch error:", error);
      setMaintenanceError("ネットワークエラーが発生しました。");
    } finally {
      setIsFetchingMaintenanceItems(false);
    }
  };

  // Legacy extraction (fallback when no shared_appliance_id)
  const handleExtractMaintenanceLegacy = async () => {
    if (!manualSearchResult?.pdf_url) return;

    setIsExtractingMaintenance(true);
    setMaintenanceError(null);
    setMaintenanceResult(null);

    try {
      const response = await fetch("/api/appliances/extract-maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdf_url: manualSearchResult.pdf_url,
          manufacturer: formData.manufacturer,
          model_number: formData.modelNumber,
          category: formData.category,
        }),
      });

      if (response.ok) {
        const data: MaintenanceExtractionResponse = await response.json();
        setMaintenanceResult(data);
        setCurrentStep(4);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setMaintenanceError(
          errorData.error || "メンテナンス項目の抽出に失敗しました。"
        );
      }
    } catch (error) {
      console.error("Maintenance extraction error:", error);
      setMaintenanceError("ネットワークエラーが発生しました。");
    } finally {
      setIsExtractingMaintenance(false);
    }
  };

  // Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Select/deselect all items
  const toggleSelectAll = () => {
    if (selectedItemIds.size === sharedMaintenanceItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(sharedMaintenanceItems.map((item) => item.id)));
    }
  };

  // Step 5: Save to Supabase
  const handleSave = async () => {
    if (!user) {
      setSaveError("ログインが必要です。");
      return;
    }

    // Get manual URL (can be empty if not found)
    const manualUrl = manualSearchResult?.pdf_url || "";

    setIsSaving(true);
    setSaveError(null);

    try {
      // Register appliance via BFF API
      const response = await fetch("/api/appliances/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name:
            formData.name ||
            `${formData.manufacturer} ${formData.modelNumber}`,
          maker: formData.manufacturer,
          model_number: formData.modelNumber,
          category: formData.category,
          manual_source_url: manualUrl || null,
          stored_pdf_path: storedPdfPath || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details ||
            errorData.error ||
            `家電の登録に失敗しました (${response.status})`
        );
      }

      const appliance = await response.json();

      // Register maintenance schedules using the new cache-based API
      if (sharedMaintenanceItems.length > 0 && selectedItemIds.size > 0) {
        const registerResponse = await fetch(
          "/api/appliances/maintenance-schedules/register",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_appliance_id: appliance.id,
              selected_item_ids: Array.from(selectedItemIds),
            }),
          }
        );

        if (!registerResponse.ok) {
          console.error("Failed to register maintenance schedules");
          // Don't throw - appliance is already saved
        }
      }
      // Legacy fallback: Insert maintenance schedules from extraction result
      else if (maintenanceResult?.maintenance_items?.length) {
        const supabase = createClient();

        if (supabase) {
          const schedules = maintenanceResult.maintenance_items.map(
            (item: MaintenanceItem) => {
              const nextDueAt = new Date();
              nextDueAt.setDate(nextDueAt.getDate() + item.frequency_days);

              return {
                user_appliance_id: appliance.id,
                task_name: item.item_name,
                description: item.description,
                interval_type:
                  item.frequency_days >= 30
                    ? ("months" as const)
                    : ("days" as const),
                interval_value:
                  item.frequency_days >= 30
                    ? Math.round(item.frequency_days / 30)
                    : item.frequency_days,
                next_due_at: nextDueAt.toISOString(),
                source_page: item.page_reference,
                importance: item.importance,
              };
            }
          );

          const { error: scheduleError } = await supabase
            .from("maintenance_schedules")
            .insert(schedules);

          if (scheduleError) {
            console.error("Schedule insert error:", scheduleError);
            // Don't throw - appliance is already saved
          }
        }
      }

      setSavedApplianceId(appliance.id);
      setCurrentStep(5);
    } catch (error) {
      console.error("Save error:", error);
      setSaveError(
        error instanceof Error ? error.message : "保存に失敗しました。"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to get category badge color
  const getCategoryBadgeColor = (category: MaintenanceItem["category"]) => {
    switch (category) {
      case "cleaning":
        return "bg-blue-100 text-blue-700";
      case "inspection":
        return "bg-yellow-100 text-yellow-700";
      case "replacement":
        return "bg-purple-100 text-purple-700";
      case "safety":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Helper function to get importance badge color
  const getImportanceBadgeColor = (importance: MaintenanceItem["importance"]) => {
    switch (importance) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Reset Step 3 state when product info changes
  useEffect(() => {
    // Reset manual search state when manufacturer or modelNumber changes
    setManualSearchResult(null);
    setManualSearchError(null);
    setPdfFile(null);
    setSearchProgress({ main: "検索を開始しています...", sub: "" });
    setManualConfirmed(false);
    setStoredPdfPath(null);
    setSharedApplianceId(null);
    // Reset retry state
    setExcludedUrls([]);
    setShowRetryOptions(false);
    setCachedCandidates([]);
    // Also reset maintenance state since it depends on the search result
    setMaintenanceResult(null);
    setMaintenanceError(null);
    setSharedMaintenanceItems([]);
    setSelectedItemIds(new Set());
    setIsMaintenanceCached(false);
  }, [formData.manufacturer, formData.modelNumber]);

  // Category label mapping
  const categoryLabels: Record<MaintenanceItem["category"], string> = {
    cleaning: "清掃",
    inspection: "点検",
    replacement: "交換",
    safety: "安全",
  };

  // Importance label mapping
  const importanceLabels: Record<MaintenanceItem["importance"], string> = {
    high: "高",
    medium: "中",
    low: "低",
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
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
                {currentStep > step.number ? (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step.number
                )}
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
                      写真から自動認識
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
                    <h3 className="font-medium text-gray-900">手動で入力</h3>
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
                      <div className="py-8">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">
                          HEIC画像を変換中...
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          しばらくお待ちください
                        </p>
                      </div>
                    ) : imagePreview ? (
                      <div className="space-y-4">
                        {imagePreview === "heic-placeholder" ? (
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
                            <p className="text-gray-700 font-medium">
                              {imageFile?.name}
                            </p>
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
                      {isAnalyzing ? "解析中..." : labelGuide ? "別の画像で再解析" : "画像を解析する"}
                    </Button>
                  )}

                  {/* Label Guide - shown when model number not detected */}
                  {labelGuide && (
                    <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-4">
                        <svg
                          className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <div>
                          <h4 className="font-medium text-amber-800">
                            型番が読み取れませんでした
                          </h4>
                          <p className="text-sm text-amber-700 mt-1">
                            {formData.manufacturer && (
                              <>メーカーは「{formData.manufacturer}」と認識しました。</>
                            )}
                            型番ラベルの写真を撮り直すか、手動で入力してください。
                          </p>
                        </div>
                      </div>

                      {/* Label Locations */}
                      <div className="bg-white rounded-lg p-3 mb-4">
                        <h5 className="font-medium text-gray-900 mb-2 text-sm">
                          📍 型番ラベルの位置
                        </h5>
                        <ul className="space-y-2">
                          {labelGuide.locations
                            .sort((a, b) => a.priority - b.priority)
                            .map((location, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm">
                                <span className="bg-amber-100 text-amber-700 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                                  {location.priority}
                                </span>
                                <div>
                                  <span className="font-medium text-gray-800">
                                    {location.position}
                                  </span>
                                  <span className="text-gray-600 ml-1">
                                    - {location.description}
                                  </span>
                                </div>
                              </li>
                            ))}
                        </ul>
                      </div>

                      {/* Photo Tips */}
                      <div className="bg-blue-50 rounded-lg p-3">
                        <h5 className="font-medium text-blue-900 mb-1 text-sm">
                          📷 撮影のコツ
                        </h5>
                        <p className="text-sm text-blue-700">
                          {labelGuide.photo_tips}
                        </p>
                      </div>

                      {/* Manual Input Option */}
                      <div className="mt-4 pt-4 border-t border-amber-200">
                        <button
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          onClick={() => {
                            setInputMethod("manual");
                            setLabelGuide(null);
                            setCurrentStep(2);
                          }}
                        >
                          型番を手動で入力する →
                        </button>
                      </div>
                    </div>
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
              {/* Image Preview */}
              {imagePreview && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    アップロードした写真
                  </p>
                  {imagePreview === "heic-placeholder" ? (
                    <div className="flex items-center gap-3 py-2">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
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
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-gray-700 font-medium">
                          {imageFile?.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          HEIC形式のためプレビューできません
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group">
                      <img
                        src={imagePreview}
                        alt="Uploaded appliance"
                        className="max-h-48 mx-auto rounded-lg cursor-pointer transition-opacity hover:opacity-90"
                        onClick={() => setIsModalOpen(true)}
                      />
                      <p className="text-xs text-gray-500 text-center mt-2">
                        クリックして拡大表示
                      </p>
                    </div>
                  )}
                </div>
              )}

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
                <p className="text-xs text-gray-500 mt-1">
                  入力しない場合は「メーカー名 型番」で表示されます
                </p>
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

          {/* Step 3: Manual Search */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">製品情報</h3>
                <p className="text-sm text-gray-600">
                  {formData.manufacturer} {formData.modelNumber}
                </p>
                <p className="text-sm text-gray-500">{formData.category}</p>
              </div>

              {!manualSearchResult && !isSearchingManual && (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-4">
                    製品の説明書を保存済みデータまたはWebから検索します。
                  </p>
                  <Button
                    onClick={() => handleSearchManual()}
                    isLoading={isSearchingManual}
                    className="w-full"
                  >
                    説明書を検索
                  </Button>
                </div>
              )}

              {isSearchingManual && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">
                    {searchProgress.main}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {searchProgress.sub}
                  </p>
                  {/* Progress bar when we have current/total */}
                  {searchProgress.total && searchProgress.total > 0 && (
                    <div className="mt-4 max-w-xs mx-auto">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${((searchProgress.current || 0) / searchProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {searchProgress.current} / {searchProgress.total}
                      </p>
                    </div>
                  )}

                  {/* Progress Log Display */}
                  {progressLogs.length > 0 && (
                    <div className="mt-6 max-w-md mx-auto">
                      <div className="bg-gray-50 rounded-lg p-3 text-left h-32 overflow-hidden relative">
                        <div className="space-y-1.5">
                          {/* Show last 4 logs with opacity gradient */}
                          {progressLogs.slice(-4).map((log, index, arr) => {
                            const reverseIndex = arr.length - 1 - index;
                            // 0: oldest (4th from end) -> opacity-30
                            // 1: 3rd from end -> opacity-60
                            // 2: 2nd from end -> opacity-80
                            // 3: newest -> opacity-100
                            const opacityClass =
                              reverseIndex === 0
                                ? "opacity-100"
                                : reverseIndex === 1
                                  ? "opacity-80"
                                  : reverseIndex === 2
                                    ? "opacity-60"
                                    : "opacity-30";

                            // Format display based on step type
                            const getStepIcon = (step: string) => {
                              switch (step) {
                                case "init":
                                  return "🔍";
                                case "domain":
                                  return "🌐";
                                case "google_search":
                                  return "🔎";
                                case "check_result":
                                case "check_page_result":
                                  return "📋";
                                case "check_snippet":
                                  return "📝";
                                case "verify_pdf":
                                case "verify_page_pdf":
                                case "verify_extracted_pdf":
                                case "deep_search_verify":
                                  return "✅";
                                case "verify_pdf_content":
                                  return "🔬";
                                case "page_search":
                                case "page_search_results":
                                  return "🌍";
                                case "page_fetch":
                                  return "📄";
                                case "llm_extract":
                                case "deep_search_extract":
                                  return "🤖";
                                case "deep_search_init":
                                case "deep_search_fetch":
                                  return "🔗";
                                default:
                                  return "•";
                              }
                            };

                            return (
                              <div
                                key={log.id}
                                className={`text-xs font-mono ${opacityClass} transition-opacity duration-300`}
                              >
                                <span className="mr-1">
                                  {getStepIcon(log.step)}
                                </span>
                                <span className="text-gray-600">
                                  {log.message}
                                </span>
                                {log.detail && (
                                  <span className="text-gray-400 ml-1">
                                    - {log.detail}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {manualSearchError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700">{manualSearchError}</p>
                  <Button
                    variant="outline"
                    onClick={() => handleSearchManual()}
                    className="mt-4"
                  >
                    再試行
                  </Button>
                </div>
              )}

              {manualSearchResult && (
                <div className="space-y-4">
                  {manualSearchResult.success && manualSearchResult.pdf_url ? (
                    <>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <svg
                            className="w-6 h-6 text-green-600 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <div>
                            <p className="font-medium text-green-700">
                              {manualSearchResult.method === "existing_storage"
                                ? "保存済みの説明書が見つかりました"
                                : "説明書が見つかりました"}
                            </p>
                            {manualSearchResult.method === "existing_storage" && (
                              <p className="text-sm text-green-600 mb-1">
                                他のユーザーが登録した説明書を利用できます
                              </p>
                            )}
                            <a
                              href={manualSearchResult.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                              説明書を開く（PDF）
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* User verification prompt */}
                      {showRetryOptions ? (
                        /* Retry options: Upload or Re-search */
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <p className="text-amber-800 font-medium mb-4">
                            違う説明書を取得する方法を選んでください
                          </p>
                          <div className="space-y-3">
                            <button
                              className="w-full p-4 border-2 rounded-lg text-left transition-colors border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                              onClick={handleRetrySearch}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <svg
                                    className="w-5 h-5 text-blue-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-900">
                                    再検索する
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    別のPDFを検索します（前回の結果は除外されます）
                                  </p>
                                </div>
                              </div>
                            </button>

                            <button
                              className="w-full p-4 border-2 rounded-lg text-left transition-colors border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                              onClick={handleChooseUpload}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <svg
                                    className="w-5 h-5 text-green-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-900">
                                    PDFを手動でアップロード
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    お手元の説明書PDFをアップロードします
                                  </p>
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>
                      ) : !manualConfirmed ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <p className="text-amber-800 font-medium mb-3">
                            上記のPDFを開いて、お使いの製品の説明書かご確認ください。
                          </p>
                          <div className="flex gap-3">
                            <Button
                              onClick={handleConfirmManual}
                              isLoading={isConfirmingManual}
                              className="flex-1"
                            >
                              {isConfirmingManual
                                ? "確認中..."
                                : "この説明書であっています"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleRejectManual}
                              disabled={isConfirmingManual}
                              className="flex-1"
                            >
                              違う説明書を探す
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-700">
                              説明書を確認しました。次のステップでメンテナンス項目を抽出します。
                            </p>
                          </div>

                          <Button
                            onClick={handleFetchMaintenanceItems}
                            isLoading={isFetchingMaintenanceItems || isExtractingMaintenance}
                            className="w-full"
                          >
                            {isFetchingMaintenanceItems || isExtractingMaintenance
                              ? "メンテナンス項目を取得中..."
                              : "次へ（メンテナンス項目を取得）"}
                          </Button>
                          {(isFetchingMaintenanceItems || isExtractingMaintenance) && (
                            <p className="text-sm text-gray-500 mt-2 text-center">
                              この処理は時間がかかる場合があります。しばらくお待ちください。
                            </p>
                          )}
                        </>
                      )}

                      {maintenanceError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <p className="text-red-700">{maintenanceError}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-yellow-700">
                          説明書が見つかりませんでした。
                          {manualSearchResult.reason && (
                            <span className="block text-sm mt-1">
                              理由: {manualSearchResult.reason}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Manual PDF Upload */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-800 mb-2">
                          📄 PDFを手動でアップロード
                        </h4>
                        <p className="text-sm text-blue-700 mb-4">
                          お持ちの説明書PDFをアップロードして、メンテナンス項目を抽出できます。
                        </p>

                        <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-white">
                          {pdfFile ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <svg
                                  className="w-8 h-8 text-red-500"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M10.92,12.31C10.68,11.54 10.15,9.08 11.55,9.04C12.95,9 12.03,12.16 12.03,12.16C12.42,13.65 14.05,14.72 14.05,14.72C14.55,14.57 17.4,14.24 17,15.72C16.57,17.2 13.5,15.81 13.5,15.81C11.55,15.95 10.09,16.47 10.09,16.47C8.96,18.58 7.64,19.5 7.1,18.61C6.43,17.5 9.23,16.07 9.23,16.07C10.68,13.72 10.92,12.31 10.92,12.31Z" />
                                </svg>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {pdfFile.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                              <button
                                className="text-sm text-blue-600 hover:text-blue-700"
                                onClick={() => setPdfFile(null)}
                              >
                                変更
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer block text-center">
                              <input
                                type="file"
                                accept="application/pdf"
                                onChange={handlePdfFileChange}
                                className="hidden"
                              />
                              <svg
                                className="w-10 h-10 text-blue-400 mx-auto mb-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                              </svg>
                              <p className="text-sm text-blue-600">
                                クリックしてPDFを選択
                              </p>
                            </label>
                          )}
                        </div>

                        {pdfFile && (
                          <Button
                            onClick={handleExtractFromUploadedPdf}
                            isLoading={isUploadingPdf}
                            className="w-full mt-4"
                          >
                            {isUploadingPdf
                              ? "メンテナンス項目を抽出中..."
                              : "PDFからメンテナンス項目を抽出"}
                          </Button>
                        )}

                        {maintenanceError && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                            <p className="text-sm text-red-700">{maintenanceError}</p>
                          </div>
                        )}
                      </div>

                      {/* Skip option */}
                      <div className="text-center pt-2">
                        <button
                          className="text-sm text-gray-500 hover:text-gray-700"
                          onClick={() => setCurrentStep(5)}
                        >
                          メンテナンス項目なしで登録を続ける →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="flex-1"
                >
                  戻る
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Maintenance Items */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* New cache-based flow with checkboxes */}
              {sharedMaintenanceItems.length > 0 ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-blue-700">
                          {sharedMaintenanceItems.length}件のメンテナンス項目が見つかりました
                        </p>
                        {isMaintenanceCached && (
                          <p className="text-sm text-blue-600 mt-1">
                            ✨ キャッシュから取得しました（高速）
                          </p>
                        )}
                      </div>
                      <button
                        onClick={toggleSelectAll}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {selectedItemIds.size === sharedMaintenanceItems.length
                          ? "すべて解除"
                          : "すべて選択"}
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600">
                    登録するメンテナンス項目を選択してください（{selectedItemIds.size}件選択中）
                  </p>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {sharedMaintenanceItems.map((item) => (
                      <label
                        key={item.id}
                        className={`block bg-white border rounded-lg p-4 shadow-sm cursor-pointer transition-colors ${
                          selectedItemIds.has(item.id)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.has(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">
                              {item.task_name}
                            </h4>
                            {item.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {item.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded ${getImportanceBadgeColor(
                                  item.importance
                                )}`}
                              >
                                重要度: {importanceLabels[item.importance]}
                              </span>
                              <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                                {item.recommended_interval_type === "days"
                                  ? `${item.recommended_interval_value}日ごと`
                                  : item.recommended_interval_type === "months"
                                    ? `${item.recommended_interval_value}ヶ月ごと`
                                    : "手動"}
                              </span>
                              {item.source_page && (
                                <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                                  📄 {item.source_page}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <Button
                    onClick={handleSave}
                    isLoading={isSaving}
                    className="w-full"
                    disabled={selectedItemIds.size === 0}
                  >
                    {isSaving
                      ? "保存中..."
                      : selectedItemIds.size > 0
                        ? `選択した${selectedItemIds.size}件を登録する`
                        : "項目を選択してください"}
                  </Button>

                  {saveError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-700">{saveError}</p>
                    </div>
                  )}
                </>
              ) : maintenanceResult ? (
                /* Legacy flow (fallback) */
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="font-medium text-blue-700">
                      {maintenanceResult.maintenance_items.length}
                      件のメンテナンス項目が抽出されました
                    </p>
                    {maintenanceResult.notes && (
                      <p className="text-sm text-blue-600 mt-1">
                        {maintenanceResult.notes}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {maintenanceResult.maintenance_items.map((item, index) => (
                      <div
                        key={index}
                        className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">
                              {item.item_name}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {item.description}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded ${getCategoryBadgeColor(
                                  item.category
                                )}`}
                              >
                                {categoryLabels[item.category]}
                              </span>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded ${getImportanceBadgeColor(
                                  item.importance
                                )}`}
                              >
                                重要度: {importanceLabels[item.importance]}
                              </span>
                              <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                                {item.frequency}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleSave}
                    isLoading={isSaving}
                    className="w-full"
                  >
                    {isSaving ? "保存中..." : "登録を完了する"}
                  </Button>

                  {saveError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-700">{saveError}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">
                    メンテナンス項目がありません。
                  </p>
                  <Button onClick={handleSave} className="mt-4">
                    登録を完了する
                  </Button>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                  className="flex-1"
                >
                  戻る
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {currentStep === 5 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                登録が完了しました！
              </h3>
              <p className="text-gray-600 mb-6">
                {formData.name ||
                  `${formData.manufacturer} ${formData.modelNumber}`}
                を登録しました。
              </p>

              {selectedItemIds.size > 0 && (
                <p className="text-sm text-gray-500 mb-6">
                  {selectedItemIds.size}件のメンテナンス項目も登録されました。
                </p>
              )}
              {!selectedItemIds.size && maintenanceResult &&
                maintenanceResult.maintenance_items.length > 0 && (
                  <p className="text-sm text-gray-500 mb-6">
                    {maintenanceResult.maintenance_items.length}
                    件のメンテナンス項目も登録されました。
                  </p>
                )}

              <div className="flex flex-col gap-3">
                <Button onClick={() => router.push("/appliances")}>
                  登録した家電を見る
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reset form and start over
                    setCurrentStep(1);
                    setInputMethod(null);
                    setImageFile(null);
                    setImagePreview(null);
                    setFormData({
                      manufacturer: "",
                      modelNumber: "",
                      category: "",
                      name: "",
                    });
                    setManualSearchResult(null);
                    setMaintenanceResult(null);
                    setSavedApplianceId(null);
                    setStoredPdfPath(null);
                    setSharedApplianceId(null);
                    setSharedMaintenanceItems([]);
                    setSelectedItemIds(new Set());
                    setIsMaintenanceCached(false);
                  }}
                >
                  続けて登録する
                </Button>
                <Link href="/">
                  <Button variant="outline" className="w-full">
                    ホームへ戻る
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Image Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {imagePreview && imagePreview !== "heic-placeholder" && (
          <img
            src={imagePreview}
            alt="Appliance full view"
            className="max-w-full max-h-[90vh] rounded-lg"
          />
        )}
      </Modal>
    </div>
  );
}
