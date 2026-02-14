import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { collection, addDoc } from "firebase/firestore";
import { firestore } from "../services/firebase";

type FeedbackType = "bug" | "feature" | "question" | "other";

const TYPES: { value: FeedbackType; label: string; icon: string; desc: string }[] = [
  { value: "bug", label: "버그 신고", icon: "🐛", desc: "정상 작동하지 않는 기능이 있어요" },
  { value: "feature", label: "기능 요청", icon: "💡", desc: "이런 기능이 있으면 좋겠어요" },
  { value: "question", label: "문의", icon: "❓", desc: "사용법이나 궁금한 점이 있어요" },
  { value: "other", label: "기타", icon: "💬", desc: "그 외 하고 싶은 말" },
];

export default function FeedbackPage() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, "feedback"), {
        type,
        title: title.trim(),
        body: body.trim(),
        userId: user?.uid ?? null,
        nickname: profile?.nickname ?? user?.displayName ?? "익명",
        email: user?.email ?? null,
        userAgent: navigator.userAgent,
        url: window.location.href,
        createdAt: Date.now(),
        status: "open",
      });
      setSubmitted(true);
      showToast("소중한 의견이 전달되었습니다. 감사합니다!");
    } catch {
      showToast("전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setTitle("");
    setBody("");
    setSubmitted(false);
    setType("bug");
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-6">
        <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <span className="text-4xl">🙏</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">감사합니다!</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            소중한 의견이 개발팀에 전달되었습니다.<br />
            더 나은 O-Rider를 만드는 데 큰 도움이 됩니다.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="px-6 py-2.5 text-sm font-medium rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          추가 의견 보내기
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto pb-20 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          피드백 보내기
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          O-Rider는 아직 초기 단계입니다. 버그 신고, 기능 요청, 어떤 의견이든 환영합니다!
        </p>
      </div>

      {/* Type Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
              type === t.value
                ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10"
                : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
            }`}
          >
            <span className="text-2xl">{t.icon}</span>
            <span className={`text-xs font-bold ${type === t.value ? "text-orange-600 dark:text-orange-400" : "text-gray-700 dark:text-gray-300"}`}>
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-gray-900 dark:text-white">제목</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={type === "bug" ? "어떤 문제가 발생했나요?" : type === "feature" ? "어떤 기능이 필요한가요?" : "제목을 입력해주세요"}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/30 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 transition-all"
            maxLength={100}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-gray-900 dark:text-white">내용</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={
              type === "bug"
                ? "어떤 상황에서 문제가 발생했는지, 어떤 동작을 기대했는지 자세히 알려주세요."
                : type === "feature"
                ? "원하시는 기능과 그 이유를 자세히 알려주세요."
                : "자유롭게 의견을 작성해주세요."
            }
            rows={6}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/30 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 resize-none transition-all"
            maxLength={2000}
          />
          <div className="text-right text-xs text-gray-400">{body.length}/2000</div>
        </div>

        {!user && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg px-3 py-2:text-xs text-amber-700 dark:text-amber-300 text-xs">
            💡 로그인하면 답변을 받으실 수 있습니다. 로그인 없이도 제출 가능합니다.
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !title.trim() || !body.trim()}
        className={`w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 ${submitting ? 'cursor-wait' : ''}`}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            전송 중...
          </span>
        ) : '의견 보내기'}
      </button>

      {/* Info box */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>• 제출하신 피드백은 개발팀이 직접 확인합니다.</p>
        <p>• 긴급한 문의는 <strong className="text-gray-700 dark:text-gray-300">orider.app@gmail.com</strong>으로 보내주세요.</p>
        <p>• 브라우저/기기 정보가 자동으로 포함되어 버그 해결에 도움이 됩니다.</p>
      </div>
    </div>
  );
}
