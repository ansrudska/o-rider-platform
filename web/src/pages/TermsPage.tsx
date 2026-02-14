import { Link } from "react-router-dom";

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto pb-20 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">서비스 이용약관</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">최종 수정일: 2026년 2월 14일</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
        <Section title="제1조 (목적)">
          <p>
            이 약관은 O-Rider(이하 "서비스")에서 제공하는 모든 서비스의 이용 조건 및 절차, 이용자와 서비스 간의 권리, 의무, 책임 사항과 기타 필요한 사항을 규정함을 목적으로 합니다.
          </p>
        </Section>

        <Section title="제2조 (정의)">
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong>"서비스"</strong>란 O-Rider가 제공하는 라이딩 기록 관리, 분석, 소셜 기능 등을 말합니다.</li>
            <li><strong>"이용자"</strong>란 서비스에 접속하여 이 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
            <li><strong>"회원"</strong>이란 서비스에 가입하여 아이디(계정)를 부여받은 이용자를 말합니다.</li>
          </ul>
        </Section>

        <Section title="제3조 (약관의 효력 및 변경)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>이 약관은 서비스 화면에 게시하거나 기타 방법으로 회원에게 공지함으로써 효력이 발생합니다.</li>
            <li>서비스는 합리적인 사유가 발생할 경우 약관을 변경할 수 있으며, 변경된 약관은 공지사항을 통해 공지합니다.</li>
            <li>이용자는 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="제4조 (회원가입 및 계정)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>회원가입은 Google 계정을 통한 소셜 로그인으로 진행됩니다.</li>
            <li>이용자는 정확한 정보를 제공해야 하며, 타인의 정보를 도용할 수 없습니다.</li>
            <li>계정의 관리 책임은 회원에게 있으며, 계정 정보의 변경이 필요한 경우 설정에서 직접 수정하거나 고객센터에 문의해야 합니다.</li>
          </ul>
        </Section>

        <Section title="제5조 (서비스의 제공 및 변경)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>서비스는 라이딩 기록 관리, Strava 데이터 마이그레이션, 세그먼트/리더보드, 소셜 기능(친구, 좋아요, 댓글) 등을 제공합니다.</li>
            <li>서비스는 기능 개선, 시스템 점검 등의 사유로 서비스 내용을 변경할 수 있으며, 중요한 변경 시 사전에 공지합니다.</li>
            <li>서비스는 현재 초기 단계(Beta)이며, 일부 기능이 불안정하거나 변경될 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="제6조 (Strava 연동 및 데이터)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>서비스는 Strava API를 통해 이용자의 라이딩 데이터를 가져올 수 있습니다.</li>
            <li>Strava 데이터 연동은 이용자의 명시적인 동의 하에 이루어지며, 언제든 연동 해제가 가능합니다.</li>
            <li>가져온 데이터의 원본은 Strava에 그대로 유지되며, 서비스에서의 삭제가 Strava 데이터에 영향을 미치지 않습니다.</li>
            <li>Strava API 제한(Rate Limit)으로 인해 데이터 가져오기가 지연될 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="제7조 (개인정보 보호)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>서비스는 이용자의 개인정보를 관련 법령에 따라 보호합니다.</li>
            <li>수집하는 개인정보: Google 계정 정보(이름, 이메일, 프로필 사진), Strava 연동 시 라이딩 데이터</li>
            <li>수집된 정보는 서비스 제공 목적으로만 사용되며, 제3자에게 제공하지 않습니다.</li>
            <li>이용자는 설정에서 데이터 내보내기(ZIP) 및 데이터 삭제를 요청할 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="제8조 (이용자의 의무)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>이용자는 서비스를 정상적인 용도로만 사용해야 합니다.</li>
            <li>다른 이용자에 대한 비방, 욕설, 불쾌한 콘텐츠 게시를 금지합니다.</li>
            <li>서비스의 운영을 방해하는 행위(해킹, 크롤링 등)를 금지합니다.</li>
            <li>법령 또는 이 약관에 위반하는 행위를 해서는 안 됩니다.</li>
          </ul>
        </Section>

        <Section title="제9조 (서비스의 중단)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>서비스는 시스템 점검, 장애 발생, 천재지변 등의 사유로 일시적으로 중단될 수 있습니다.</li>
            <li>서비스 중단 시 가능한 한 사전에 공지하며, 불가피한 경우 사후에 공지합니다.</li>
          </ul>
        </Section>

        <Section title="제10조 (면책 조항)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>서비스는 무료로 제공되며, 서비스 이용으로 인한 손해에 대해 법적 책임을 지지 않습니다.</li>
            <li>이용자가 서비스 내에 제공한 정보의 정확성, 신뢰성에 대해서는 이용자 본인에게 책임이 있습니다.</li>
            <li>Strava 등 외부 서비스의 장애로 인한 서비스 이용 불편에 대해서는 책임을 지지 않습니다.</li>
          </ul>
        </Section>

        <Section title="제11조 (분쟁 해결)">
          <ul className="list-disc list-inside space-y-1.5">
            <li>서비스 이용과 관련하여 발생한 분쟁은 상호 협의를 통해 해결합니다.</li>
            <li>협의가 이루어지지 않은 경우, 대한민국 관련 법령에 따라 관할 법원에서 해결합니다.</li>
          </ul>
        </Section>

        <Section title="제12조 (연락처)">
          <p>
            서비스 관련 문의사항은 아래로 연락해주세요.
          </p>
          <ul className="list-disc list-inside space-y-1.5 mt-2">
            <li>이메일: <strong>orider.app@gmail.com</strong></li>
            <li>피드백: <Link to="/feedback" className="text-orange-600 hover:underline font-medium">피드백 페이지</Link></li>
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
