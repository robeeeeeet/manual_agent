"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { GroupWithMembers, GroupMember } from "@/types/group";

interface GroupDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showLeaveApplianceModal, setShowLeaveApplianceModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [showRegenerateCodeModal, setShowRegenerateCodeModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [leaveWithAppliances, setLeaveWithAppliances] = useState<boolean | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirectTo=/groups/${id}`);
    }
  }, [authLoading, user, router, id]);

  // Fetch group details
  const fetchGroup = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/groups/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("グループが見つかりません");
        }
        if (response.status === 403) {
          throw new Error("このグループへのアクセス権がありません");
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "グループの取得に失敗しました");
      }
      const data = await response.json();
      setGroup(data);
      setNewName(data.name);
    } catch (err) {
      console.error("Error fetching group:", err);
      setError(
        err instanceof Error ? err.message : "グループの取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchGroup();
    }
  }, [user, id]);

  // Check if current user is owner
  const isOwner = group?.owner_id === user?.id;

  // Copy invite code to clipboard
  const copyInviteCode = async () => {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Show regenerate code confirmation
  const handleRegenerateCodeClick = () => {
    setShowRegenerateCodeModal(true);
  };

  // Regenerate invite code
  const handleRegenerateCode = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/groups/${id}/regenerate-code`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "招待コードの再生成に失敗しました"
        );
      }

      const data = await response.json();
      if (group) {
        setGroup({ ...group, invite_code: data.invite_code });
      }
      setShowRegenerateCodeModal(false);
      window.location.reload();
    } catch (err) {
      console.error("Error regenerating code:", err);
      // Stay on modal but show error could be added
    } finally {
      setSubmitting(false);
    }
  };

  // Update group name
  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "グループの更新に失敗しました");
      }

      const data = await response.json();
      setGroup((prev) => (prev ? { ...prev, name: data.name } : null));
      setShowEditModal(false);
      window.location.reload();
    } catch (err) {
      console.error("Error updating group:", err);
      alert(
        err instanceof Error ? err.message : "グループの更新に失敗しました"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Delete group
  const handleDeleteGroup = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/groups/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "グループの削除に失敗しました");
      }

      router.push("/groups");
    } catch (err) {
      console.error("Error deleting group:", err);
      alert(
        err instanceof Error ? err.message : "グループの削除に失敗しました"
      );
    } finally {
      setSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Show leave appliance choice modal
  const handleLeaveClick = () => {
    setShowLeaveConfirm(false);
    setShowLeaveApplianceModal(true);
  };

  // Leave group
  const handleLeaveGroup = async (keepAppliances: boolean) => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/groups/${id}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep_appliances: keepAppliances }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "グループからの退出に失敗しました");
      }

      router.push("/groups");
    } catch (err) {
      console.error("Error leaving group:", err);
      alert(
        err instanceof Error
          ? err.message
          : "グループからの退出に失敗しました"
      );
    } finally {
      setSubmitting(false);
      setShowLeaveConfirm(false);
      setShowLeaveApplianceModal(false);
    }
  };

  // Show remove member confirmation
  const handleRemoveMemberClick = (member: GroupMember) => {
    setMemberToRemove(member);
    setShowRemoveMemberModal(true);
  };

  // Remove member
  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/groups/${id}/members/${memberToRemove.user_id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "メンバーの削除に失敗しました");
      }

      setShowRemoveMemberModal(false);
      setMemberToRemove(null);
      window.location.reload();
    } catch (err) {
      console.error("Error removing member:", err);
      // Stay on modal but show error could be added
    } finally {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
            {error || "グループが見つかりません"}
          </div>
          <Link href="/groups" className="text-blue-600 hover:underline">
            グループ一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Breadcrumb */}
        <div className="mb-4">
          <Link href="/groups" className="text-blue-600 hover:underline">
            グループ一覧
          </Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-600">{group.name}</span>
        </div>

        {/* Group Header */}
        <Card className="mb-6">
          <CardBody>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                    {group.name}
                  </h1>
                  {isOwner && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full whitespace-nowrap">
                      オーナー
                    </span>
                  )}
                </div>
                <p className="text-gray-500 mt-1 text-sm">
                  {group.member_count}人のメンバー
                </p>
              </div>
              {isOwner && (
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditModal(true)}
                  >
                    編集
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    削除
                  </Button>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Invite Code Section */}
        <Card className="mb-6">
          <CardBody>
            <h2 className="text-lg font-semibold mb-3">招待コード</h2>
            <div className="bg-gray-100 px-4 py-4 rounded-lg font-mono text-2xl tracking-widest text-center mb-3">
              {group.invite_code}
            </div>
            <div className="grid grid-cols-2 gap-2 relative">
              <div className="relative">
                <Button variant="outline" onClick={copyInviteCode} className="w-full">
                  コピー
                </Button>
                {/* Copy success popup */}
                {copiedCode && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-lg shadow-lg whitespace-nowrap z-50 animate-tooltip-fade-in">
                    コピーしました!
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-800" />
                  </div>
                )}
              </div>
              {isOwner ? (
                <Button
                  variant="outline"
                  onClick={handleRegenerateCodeClick}
                  disabled={submitting}
                  className="w-full"
                >
                  再生成
                </Button>
              ) : (
                <div />
              )}
            </div>
            <p className="text-sm text-gray-500 mt-3 text-center">
              このコードを家族に共有すると、グループに参加できます
            </p>
          </CardBody>
        </Card>

        {/* Members List */}
        <Card className="mb-6">
          <CardBody>
            <h2 className="text-lg font-semibold mb-3">メンバー</h2>
            <div className="space-y-3">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-gray-600 font-medium">
                        {(member.display_name || member.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                        {member.display_name || member.email}
                      </p>
                      {member.display_name && (
                        <p className="text-xs text-gray-500 truncate">
                          {member.email}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {member.user_id === group.owner_id ? "オーナー" : "メンバー"}
                        {member.user_id === user.id && " / あなた"}
                      </p>
                    </div>
                  </div>
                  {isOwner &&
                    member.user_id !== user.id &&
                    member.user_id !== group.owner_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => handleRemoveMemberClick(member)}
                        disabled={submitting}
                      >
                        削除
                      </Button>
                    )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Leave Group (for non-owners) */}
        {!isOwner && (
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    グループを退出
                  </h2>
                  <p className="text-sm text-gray-500">
                    このグループのメンバーから外れます
                  </p>
                </div>
                <Button
                  variant="danger"
                  onClick={() => setShowLeaveConfirm(true)}
                >
                  退出
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link href="/groups" className="text-blue-600 hover:underline">
            グループ一覧に戻る
          </Link>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">グループ名を変更</h2>
            <form onSubmit={handleUpdateGroup}>
              <div className="mb-4">
                <label
                  htmlFor="newName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  グループ名
                </label>
                <input
                  type="text"
                  id="newName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={50}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  disabled={submitting}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting || !newName.trim()}
                >
                  {submitting ? "保存中..." : "保存"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-red-600">
              グループを削除
            </h2>
            <p className="text-gray-600 mb-4">
              本当にこのグループを削除しますか？
              共有されていた家電は、それぞれの登録者（元のオーナー）の個人所有に戻ります。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={submitting}
              >
                キャンセル
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteGroup}
                disabled={submitting}
              >
                {submitting ? "削除中..." : "削除"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirm Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">グループを退出</h2>
            <p className="text-gray-600 mb-4">
              本当にこのグループを退出しますか？
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowLeaveConfirm(false)}
                disabled={submitting}
              >
                キャンセル
              </Button>
              <Button
                variant="danger"
                onClick={handleLeaveClick}
                disabled={submitting}
              >
                次へ
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Leave with Appliance Choice Modal */}
      {showLeaveApplianceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-amber-600">
              家電のコピーを作成しますか？
            </h2>
            <div className="mb-6 space-y-3">
              <p className="text-gray-600">
                グループの家電データは退出後もグループに残ります。
              </p>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-1">
                  はい（コピーを作成）
                </p>
                <p className="text-xs text-blue-700">
                  退出前にグループ家電のコピーを自分用に作成します。
                </p>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm font-medium text-gray-800 mb-1">
                  いいえ（コピーしない）
                </p>
                <p className="text-xs text-gray-700">
                  コピーを作成せずに退出します。家電データへのアクセス権を失います。
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                onClick={() => handleLeaveGroup(true)}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? "退出中..." : "はい"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleLeaveGroup(false)}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? "退出中..." : "いいえ"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowLeaveApplianceModal(false);
                  setShowLeaveConfirm(true);
                }}
                disabled={submitting}
                className="w-full text-gray-600"
              >
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Modal */}
      <Modal
        isOpen={showRemoveMemberModal}
        onClose={() => {
          setShowRemoveMemberModal(false);
          setMemberToRemove(null);
        }}
        variant="dialog"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            メンバーを削除
          </h3>
          <p className="text-gray-600 mb-4">
            {memberToRemove?.email} をグループから削除しますか？
          </p>
          <p className="text-sm text-gray-500 mb-6">
            削除されたメンバーは、グループの家電にアクセスできなくなります。
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowRemoveMemberModal(false);
                setMemberToRemove(null);
              }}
              disabled={submitting}
            >
              キャンセル
            </Button>
            <Button
              variant="danger"
              onClick={handleRemoveMember}
              disabled={submitting}
            >
              {submitting ? "削除中..." : "削除"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Regenerate Code Modal */}
      <Modal
        isOpen={showRegenerateCodeModal}
        onClose={() => setShowRegenerateCodeModal(false)}
        variant="dialog"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            招待コードを再生成
          </h3>
          <p className="text-gray-600 mb-4">
            新しい招待コードを生成しますか？
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6">
            <p className="text-sm text-amber-800">
              <span className="font-medium">注意:</span>{" "}
              古い招待コードは使用できなくなります。既にグループに参加しているメンバーには影響ありません。
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowRegenerateCodeModal(false)}
              disabled={submitting}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={handleRegenerateCode}
              disabled={submitting}
            >
              {submitting ? "再生成中..." : "再生成"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
