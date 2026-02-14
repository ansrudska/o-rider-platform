export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto pb-20 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">O-Rider 개인정보처리방침</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">최종 수정일: 2026년 2월 14일</p>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        O-Rider(이하 "회사")는 「개인정보 보호법」 등 관련 법령을 준수하며 이용자의 개인정보를 보호하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.
      </p>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
        <Section title="제1조 (수집하는 개인정보 항목)">
          <p className="mb-2">회사는 다음과 같은 개인정보를 수집합니다.</p>

          <p className="font-medium text-gray-700 dark:text-gray-300 mt-3 mb-1">1. 회원가입 및 로그인 시</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Google 계정 정보: 이름, 이메일 주소, 프로필 이미지</li>
            <li>Google 고유 식별 ID</li>
          </ul>

          <p className="font-medium text-gray-700 dark:text-gray-300 mt-3 mb-1">2. Strava 연동 시</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Strava 고유 ID</li>
            <li>라이딩 기록 데이터(거리, 속도, 고도, 경로, 활동 시간 등)</li>
            <li>활동 설명, 세그먼트 기록 등 사용자가 Strava에 공개한 데이터</li>
          </ul>

          <p className="font-medium text-gray-700 dark:text-gray-300 mt-3 mb-1">3. 서비스 이용 과정에서 자동 수집</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>접속 로그, IP 주소</li>
            <li>디바이스 정보(기기 종류, OS 버전)</li>
            <li>쿠키 및 유사 기술 정보</li>
          </ul>
        </Section>

        <Section title="제2조 (개인정보 수집 및 이용 목적)">
          <p className="mb-2">회사는 다음 목적을 위해 개인정보를 처리합니다.</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>회원 식별 및 계정 관리</li>
            <li>라이딩 기록 저장 및 분석 제공</li>
            <li>Strava 연동 기능 제공</li>
            <li>리더보드, 소셜 기능 운영</li>
            <li>서비스 개선 및 오류 분석</li>
            <li>법령 준수 및 분쟁 대응</li>
          </ul>
        </Section>

        <Section title="제3조 (보유 및 이용 기간)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>회원 탈퇴 시 원칙적으로 개인정보는 지체 없이 삭제합니다.</li>
            <li>단, 관련 법령에 따라 일정 기간 보관이 필요한 경우에는 해당 기간 동안 보관합니다.</li>
            <li>라이딩 기록 데이터는 이용자가 삭제 요청할 경우 즉시 삭제됩니다.</li>
          </ul>
        </Section>

        <Section title="제4조 (개인정보 제3자 제공)">
          <p className="mb-2">회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 다음의 경우에는 예외로 합니다.</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>이용자가 사전에 동의한 경우</li>
            <li>법령에 의하여 요구되는 경우</li>
          </ul>
          <p className="mt-2">Strava 연동은 이용자의 명시적 동의 하에 이루어지며, Strava 측에 별도로 개인정보를 제공하지 않습니다(연동은 OAuth 인증 방식으로 처리됩니다).</p>
        </Section>

        <Section title="제5조 (개인정보 처리 위탁)">
          <p>현재 회사는 개인정보 처리를 외부 업체에 위탁하지 않습니다. 향후 위탁이 발생하는 경우 관련 사항을 본 방침에 공개합니다.</p>
        </Section>

        <Section title="제6조 (이용자의 권리 및 행사 방법)">
          <p className="mb-2">이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>개인정보 열람 요청</li>
            <li>개인정보 수정 요청</li>
            <li>개인정보 삭제 요청</li>
            <li>데이터 다운로드(ZIP) 요청</li>
          </ul>
          <p className="mt-2">권리 행사는 이메일을 통해 요청할 수 있으며, 회사는 지체 없이 조치합니다.</p>
        </Section>

        <Section title="제7조 (쿠키 및 유사 기술)">
          <p>회사는 서비스 개선을 위하여 쿠키 또는 유사 기술을 사용할 수 있습니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다.</p>
        </Section>

        <Section title="제8조 (개인정보의 안전성 확보 조치)">
          <p className="mb-2">회사는 다음과 같은 보호 조치를 시행합니다.</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>OAuth 기반 인증 처리</li>
            <li>HTTPS 통신 암호화</li>
            <li>접근 권한 최소화</li>
            <li>내부 접근 로그 관리</li>
          </ul>
        </Section>

        <Section title="제9조 (아동의 개인정보 보호)">
          <p>만 14세 미만 아동은 법정대리인의 동의 없이 가입할 수 없습니다.</p>
        </Section>

        <Section title="제10조 (개인정보 보호책임자)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>이메일: <strong>orider.app@gmail.com</strong></li>
          </ul>
        </Section>

        <Section title="제11조 (방침 변경)">
          <p>본 방침은 법령 또는 서비스 변경에 따라 수정될 수 있으며, 변경 시 공지합니다.</p>
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
