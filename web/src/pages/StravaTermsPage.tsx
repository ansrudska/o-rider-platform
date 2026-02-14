export default function StravaTermsPage() {
  return (
    <div className="max-w-2xl mx-auto pb-20 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Strava 데이터 마이그레이션 및 연동 특약</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">본 특약은 O-Rider 이용약관의 일부를 구성합니다.</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
        <Section title="제1조 (목적)">
          <p>본 특약은 이용자가 Strava 데이터를 O-Rider로 가져오는 기능과 관련된 권리 및 책임을 규정합니다.</p>
        </Section>

        <Section title="제2조 (연동 방식)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>연동은 OAuth 인증을 통해 이루어집니다.</li>
            <li>이용자는 명시적 동의를 통해 데이터 접근 권한을 부여합니다.</li>
          </ul>
        </Section>

        <Section title="제3조 (데이터 범위)">
          <p className="mb-2">가져올 수 있는 데이터는 다음과 같습니다.</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>라이딩 기록</li>
            <li>거리, 속도, 고도, 시간</li>
            <li>세그먼트 기록</li>
            <li>활동 설명</li>
          </ul>
          <p className="mt-2">가져올 수 있는 데이터 범위는 Strava API 정책에 따릅니다.</p>
        </Section>

        <Section title="제4조 (책임의 한계)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>Strava API 제한 또는 정책 변경으로 인해 일부 데이터가 누락될 수 있습니다.</li>
            <li>데이터 동기화 지연은 API Rate Limit에 따라 발생할 수 있습니다.</li>
            <li>회사는 Strava 데이터의 정확성을 보증하지 않습니다.</li>
          </ul>
        </Section>

        <Section title="제5조 (연동 해제)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>이용자는 언제든 연동을 해제할 수 있습니다.</li>
            <li>연동 해제 시 인증 토큰은 폐기됩니다.</li>
            <li>이미 가져온 데이터는 이용자가 삭제 요청하지 않는 한 서비스 내에 유지됩니다.</li>
          </ul>
        </Section>

        <Section title="제6조 (Strava와의 관계)">
          <p>O-Rider는 Strava와 제휴 또는 공식 파트너 관계가 아니며, Strava는 본 서비스의 운영 주체가 아닙니다.</p>
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
