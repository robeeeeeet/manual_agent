"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
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
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-24">
      {/* iOS-style Header */}
      <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">グループ</h1>
        </div>
      </header>

      <div className="px-4 pt-4">
        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl text-[#FF3B30]">
            {error}
          </div>
        )}

        {/* Groups list */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-[#007AFF]/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-gray-500 mb-6">
                まだグループに参加していません
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="px-6 py-3 text-[#007AFF] font-semibold border-2 border-[#007AFF] rounded-xl hover:bg-[#007AFF]/5 transition-colors"
                >
                  招待コードで参加
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors"
                >
                  新しいグループを作成
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md active:bg-gray-50 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900 truncate">
                        {group.name}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {group.member_count}人のメンバー
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {group.owner_id === user.id && (
                        <span className="px-2.5 py-1 text-xs font-medium bg-[#007AFF]/10 text-[#007AFF] rounded-full">
                          オーナー
                        </span>
                      )}
                      <svg
                        className="w-5 h-5 text-gray-300"
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50"
                  placeholder="例: 山田家"
                  maxLength={50}
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  className="px-5 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newGroupName.trim()}
                  className="px-5 py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "作成中..." : "作成"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 uppercase text-center text-lg font-mono tracking-widest"
                  placeholder="例: ABC123"
                  maxLength={8}
                  required
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  グループのオーナーから招待コードを受け取ってください
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  disabled={submitting}
                  className="px-5 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting || !inviteCode.trim()}
                  className="px-5 py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "参加中..." : "参加"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Confirmation Modal (for first-time join) */}
      {showJoinConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-[#007AFF]">
              グループに参加しますか？
            </h2>
            <div className="mb-6 space-y-3">
              {applianceCount > 0 && (
                <div className="p-4 bg-[#007AFF]/10 border border-[#007AFF]/20 rounded-xl">
                  <p className="text-sm text-[#007AFF] font-medium">
                    あなたの{applianceCount}件の家電がグループと共有されます。
                  </p>
                  <p className="text-xs text-[#007AFF]/80 mt-1">
                    グループメンバー全員がアクセスできるようになります。
                  </p>
                </div>
              )}
              <p className="text-gray-600">
                グループに参加すると、登録済みの家電が自動的にグループメンバーと共有されます。
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowJoinConfirmModal(false);
                  setPendingJoinCode("");
                  setInviteCode("");
                }}
                disabled={submitting}
                className="px-5 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => executeJoinGroup(pendingJoinCode)}
                disabled={submitting}
                className="px-5 py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "参加中..." : "参加する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Switch Confirmation Modal */}
      {showSwitchConfirmModal && groups.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-[#FF9500]">
              グループを切替えますか？
            </h2>
            <div className="mb-6 space-y-3">
              <div className="p-4 bg-[#FF9500]/10 border border-[#FF9500]/20 rounded-xl">
                <p className="text-sm text-[#FF9500] font-medium">
                  現在のグループ: {groups[0].name}
                </p>
              </div>
              <p className="text-gray-600">
                新しいグループに参加すると、現在のグループから自動的に離脱します。
              </p>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">注意:</span>{" "}
                  共有中の家電は個人所有に戻ります。他のメンバーはそれらの家電にアクセスできなくなります。
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowSwitchConfirmModal(false);
                  setPendingJoinCode("");
                  setInviteCode("");
                }}
                disabled={submitting}
                className="px-5 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitch}
                disabled={submitting}
                className="px-5 py-2.5 bg-[#FF9500] text-white font-semibold rounded-xl hover:bg-[#E68600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "切替え中..." : "切替える"}
              </button>
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
            <div className="w-12 h-12 rounded-full bg-[#FF3B30]/10 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-[#FF3B30]"
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
            <button
              onClick={() => setShowErrorModal(false)}
              className="px-6 py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
