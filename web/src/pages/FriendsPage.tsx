import { useState } from "react";
import { Link } from "react-router-dom";
import { useFriends } from "../hooks/useFriends";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import Avatar from "../components/Avatar";

export default function FriendsPage() {
  const { user } = useAuth();
  const { friends, requests, friendCode, loading, actionLoading, addByCode, acceptRequest, declineRequest, removeFriend } = useFriends();
  const { showToast } = useToast();
  const [codeInput, setCodeInput] = useState("");
  const [tab, setTab] = useState<"friends" | "requests">("friends");

  if (!user) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        친구 목록을 보려면 로그인이 필요합니다.
      </div>
    );
  }

  const handleAddByCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    try {
      const result = await addByCode(code);
      if (result?.alreadyFriends) {
        showToast("이미 친구입니다");
      } else if (result?.success) {
        showToast(`${result.friendNickname || "친구"}님이 추가되었습니다`);
      }
      setCodeInput("");
    } catch (err: any) {
      const msg = err?.message || "친구 추가에 실패했습니다";
      if (msg.includes("찾을 수 없")) {
        showToast("해당 친구코드의 사용자를 찾을 수 없습니다");
      } else if (msg.includes("자기 자신")) {
        showToast("자기 자신을 친구로 추가할 수 없습니다");
      } else {
        showToast(msg);
      }
    }
  };

  const handleAccept = async (requesterId: string) => {
    try {
      await acceptRequest(requesterId);
      showToast("친구 요청을 수락했습니다");
    } catch {
      showToast("수락에 실패했습니다");
    }
  };

  const handleDecline = async (requesterId: string) => {
    try {
      await declineRequest(requesterId);
      showToast("친구 요청을 거절했습니다");
    } catch {
      showToast("거절에 실패했습니다");
    }
  };

  const handleRemove = async (friendId: string, nickname: string) => {
    if (!window.confirm(`${nickname}님을 친구에서 삭제하시겠습니까?`)) return;
    try {
      await removeFriend(friendId);
      showToast("친구가 삭제되었습니다");
    } catch {
      showToast("삭제에 실패했습니다");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">친구</h1>

      {/* Friend code + add by code */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        {friendCode && (
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">내 친구코드</span>
            <span className="font-mono font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-lg text-lg">
              {friendCode}
            </span>
            <button
              onClick={() => { navigator.clipboard.writeText(friendCode); showToast("복사되었습니다"); }}
              className="text-gray-400 hover:text-orange-500 transition-colors"
              title="복사"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleAddByCode();
              }
            }}
            placeholder="친구코드를 입력하세요"
            className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-orange-400 dark:bg-gray-900 dark:text-gray-50"
          />
          <button
            onClick={handleAddByCode}
            disabled={actionLoading || !codeInput.trim()}
            className={`px-5 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50 ${actionLoading ? 'cursor-wait' : ''}`}
          >
            {actionLoading ? (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                추가 중...
              </span>
            ) : '추가'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab("friends")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "friends"
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          친구 ({friends.length})
        </button>
        <button
          onClick={() => setTab("requests")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors relative ${
            tab === "requests"
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          요청 ({requests.length})
          {requests.length > 0 && tab !== "requests" && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-orange-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* Friend list */}
      {tab === "friends" && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              아직 친구가 없습니다. 친구코드로 추가해보세요!
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {friends.map((f) => (
                <div key={f.userId} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <Link to={`/athlete/${f.userId}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar name={f.nickname} imageUrl={f.profileImage} size="md" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate block">{f.nickname}</span>
                      {f.friendCode && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">{f.friendCode}</span>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => handleRemove(f.userId, f.nickname)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0 px-2 py-1"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Friend requests */}
      {tab === "requests" && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {requests.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              받은 친구 요청이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {requests.map((r) => (
                <div key={r.requesterId} className="px-4 py-3 flex items-center gap-3">
                  <Link to={`/athlete/${r.requesterId}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar name={r.nickname} imageUrl={r.profileImage} size="md" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{r.nickname}</span>
                  </Link>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAccept(r.requesterId)}
                      disabled={actionLoading}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50 ${actionLoading ? 'cursor-wait' : ''}`}
                    >
                      {actionLoading ? '수락 중...' : '수락'}
                    </button>
                    <button
                      onClick={() => handleDecline(r.requesterId)}
                      disabled={actionLoading}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 ${actionLoading ? 'cursor-wait' : ''}`}
                    >
                      {actionLoading ? '거절 중...' : '거절'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
