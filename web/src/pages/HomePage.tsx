export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">O-Rider Platform</h1>
      <p className="text-gray-600">
        그룹 라이딩 대시보드, 세그먼트 리더보드, 활동 피드
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-lg mb-2">그룹 대시보드</h2>
          <p className="text-sm text-gray-500">
            그룹 라이딩 기록을 모아보고, 멤버별 성과를 비교합니다.
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-lg mb-2">세그먼트</h2>
          <p className="text-sm text-gray-500">
            구간별 리더보드와 KOM/QOM을 확인합니다.
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-lg mb-2">활동 피드</h2>
          <p className="text-sm text-gray-500">
            친구들의 라이딩 기록, 좋아요, 댓글을 확인합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
