export default function CommunityGuidelinesPage() {
  return (
    <div className="max-w-2xl mx-auto pb-20 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">O-Rider 커뮤니티 가이드라인</h1>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        O-Rider는 건강한 라이딩 문화를 위한 플랫폼입니다. 모든 이용자는 다음 기준을 준수해야 합니다.
      </p>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
        <Section title="1. 존중과 배려">
          <ul className="list-disc list-inside space-y-1.5">
            <li>타인에 대한 비방, 욕설, 혐오 표현 금지</li>
            <li>인종, 성별, 지역, 신체 조건 등에 대한 차별 금지</li>
          </ul>
        </Section>

        <Section title="2. 안전한 콘텐츠">
          <ul className="list-disc list-inside space-y-1.5">
            <li>폭력적, 음란한 콘텐츠 게시 금지</li>
            <li>타인의 개인정보 무단 공개 금지</li>
            <li>허위 기록, 조작된 데이터 게시 금지</li>
          </ul>
        </Section>

        <Section title="3. 저작권 및 초상권">
          <ul className="list-disc list-inside space-y-1.5">
            <li>타인의 사진, 영상, 기록을 무단 게시 금지</li>
            <li>상업적 이용을 위한 무단 복제 금지</li>
          </ul>
        </Section>

        <Section title="4. 공정한 리더보드">
          <ul className="list-disc list-inside space-y-1.5">
            <li>GPS 조작, 기록 위조, 비정상 데이터 업로드 금지</li>
            <li>자동화 도구를 통한 순위 조작 금지</li>
          </ul>
        </Section>

        <Section title="5. 제재 정책">
          <p className="mb-2">위반 시 다음 조치가 이루어질 수 있습니다.</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>콘텐츠 삭제</li>
            <li>일시 정지</li>
            <li>영구 정지</li>
          </ul>
          <p className="mt-2">중대한 위반의 경우 즉시 계정이 정지될 수 있습니다.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 sm:p-6">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
      <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {children}
      </div>
    </div>
  );
}
