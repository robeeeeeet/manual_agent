"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { GroupWithMembers, JoinGroupResponse } from "@/types/group";

export default function GroupsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showJoinConfirmModal, setShowJoinConfirmModal] = useState(false);
  const [showSwitchConfirmModal, setShowSwitchConfirmModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState("");
  const [applianceCount, setApplianceCount] = useState<number>(0);

  // Check if user is already in a group
  const hasGroup = groups.length > 0;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirectTo=/groups");
    }
  }, [authLoading, user, router]);

  // Fetch groups
  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/groups");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "グループの取得に失敗しました");
      }
      const data = await response.json();
      setGroups(data.groups || []);
    } catch (err) {
      console.error("Error fetching groups:", err);
      setError(
        err instanceof Error ? err.message : "グループの取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch appliance count
  const fetchApplianceCount = async () => {
    try {
      const response = await fetch("/api/appliances");
      if (response.ok) {
        const data = await response.json();
        setApplianceCount(data.length || 0);
      }
    } catch (err) {
      console.error("Error fetching appliance count:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchGroups();
      fetchApplianceCount();
    }
  }, [user]);

  // Create group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "グループの作成に失敗しました");
      }

      setNewGroupName("");
      setShowCreateModal(false);
      await fetchGroups();
    } catch (err) {
      console.error("Error creating group:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "グループの作成に失敗しました"
      );
      setShowErrorModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Join group - verify invite code first, then check if already in a group
  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    const code = inviteCode.trim().toUpperCase();
    setSubmitting(true);

    try {
      // First, verify the invite code is valid
      const verifyResponse = await fetch(
        `/api/groups/verify-invite/${encodeURIComponent(code)}`
      );

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        setErrorMessage(
          errorData.error || "この招待コードは無効です。コードを確認してください。"
        );
        setShowErrorModal(true);
        setSubmitting(false);
        return;
      }

      // Invite code is valid, proceed to confirmation
      setPendingJoinCode(code);
      setShowJoinModal(false);

      // Check if already in a group
      if (groups.length > 0) {
        // User is already in a group, show switch confirmation modal
        setShowSwitchConfirmModal(true);
      } else {
        // No existing group, show join confirmation modal
        setShowJoinConfirmModal(true);
      }
    } catch (err) {
      console.error("Error verifying invite code:", err);
      setErrorMessage("招待コードの確認中にエラーが発生しました");
      setShowErrorModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Execute the actual join after confirmation
  const executeJoinGroup = async (code: string) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: code }),
      });

      const data: JoinGroupResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "グループへの参加に失敗しました");
      }

      if (!data.success) {
        throw new Error(data.message || "グループへの参加に失敗しました");
      }

      setInviteCode("");
      setPendingJoinCode("");
      setShowJoinModal(false);
      setShowJoinConfirmModal(false);
      setShowSwitchConfirmModal(false);
      await fetchGroups();
      await fetchApplianceCount();
    } catch (err) {
      console.error("Error joining group:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "グループへの参加に失敗しました"
      );
      setShowErrorModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle group switch confirmation
  const handleConfirmSwitch = async () => {
    if (!pendingJoinCode || groups.length === 0) return;

    setSubmitting(true);
    try {
      // First, leave the current group
      const currentGroup = groups[0];
      const leaveResponse = await fetch(`/api/groups/${currentGroup.id}/leave`, {
        method: "POST",
      });

      if (!leaveResponse.ok) {
        const errorData = await leaveResponse.json();
        throw new Error(errorData.error || "現在のグループからの離脱に失敗しました");
      }

      // Then join the new group
      await executeJoinGroup(pendingJoinCode);
    } catch (err) {
      console.error("Error switching groups:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "グループの切替えに失敗しました"
      );
      setShowErrorModal(true);
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">グループ管理</h1>
          {/* 未参加時は中央の空状態UIにボタンを表示するため、ここでは表示しない */}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Groups list */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : groups.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  まだグループに参加していません
                </p>
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowJoinModal(true)}
                  >
                    招待コードで参加
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    新しいグループを作成
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {group.name}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {group.member_count}人のメンバー
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {group.owner_id === user.id && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                            オーナー
                          </span>
                        )}
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Back to home */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-blue-600 hover:underline">
            ホームに戻る
          </Link>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">新しいグループを作成</h2>
            <form onSubmit={handleCreateGroup}>
              <div className="mb-4">
                <label
                  htmlFor="groupName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  グループ名
                </label>
                <input
                  type="text"
                  id="groupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 山田家"
                  maxLength={50}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting || !newGroupName.trim()}
                >
                  {submitting ? "作成中..." : "作成"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">グループに参加</h2>
            <form onSubmit={handleJoinGroup}>
              <div className="mb-4">
                <label
                  htmlFor="inviteCode"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  招待コード
                </label>
                <input
                  type="text"
                  id="inviteCode"
                  value={inviteCode}
                  onChange={(e) =>
                    setInviteCode(e.target.value.toUpperCase())
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  placeholder="例: ABC123"
                  maxLength={8}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  グループのオーナーから招待コードを受け取ってください
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowJoinModal(false)}
                  disabled={submitting}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting || !inviteCode.trim()}
                >
                  {submitting ? "参加中..." : "参加"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Confirmation Modal (for first-time join) */}
      {showJoinConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-blue-600">
              グループに参加しますか？
            </h2>
            <div className="mb-6 space-y-3">
              {applianceCount > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">あなたの{applianceCount}件の家電がグループと共有されます。</span>
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    グループメンバー全員がアクセスできるようになります。
                  </p>
                </div>
              )}
              <p className="text-gray-600">
                グループに参加すると、登録済みの家電が自動的にグループメンバーと共有されます。
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowJoinConfirmModal(false);
                  setPendingJoinCode("");
                  setInviteCode("");
                }}
                disabled={submitting}
              >
                キャンセル
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => executeJoinGroup(pendingJoinCode)}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? "参加中..." : "参加する"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Group Switch Confirmation Modal */}
      {showSwitchConfirmModal && groups.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-amber-600">
              グループを切替えますか？
            </h2>
            <div className="mb-6 space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">現在のグループ:</span>{" "}
                  {groups[0].name}
                </p>
              </div>
              <p className="text-gray-600">
                新しいグループに参加すると、現在のグループから自動的に離脱します。
              </p>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">注意:</span>{" "}
                  共有中の家電は個人所有に戻ります。他のメンバーはそれらの家電にアクセスできなくなります。
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowSwitchConfirmModal(false);
                  setPendingJoinCode("");
                  setInviteCode("");
                }}
                disabled={submitting}
              >
                キャンセル
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmSwitch}
                disabled={submitting}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {submitting ? "切替え中..." : "切替える"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        variant="dialog"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">エラー</h3>
          </div>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => setShowErrorModal(false)}
            >
              閉じる
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
