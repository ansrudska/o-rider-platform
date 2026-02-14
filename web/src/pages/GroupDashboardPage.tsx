import { Link } from "react-router-dom";

export default function GroupDashboardPage() {
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-4">👥</div>
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">그룹 대시보드</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        그룹 기능은 준비 중입니다.
      </p>
      <Link to="/" className="inline-block mt-4 text-sm text-orange-600 hover:underline">
        홈으로 돌아가기
      </Link>
    </div>
  );
}
