import { Link } from "react-router-dom";

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto pb-20 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">O-Rider 서비스 이용약관</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">최종 수정일: 2026년 2월 15일</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
        <Section title="제1조 (목적)">
          <p>
            본 약관은 O-Rider(이하 "회사")가 제공하는 라이딩 기록 관리 및 소셜 플랫폼 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항과 기타 필요한 사항을 규정함을 목적으로 합니다.
          </p>
        </Section>

        <Section title="제2조 (정의)">
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong>"서비스"</strong>란 회사가 제공하는 라이딩 기록 관리, 데이터 분석, 세그먼트 및 리더보드, 소셜 기능, 외부 서비스 연동 기능 등을 포함한 일체의 온라인 서비스를 말합니다.</li>
            <li><strong>"이용자"</strong>란 본 약관에 따라 서비스에 접속하여 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
            <li><strong>"회원"</strong>이란 Google 계정 등을 통해 로그인하여 회사와 이용계약을 체결한 자를 말합니다.</li>
            <li><strong>"콘텐츠"</strong>란 이용자가 서비스에 업로드하거나 게시하는 라이딩 기록, 사진, 댓글, 설명, 프로필 정보 등 일체의 정보를 말합니다.</li>
            <li><strong>"외부 서비스"</strong>란 Strava 등 회사가 연동 기능을 제공하는 제3자의 서비스를 말합니다.</li>
          </ul>
        </Section>

        <Section title="제3조 (이용계약의 성립)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>이용계약은 이용자가 본 약관에 동의하고 로그인 절차를 완료한 시점에 성립합니다.</li>
            <li>회사는 다음 각 호에 해당하는 경우 가입을 제한하거나 사후에 이용계약을 해지할 수 있습니다.
              <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                <li>타인의 정보를 도용한 경우</li>
                <li>만 14세 미만인 경우(법정대리인 동의 없는 경우 포함)</li>
                <li>법령 또는 본 약관을 위반한 경우</li>
              </ul>
            </li>
            <li>회원은 계정을 타인에게 양도, 대여, 공유할 수 없습니다.</li>
          </ul>
        </Section>

        <Section title="제4조 (계정 관리)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>회원은 자신의 계정 정보에 대한 관리 책임을 부담합니다.</li>
            <li>계정의 부정 사용이 의심되는 경우 즉시 회사에 통지해야 합니다.</li>
            <li>회사는 회원의 귀책사유로 발생한 손해에 대하여 책임을 부담하지 않습니다.</li>
          </ul>
        </Section>

        <Section title="제5조 (서비스의 제공 및 변경)">
          <p className="mb-2">회사는 다음 각 호의 서비스를 제공합니다.</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>라이딩 기록 저장 및 분석</li>
            <li>Strava 데이터 마이그레이션 및 동기화</li>
            <li>세그먼트 및 리더보드</li>
            <li>친구, 댓글, 좋아요 등 소셜 기능</li>
          </ul>
          <ul className="list-disc list-inside space-y-1.5 mt-3">
            <li>서비스는 현재 초기 단계(Beta)로, 일부 기능이 변경되거나 중단될 수 있습니다.</li>
            <li>회사는 운영상 또는 기술상 필요에 따라 서비스의 전부 또는 일부를 변경할 수 있으며, 중요한 변경은 사전에 공지합니다.</li>
            <li>회사는 현재 서비스를 무료로 제공하나, 향후 일부 기능에 대하여 유료 서비스를 도입할 수 있으며, 이 경우 사전에 고지합니다.</li>
          </ul>
        </Section>

        <Section title="제6조 (외부 서비스 연동 및 데이터)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>서비스는 이용자의 명시적 동의 하에 Strava API 등 외부 서비스와 연동할 수 있습니다.</li>
            <li>외부 서비스의 정책 변경, API 제한, 장애 등으로 인해 서비스 일부 기능이 제한될 수 있습니다.</li>
            <li>외부 서비스에서 가져온 데이터의 정확성, 완전성, 최신성에 대하여 회사는 보증하지 않습니다.</li>
            <li>이용자는 언제든지 외부 서비스 연동을 해제할 수 있으며, 연동 해제 시 인증 토큰은 폐기됩니다.</li>
            <li>서비스에서의 데이터 삭제는 외부 서비스의 데이터에 영향을 미치지 않습니다.</li>
            <li>Strava 연동에 관한 세부 사항은 <Link to="/strava-terms" className="text-orange-600 hover:underline font-medium">Strava 마이그레이션 특약</Link>에 따릅니다.</li>
          </ul>
        </Section>

        <Section title="제7조 (개인정보 보호)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>회사는 관련 법령에 따라 이용자의 개인정보를 처리하고 보호합니다.</li>
            <li>개인정보의 수집 항목, 이용 목적, 보관 기간 등은 별도의 개인정보처리방침에 따릅니다.</li>
            <li>이용자는 설정을 통해 자신의 데이터를 내보내거나 삭제를 요청할 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="제8조 (이용자의 의무 및 금지행위)">
          <p className="mb-2">이용자는 다음 각 호의 행위를 하여서는 안 됩니다.</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>법령 또는 본 약관에 위반되는 행위</li>
            <li>타인의 권리(저작권, 초상권, 개인정보 등)를 침해하는 행위</li>
            <li>타인에 대한 비방, 욕설, 혐오, 불쾌감을 주는 콘텐츠 게시</li>
            <li>자동화 도구를 이용한 대량 수집(스크래핑), 비정상 트래픽 유발 행위</li>
            <li>리버스엔지니어링, 우회접속, 인증정보 공유 등 서비스 운영을 방해하는 행위</li>
            <li>외부 서비스의 정책을 위반하도록 유도하는 행위</li>
          </ul>
        </Section>

        <Section title="제9조 (이용 제한 및 해지)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>회사는 이용자가 본 약관을 위반한 경우 경고, 일시 정지 또는 영구 정지 등의 조치를 취할 수 있습니다.</li>
            <li>중대한 위반 행위의 경우 사전 통지 없이 이용을 제한할 수 있습니다.</li>
            <li>회원은 언제든지 탈퇴를 요청할 수 있으며, 탈퇴 시 개인정보는 관련 법령 및 개인정보처리방침에 따라 처리됩니다.</li>
            <li>이용 제한 조치에 대하여 회원은 회사에 소명할 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="제10조 (콘텐츠의 권리 및 책임)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>이용자는 자신이 업로드한 콘텐츠에 대한 권리를 보유하거나 적법한 이용권한을 보유해야 합니다.</li>
            <li>이용자는 서비스 제공, 노출, 저장, 전송을 위하여 필요한 범위 내에서 회사에 비독점적·무상·전세계적 이용권을 부여합니다.</li>
            <li>회사는 권리침해가 의심되는 콘텐츠에 대하여 임시조치(블라인드, 삭제 등)를 할 수 있습니다.</li>
            <li>이용자의 콘텐츠로 인해 발생한 분쟁에 대한 책임은 해당 이용자에게 있습니다.</li>
          </ul>
        </Section>

        <Section title="제11조 (서비스의 중단)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>회사는 시스템 점검, 장애, 천재지변 등 불가항력 사유로 서비스의 전부 또는 일부를 일시적으로 중단할 수 있습니다.</li>
            <li>가능한 경우 사전에 공지하며, 불가피한 경우 사후 공지합니다.</li>
          </ul>
        </Section>

        <Section title="제12조 (책임의 제한)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>회사는 무료로 제공되는 서비스와 관련하여 법령이 허용하는 범위 내에서 책임을 제한합니다.</li>
            <li>회사는 외부 서비스의 장애 또는 정책 변경으로 인한 손해에 대하여 책임을 부담하지 않습니다.</li>
            <li>회사는 간접손해, 특별손해, 결과적 손해에 대하여 책임을 부담하지 않습니다.</li>
            <li>다만, 회사의 고의 또는 중대한 과실로 인한 손해에 대해서는 관련 법령에 따릅니다.</li>
          </ul>
        </Section>

        <Section title="제13조 (약관의 변경)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있습니다.</li>
            <li>변경된 약관은 서비스 화면 공지 또는 이메일 등을 통해 공지합니다.</li>
            <li>이용자가 변경된 약관에 동의하지 않는 경우 탈퇴할 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="제14조 (분쟁 해결 및 준거법)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>서비스 이용과 관련한 분쟁은 상호 협의를 통해 해결합니다.</li>
            <li>협의가 이루어지지 않을 경우 대한민국 법령을 준거법으로 하며, 관할 법원은 회사의 본점 소재지를 관할하는 법원으로 합니다.</li>
          </ul>
        </Section>

        <Section title="제15조 (연락처)">
          <p>서비스 관련 문의는 아래로 연락할 수 있습니다.</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2">
            <li>이메일: <strong>orider.app@gmail.com</strong></li>
            <li>서비스 내 <Link to="/feedback" className="text-orange-600 hover:underline font-medium">피드백 페이지</Link></li>
          </ul>
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
