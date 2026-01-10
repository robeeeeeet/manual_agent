"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
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
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

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

  // Regenerate invite code
  const handleRegenerateCode = async () => {
    if (!confirm("招待コードを再生成しますか？古いコードは使用できなくなります。"))
      return;

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
    } catch (err) {
      console.error("Error regenerating code:", err);
      alert(
        err instanceof Error
          ? err.message
          : "招待コードの再生成に失敗しました"
      );
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

  // Leave group
  const handleLeaveGroup = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/groups/${id}/leave`, {
        method: "POST",
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
    }
  };

  // Remove member
  const handleRemoveMember = async (member: GroupMember) => {
    if (
      !confirm(`${member.email} をグループから削除しますか？`)
    )
      return;

    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/groups/${id}/members/${member.user_id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "メンバーの削除に失敗しました");
      }

      await fetchGroup();
    } catch (err) {
      console.error("Error removing member:", err);
      alert(
        err instanceof Error ? err.message : "メンバーの削除に失敗しました"
      );
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
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {group.name}
                  </h1>
                  {isOwner && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                      オーナー
                    </span>
                  )}
                </div>
                <p className="text-gray-500 mt-1">
                  {group.member_count}人のメンバー
                </p>
              </div>
              {isOwner && (
                <div className="flex gap-2">
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
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-100 px-4 py-3 rounded-lg font-mono text-xl tracking-widest text-center">
                {group.invite_code}
              </div>
              <Button variant="outline" onClick={copyInviteCode}>
                {copiedCode ? "コピー完了!" : "コピー"}
              </Button>
              {isOwner && (
                <Button
                  variant="outline"
                  onClick={handleRegenerateCode}
                  disabled={submitting}
                >
                  再生成
                </Button>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-2">
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
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-medium">
                        {member.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {member.email}
                        {member.user_id === user.id && (
                          <span className="ml-2 text-xs text-gray-500">
                            (あなた)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {member.role === "owner" ? "オーナー" : "メンバー"}
                      </p>
                    </div>
                  </div>
                  {isOwner &&
                    member.user_id !== user.id &&
                    member.role !== "owner" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveMember(member)}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-red-600">
              グループを削除
            </h2>
            <p className="text-gray-600 mb-4">
              本当にこのグループを削除しますか？
              グループの家電はあなたの個人所有に移管されます。
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">グループを退出</h2>
            <p className="text-gray-600 mb-4">
              本当にこのグループを退出しますか？
              グループの家電にはアクセスできなくなります。
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
                onClick={handleLeaveGroup}
                disabled={submitting}
              >
                {submitting ? "退出中..." : "退出"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
