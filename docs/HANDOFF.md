# O-Rider 웹 플랫폼 핸드오프 문서

> 최종 업데이트: 2026-02-14

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **서비스** | O-Rider 웹 대시보드 + Cloud Functions 백엔드 |
| **URL** | https://orider.co.kr (= https://orider-1ce26.web.app) |
| **기술 스택** | React 19, TypeScript, Tailwind CSS 4, Vite 6 |
| **백엔드** | Firebase Cloud Functions (Node 20, 2nd Gen) |
| **DB** | Firestore |
| **Firebase** | 프로젝트 `orider-1ce26` |
| **저장소** | `o-rider-platform/` |
| **현재 브랜치** | `main` |

## 최근 작업 이력

### 2026-02-14 (UX 대규모 개선, 미커밋 25개 파일)
- **다크 모드** — `prefers-color-scheme: dark` 자동 감지, 전 컴포넌트 `dark:` 클래스 적용
- **토스트 시스템** — `ToastContext.tsx` 신규, success/error/info 3타입, 2.5초 자동 소멸
- **모바일 하단 탭바** — Layout.tsx: 피드/탐색/알림/프로필 4탭, `md:hidden fixed bottom-0`
- **피드 카드 좋아요** — ActivityCard: 인라인 kudos 토글 (Firestore 직접 write), optimistic UI
- **스켈레톤 로딩** — HomePage, AthletePage, SegmentPage: `animate-pulse` 스켈레톤 카드
- **ActivityPage 탭 분리** — 개요/분석/세그먼트/댓글 4탭 (`TabNav` 컴포넌트)
- **AthletePage 확장** — 월별 활동 트렌드 차트 (`WeeklyChart` 재사용), 활동 필터 (전체/Strava/직접)
- **차트 다크 모드** — ElevationChart, WeeklyChart, ComparisonChart: `matchMedia` 감지로 축/그리드 색상 분기

### 2026-02-14 (이전 커밋)
- **커스텀 도메인** — `orider.co.kr` + `www.orider.co.kr` Firebase Hosting 연결
- **활동 상세 개선** (`b93d975`) — 섹션 순서 변경, 세그먼트 실제 경로 표시
- **Strava 중복 방지** (`f516b6e`) — 앱 업로드와 Strava 임포트 간 dedup 로직
- **활동 검색** (`e020280`) — 키워드 + 날짜 범위 필터
- **데이터 내보내기** (`2f32bfe`) — ZIP 다운로드 (활동 + GPS 스트림)
- **모바일 딥링크** (`b2e6e1e`) — Strava 콜백에서 `state=mobile` → 앱 딥링크 리다이렉트

### 2026-02-09 이전
- Firestore 백업 스케줄러 (`56df840`) — 3시간마다 GCS 버킷에 백업
- 홈페이지 히어로 배너 + 한국 자전거 커뮤니티 링크 (`093967c`)
- 소셜 기능 (`402b3ca`) — 팔로우, 알림, 댓글, 닉네임, 활동 삭제
- Strava Webhook 자동 동기화 (`527afc6`)
- 동행 라이더 매칭 (`d78cd3d`) — 시간 겹침 30% 이상 = 동행
- 세그먼트 리더보드 (`86cba47`) — KOM/QOM
- Strava 마이그레이션 큐 시스템

## 프로젝트 구조

```
o-rider-platform/
├── web/                       # React 프론트엔드
│   └── src/
│       ├── App.tsx            # 라우트 정의 (React Router 7)
│       ├── main.tsx           # 엔트리 (BrowserRouter > AuthProvider > ToastProvider > App)
│       ├── index.css          # Tailwind CSS + 다크 body + 페이지전환 + 토스트 애니메이션
│       ├── contexts/
│       │   ├── AuthContext.tsx # Google Auth + Firestore 프로필 구독 + WebView 감지 + useAuth()
│       │   └── ToastContext.tsx # 토스트 알림 시스템 (showToast, 자동 소멸) + useToast()
│       ├── hooks/
│       │   ├── useActivities.ts   # 활동 목록 (데모/Firestore), useWeeklyStats, useActivitySearch
│       │   ├── useStrava.ts       # Strava OAuth + callable 호출
│       │   ├── useFirestore.ts    # useDocument, useCollection, queryDocuments
│       │   └── useExport.ts       # ZIP 데이터 내보내기 (JSZip)
│       ├── pages/             # 아래 "페이지 상세" 섹션 참조
│       ├── components/        # 아래 "컴포넌트 상세" 섹션 참조
│       ├── services/
│       │   └── firebase.ts    # Firebase SDK 초기화 (auth, firestore, database, functions, googleProvider)
│       ├── utils/
│       │   └── polyline.ts    # 폴리라인 인코딩/디코딩
│       └── data/
│           └── demo.ts        # 데모 활동 데이터 (비로그인 시)
├── functions/                 # Cloud Functions — 아래 "Cloud Functions 상세" 참조
├── shared/
│   └── types.ts               # 공유 TypeScript 타입 (Activity, UserProfile, Notification 등)
├── firestore/
│   ├── firestore.rules        # 보안 규칙
│   └── firestore.indexes.json # 복합 인덱스 (8개)
├── firebase.json              # 배포 설정 (hosting + functions + firestore)
└── docs/
    ├── PLATFORM_DESIGN.md     # 전체 시스템 설계 문서
    └── STRAVA_COMPARISON.md   # Strava vs O-Rider 기능 비교
```

## 페이지 상세

### HomePage (`pages/HomePage.tsx`, ~420줄)
- **히어로 배너**: 비로그인 → "시작하기" CTA, 로그인+미연동 → "Strava 연동하기"
- **활동 피드**: `useActivities()` → ActivityCard 리스트 + "더 보기" 페이지네이션
- **검색**: `useActivitySearch()` → 키워드 입력 + Enter + 날짜 프리셋 필터 (전체/7일/30일/90일/올해)
- **로딩 상태**: 3개 스켈레톤 카드 (avatar + title + map placeholder + stats)
- **사이드바** (lg 이상): 프로필 요약, 이번 주 통계 (StatCard 4개), 주간 거리 차트 (WeeklyChart), 커뮤니티 링크
- **커뮤니티 카드**: 도싸, 자출사, 클리앙, 바이크셀, 더바이크 (모바일은 피드 아래 표시)

### ActivityPage (`pages/ActivityPage.tsx`, ~1090줄)
- **4탭 구조**: `TabNav` 컴포넌트로 개요/분석/세그먼트/댓글 분리
  - **개요**: RouteMap + 기본 통계 (거리/시간/속도/고도 등) + 동행 라이더 + 사진
  - **분석**: ElevationChart + 오버레이 토글 (속도/심박/파워/케이던스) + 상세 통계 테이블
  - **세그먼트**: 세그먼트 기록 카드 리스트 (카테고리 뱃지, 등급, 시간, 파워)
  - **댓글**: 실시간 댓글 구독 + 댓글 작성/수정/삭제 + 좋아요 리스트
- **Strava 스트림**: `getStreams()` callable → GPS/altitude/heartrate/watts/cadence 시각화
- **차트-지도 연동**: `hoverIndex` 상태로 차트 hover ↔ 지도 마커 동기화
- **가시성 설정**: 소유자만 visibility 드롭다운 (전체/팔로워/나만)
- **데이터 내보내기**: `useExport()` → ZIP 다운로드

### AthletePage (`pages/AthletePage.tsx`, ~328줄)
- **커버 + 프로필**: 그라데이션 커버, Avatar, 팔로워/팔로잉 카운트, 팔로우 버튼
- **통계**: StatCard 4개 (총 활동/거리/시간/획득고도)
- **월별 트렌드 차트**: `monthlyStats` 계산 → WeeklyChart (최근 12개월)
- **활동 필터**: 전체/Strava/직접기록 pill 버튼
- **스켈레톤 로딩**: 커버 + avatar + stats 플레이스홀더
- **팔로우**: Firestore `following/{uid}/users/{targetId}` 직접 write, optimistic UI

### SegmentPage (`pages/SegmentPage.tsx`, ~300줄)
- **세그먼트 정보**: 지도 (RouteMap, polyline decode), 거리/고도/경사 통계
- **리더보드**: LeaderboardTable (KOM/QOM), 나의 기록 하이라이트
- **스켈레톤 로딩**: 지도 + 통계 + 테이블 플레이스홀더

### SettingsPage (`pages/SettingsPage.tsx`)
- **프로필 섹션**: 닉네임 수정 + 친구 코드 복사 + 토스트 피드백
- **Strava 섹션**: 연동 상태, 연결/해제/가져오기 버튼
- **공개 범위**: 드롭다운 (전체/팔로워/나만)
- **데이터 내보내기**: ZIP 다운로드 버튼

### ExplorePage (`pages/ExplorePage.tsx`)
- 전체 공개 활동 피드 (visibility == "everyone")
- 다크 모드 적용

### MigrationPage (`pages/MigrationPage.tsx`, ~400줄)
- **4단계 UI**: Landing → Scope 선택 → Progress → Report
- **Landing**: 안내 + 시작 버튼
- **Scope**: 기간/항목 선택 (활동/스트림/세그먼트)
- **Progress**: 실시간 진행률 바 + 단계별 상태
- **Report**: 복사 완료 통계 + 경고/에러 목록

### 기타 페이지
- **GroupDashboardPage/GroupRidePage**: 플레이스홀더 ("준비 중")
- **StravaCallbackPage**: OAuth 콜백 → `stravaExchangeToken` callable → `state=mobile`이면 딥링크 리다이렉트

## 컴포넌트 상세

### Layout (`components/Layout.tsx`, ~464줄)
- **헤더**: 로고 + 데스크톱 nav (대시보드/탐색/복사) + 알림벨 + 프로필 드롭다운 + Google 로그인
- **알림 패널**: Firestore `notifications/{uid}/items` 실시간 구독, 읽음 표시, 9+ 뱃지
- **프로필 드롭다운**: 내 프로필/설정/Strava 상태/로그아웃
- **모바일 햄버거**: md 이하 nav 토글
- **하단 탭바**: `md:hidden fixed bottom-0`, 피드/탐색/알림/프로필 4탭, NavLink isActive 하이라이트
- **푸터**: &copy; 2026 O-Rider
- **다크 모드**: 모든 요소에 `dark:` 클래스

### ActivityCard (`components/ActivityCard.tsx`, ~212줄)
- **헤더**: Avatar + 닉네임 링크 + 소스 아이콘 (Strava/O-Rider) + timeAgo
- **통계**: 거리/획득고도/시간/평속/파워/심박
- **지도**: RouteMap (polyline) + hover 오버레이 (거리/시간/고도 뱃지)
- **푸터**: 좋아요 토글 + 댓글 수 + 세그먼트 수
- **좋아요**: Firestore `activities/{id}/kudos/{userId}` 직접 write/delete, optimistic 카운트

### RouteMap (`components/RouteMap.tsx`, ~165줄)
- **입력**: encoded polyline 또는 raw latlng 배열
- **Leaflet**: MapContainer + TileLayer (OpenStreetMap) + Polyline (glow + main)
- **사진 마커**: divIcon 원형 미리보기 + Popup
- **차트 연동**: `markerPosition` → CircleMarker
- **다크 모드**: 빈 상태 메시지

### 차트 컴포넌트 (Chart.js 4)
- **ElevationChart**: 고도 프로파일 + 오버레이 (속도/심박/파워/케이던스), 마우스 hover → 지도 마커
- **WeeklyChart**: 바 차트 (주간/월간), dataKey 프로퍼티로 distance/time/elevation 전환 가능
- **ComparisonChart**: 그룹 멤버 비교 바 차트
- **다크 모드**: `window.matchMedia("(prefers-color-scheme: dark)")` 감지 → 축/그리드/텍스트 색상 분기

### 기타 컴포넌트
- **StatCard**: label + value + icon, 다크 모드
- **TabNav**: 탭 배열 prop → 수평 탭 바, active 상태 하이라이트
- **LeaderboardTable**: 세그먼트 리더보드, 순위/이름/시간/파워/심박
- **Avatar**: 이름 이니셜 또는 이미지, 크기별 (sm/md/lg/xl)
- **MapPlaceholder**: 지도 로딩 중 폴백

## 컨텍스트 & 훅

### AuthContext (`contexts/AuthContext.tsx`)
- **Provider**: `<AuthProvider>` — Firebase Auth 상태 감지 + Firestore `users/{uid}` 실시간 구독
- **Hook**: `useAuth()` → `{ user, profile, loading, signInWithGoogle, logout }`
- **WebView 감지**: in-app 브라우저 → `signInWithRedirect` (팝업 차단 우회)
- **프로필 자동 생성**: 로그인 시 `ensureUserProfile` callable 호출

### ToastContext (`contexts/ToastContext.tsx`)
- **Provider**: `<ToastProvider>` — 토스트 스택 관리, 자동 소멸 (2.5초 표시 + 0.2초 fade-out)
- **Hook**: `useToast()` → `{ showToast(message, type?) }`
- **타입**: success (녹색), error (빨간색), info (회색/다크에서 밝은색)
- **CSS**: `animate-toast-in` / `animate-toast-out` (index.css 커스텀 키프레임)

### useActivities (`hooks/useActivities.ts`)
- **useActivities()**: 로그인+Strava → Firestore 실시간 구독, 비로그인 → demo.ts, 페이지네이션
- **useWeeklyStats()**: 최근 12주 거리/시간/고도/횟수 집계
- **useActivitySearch()**: 키워드 검색 + DatePreset 필터 (all/7d/30d/90d/year)

### useStrava (`hooks/useStrava.ts`)
- **connect()**: Strava OAuth URL 생성 → 리다이렉트
- **exchangeToken(code)**: callable `stravaExchangeToken` 호출
- **importActivities()**: callable `stravaImportActivities` 호출
- **getStreams(activityId)**: callable `stravaGetActivityStreams` 호출
- **disconnect()**: callable `stravaDisconnect` 호출

### useExport (`hooks/useExport.ts`)
- **exportData()**: 활동 + GPS 스트림 → JSZip → Blob 다운로드

## Cloud Functions 상세

### Strava (`strava.ts`) — 12개 함수

| 함수 | 타입 | 역할 |
|------|------|------|
| `stravaExchangeToken` | onCall | OAuth 코드 → 토큰 교환, Firestore 저장 |
| `stravaImportActivities` | onCall | 활동 목록 가져오기 (페이지네이션, dedup) |
| `stravaGetActivityStreams` | onCall | GPS 스트림 가져오기 (캐시) |
| `stravaBatchFetchStreams` | onCall | 배치 스트림 가져오기 |
| `stravaDisconnect` | onCall | 연동 해제, 토큰 삭제 |
| `stravaDeleteUserData` | onCall | Strava 활동 + 스트림 전체 삭제 |
| `stravaMigrationStart` | onCall | 마이그레이션 작업 시작 |
| `stravaMigrationComplete` | onCall | 마이그레이션 완료, 리포트 생성 |
| `stravaQueueEnqueue` | onCall | 큐에 작업 추가 |
| `stravaQueueCancel` | onCall | 대기 중인 작업 취소 |
| `stravaWebhook` | onRequest | Strava 푸시 이벤트 수신 |
| `stravaQueueProcessor` | scheduler | 큐 작업 백그라운드 처리 |

### Auth (`auth.ts`) — 2개 함수

| 함수 | 역할 |
|------|------|
| `ensureUserProfile` | 첫 로그인 시 `users/{uid}` 생성 |
| `updateDefaultVisibility` | 공개 범위 변경 + 기존 활동 일괄 업데이트 |

### Firestore 트리거 — 5개 함수

| 함수 | 트리거 | 역할 |
|------|--------|------|
| `onActivityCreate` | activities 생성 | 피드 팬아웃 + 그룹 라이드 매칭 (30% 시간 겹침) |
| `onKudosCreate` | kudos 생성 | kudosCount 증가 + 알림 |
| `onKudosDelete` | kudos 삭제 | kudosCount 감소 |
| `onCommentCreate` | comments 생성 | commentCount 증가 + 알림 |
| `onFollowCreate/Delete` | following 생성/삭제 | followers 역방향 동기화 + 알림 |

### 기타 — 2개 함수

| 함수 | 역할 |
|------|------|
| `scheduledFirestoreBackup` | 3시간마다 GCS `gs://orider-1ce26-backups`에 백업 |
| `proxyPhotoDownload` | Strava CDN 사진 프록시 (SSRF 방지, 호스트 allowlist) |

## Firestore 스키마

```
activities/{activityId}                  # 활동 레코드
  ├── userId, source ("strava"|"orider"), startTime, visibility
  ├── summary { distance, speed, cadence, heartRate, power, elevation }
  ├── kudosCount, commentCount, thumbnailTrack
  └── groupRideId? (자동 매칭)

activity_streams/{activityId}            # GPS 스트림 (서버 작성)
  └── latlng[], altitude[], time[], distance[], heartrate[], watts[]

users/{uid}                              # 사용자 프로필
  ├── nickname, email, photoURL, friendCode
  ├── stravaConnected, stravaAthleteId, stravaNickname
  ├── defaultVisibility ("everyone"|"followers"|"only_me")
  └── migration { status, progress, report }

users/{uid}/strava_tokens/current        # Strava 토큰 (서버 전용!)
  └── access_token, refresh_token, expires_at

feed/{userId}/{activityId}               # 팔로워 피드 (서버 작성)
following/{userId}/users/{targetId}      # 팔로우 관계
followers/{targetId}/users/{userId}      # 팔로워 (서버 동기화)

activities/{id}/kudos/{userId}           # 좋아요
activities/{id}/comments/{commentId}     # 댓글

notifications/{userId}/items/{id}        # 알림 (kudos, comment, follow)

segments/{segmentId}                     # 세그먼트 정의
segment_efforts/{segmentId}/efforts/{id} # 세그먼트 기록 (리더보드)
user_prs/{userId}/segments/{segmentId}   # 개인 기록

group_rides/{groupRideId}                # 그룹 라이드 (자동 매칭)

strava_queue/{jobId}                     # 마이그레이션 큐 (서버 전용)
strava_rate_limit/{doc}                  # Rate limit 상태 (서버 전용)
```

## Firestore 복합 인덱스

| 컬렉션 | 필드 | 용도 |
|--------|------|------|
| activities | userId + createdAt desc | 사용자 활동 목록 |
| activities | userId + startTime desc | 시간순 활동 조회 |
| activities | groupId + startTime desc | 그룹 활동 조회 |
| activities | groupRideId + startTime asc | 그룹 라이드 참가자 |
| activities | visibility + createdAt desc | 공개 피드 |
| activities | userId + source + startTime | 중복 활동 방지 (dedup) |
| segments | geoHash + status | 위치 기반 세그먼트 탐색 |
| group_rides | groupId + startTime desc | 그룹별 라이드 이력 |

## 라우트

| 경로 | 페이지 | 인증 |
|------|--------|------|
| `/` | HomePage | 불필요 (데모 가능) |
| `/activity/:activityId` | ActivityPage | 불필요 |
| `/athlete/:userId` | AthletePage | 불필요 |
| `/group/:groupId` | GroupDashboardPage | 불필요 |
| `/group/:groupId/ride/:rideId` | GroupRidePage | 불필요 |
| `/segment/:segmentId` | SegmentPage | 불필요 |
| `/explore` | ExplorePage | 불필요 |
| `/settings` | SettingsPage | **필요** |
| `/strava/callback` | StravaCallbackPage | **필요** |
| `/migrate` | MigrationPage | **필요** |

## 인증 플로우

```
비로그인 → 데모 데이터 (demo.ts) + 공개 활동 피드
          │
Google 로그인 → ensureUserProfile() → users/{uid} 생성
          │
Strava 연동 → OAuth authorize → /strava/callback
          │     ├── 웹: stravaExchangeToken → 자동 임포트 30개
          │     └── 앱: state=mobile → orider://strava/callback 딥링크
          │
로그아웃 → Firebase signOut → 데모 모드로 복귀
```

### WebView 감지
`AuthContext.tsx`에서 in-app 브라우저 감지 → `signInWithRedirect` 사용 (팝업 차단 우회)

## Strava 연동 상세

### OAuth 설정
- **Client ID**: `194266`
- **Callback Domain**: `orider-1ce26.web.app`
- **Redirect URI**: `https://orider-1ce26.web.app/strava/callback`
- **Scope**: `read,activity:read_all`

### 활동 중복 방지
Strava 임포트 시 동일 사용자의 ±5분 이내 기존 `orider` 소스 활동이 있으면 스킵:
```typescript
// strava.ts에서 dedup 체크
const dupSnap = await db.collection("activities")
  .where("userId", "==", uid)
  .where("source", "==", "orider")
  .where("startTime", ">=", startTime - FIVE_MIN)
  .where("startTime", "<=", startTime + FIVE_MIN)
  .limit(1).get();
```

### Rate Limiting
- Strava API: 100요청/15분, 1000요청/일
- 큐 시스템으로 대량 임포트 관리 (`stravaQueueProcessor`)

## UI/UX 패턴

### 다크 모드
- **방식**: `prefers-color-scheme: dark` 미디어 쿼리 (Tailwind CSS 4 기본 지원)
- **body**: `index.css`에서 dark 배경 `#030712` (gray-950), 텍스트 `#f9fafb` (gray-50)
- **색상 매핑**: `bg-white` → `dark:bg-gray-900`, `bg-gray-50` → `dark:bg-gray-950`, `text-gray-900` → `dark:text-gray-50`, `border-gray-200` → `dark:border-gray-700`
- **차트**: `isDarkMode()` 헬퍼 → Chart.js 옵션에서 축/그리드/텍스트 색상 분기

### 토스트 알림
- **구현**: `ToastContext` + `useToast()` hook
- **사용처**: 좋아요 전송, 닉네임 저장, Strava 해제, 클립보드 복사, 댓글 삭제 등
- **CSS 애니메이션**: `animate-toast-in` (fade down), `animate-toast-out` (fade up)

### 모바일 하단 탭바
- **위치**: `Layout.tsx` 하단, `md:hidden fixed bottom-0 z-50`
- **탭**: 피드 (홈 아이콘), 탐색 (돋보기), 알림 (벨, 뱃지), 프로필 (사람)
- **body padding**: `pb-16 md:pb-0` (탭바 높이 만큼)

### 스켈레톤 로딩
- **HomePage**: 3개 카드 스켈레톤 (avatar circle + text bars + map rect + stat bars)
- **AthletePage**: 커버 rect + avatar circle + stat cards
- **SegmentPage**: 지도 rect + stat cards + 테이블 rows

### 데모 모드
비로그인 사용자에게 `demo.ts`의 샘플 데이터 표시 → 로그인 유도

### 피드 팬아웃
활동 생성 시 Cloud Function이 팔로워들의 `feed/{followerId}/{activityId}`에 인덱스 생성

### 그룹 라이드 매칭
활동 생성 시 같은 그룹 멤버의 30% 이상 시간 겹침 활동을 자동 그룹화

### Firestore 백업
`scheduledFirestoreBackup` — 3시간마다 `gs://orider-1ce26-backups`에 자동 백업

## 빌드 및 배포

```bash
# 웹 프론트엔드
cd web && npm run dev              # 개발 서버
cd web && npm run build            # 프로덕션 빌드
cd web && npx tsc --noEmit         # 타입 체크만

# Cloud Functions
cd functions && npx tsc            # 빌드
cd functions && npx tsc --watch    # 워치 모드

# Firebase 배포
firebase deploy --only hosting --project orider-1ce26
firebase deploy --only functions --project orider-1ce26
firebase deploy --only firestore:rules --project orider-1ce26
firebase deploy --only firestore:indexes --project orider-1ce26
firebase deploy --project orider-1ce26    # 전체

# Strava Secrets
printf 'VALUE' | firebase functions:secrets:set STRAVA_CLIENT_ID --project orider-1ce26 --data-file -
printf 'VALUE' | firebase functions:secrets:set STRAVA_CLIENT_SECRET --project orider-1ce26 --data-file -
```

### 배포 주의사항
- `firebase.json`의 `predeploy`가 npm stdin 오류 발생 가능 → `predeploy: []`로 임시 변경 후 배포, 이후 복원
- Secrets 설정 시 `<<<` 사용 금지 (줄바꿈 추가됨) → 반드시 `printf | --data-file -` 사용

## 환경 변수

### web/.env
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=orider-1ce26.firebaseapp.com
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID=orider-1ce26
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_STRAVA_CLIENT_ID=194266
```

### Cloud Functions Secrets
- `STRAVA_CLIENT_ID` — Strava API Client ID
- `STRAVA_CLIENT_SECRET` — Strava API Client Secret

## 의존성

### 웹 (`web/package.json`)
| 패키지 | 버전 | 용도 |
|--------|------|------|
| react | ^19.0.0 | UI 프레임워크 |
| react-router-dom | ^7.0.0 | 라우팅 |
| firebase | ^11.0.0 | Firebase SDK |
| chart.js | ^4.4.0 | 차트 (고도, 주간 통계, 오버레이) |
| leaflet + react-leaflet | ^1.9.4 / ^5.0.0 | 지도 |
| jszip | ^3.10.1 | ZIP 내보내기 |
| tailwindcss | ^4.0.0 | CSS 프레임워크 |
| vite | ^6.0.0 | 빌드 도구 |
| typescript | ^5.6.0 | 타입 시스템 |

### Functions (`functions/package.json`)
| 패키지 | 버전 | 용도 |
|--------|------|------|
| firebase-admin | ^12.0.0 | Admin SDK |
| firebase-functions | ^5.0.0 | 2nd Gen Functions |
| typescript | ^5.4.0 | 타입 시스템 |
| Node | 20 | 런타임 |

## 커스텀 도메인

| 도메인 | DNS 레코드 | 값 |
|--------|-----------|-----|
| `orider.co.kr` | A | `199.36.158.100` |
| `orider.co.kr` | TXT | `hosting-site=orider-1ce26` |
| `_acme-challenge.orider.co.kr` | TXT | `iY3jwbZHvcVfYBuLA73OitQ0RRmos8V5b9umbdGZ8ok` |
| `www.orider.co.kr` | CNAME | `orider-1ce26.web.app.` |

DNS 관리: 가비아 (gabia.com)

## 미커밋 변경사항 (2026-02-14 UX 개선)

25개 파일, +1,496 / -1,021줄:

| 영역 | 파일 | 주요 변경 |
|------|------|----------|
| 글로벌 | `index.css` | 다크 body, 토스트 키프레임 애니메이션 |
| 글로벌 | `main.tsx` | ToastProvider 추가 |
| 컨텍스트 | `ToastContext.tsx` | **신규** — 토스트 시스템 |
| 레이아웃 | `Layout.tsx` | 다크 모드 + 모바일 하단 탭바 |
| 카드 | `ActivityCard.tsx` | 다크 모드 + 인라인 좋아요 토글 |
| 차트 | `ElevationChart.tsx` | isDarkMode() + 동적 색상 |
| 차트 | `WeeklyChart.tsx` | isDarkMode() + 동적 색상 |
| 차트 | `ComparisonChart.tsx` | isDarkMode() + 동적 색상 |
| 컴포넌트 | `StatCard.tsx`, `TabNav.tsx`, `LeaderboardTable.tsx`, `MapPlaceholder.tsx`, `RouteMap.tsx` | 다크 모드 |
| 페이지 | `HomePage.tsx` | 다크 모드 + 스켈레톤 로딩 |
| 페이지 | `ActivityPage.tsx` | 다크 모드 + 4탭 분리 + 토스트 |
| 페이지 | `AthletePage.tsx` | 다크 모드 + 스켈레톤 + 월별 트렌드 + 활동 필터 |
| 페이지 | `SegmentPage.tsx` | 다크 모드 + 스켈레톤 |
| 페이지 | `SettingsPage.tsx` | 다크 모드 + 토스트 |
| 페이지 | `ExplorePage.tsx` | 다크 모드 |
| 페이지 | `MigrationPage.tsx` | 다크 모드 전체 |
| 페이지 | `GroupDashboardPage.tsx`, `GroupRidePage.tsx` | 다크 모드 |
| 훅 | `useStrava.ts`, `useExport.ts` | 마이너 수정 |
| 백엔드 | `strava.ts` | 리팩토링 |
| 스키마 | `firestore.indexes.json` | 신규 인덱스 |

## 관련 프로젝트

| 프로젝트 | 역할 | 위치 |
|----------|------|------|
| **o-rider** | 모바일 앱 (KMP) | `/Users/moon/work/o-rider` |
| **Firebase Console** | 프로젝트 관리 | https://console.firebase.google.com/project/orider-1ce26 |
| **Strava API** | OAuth 설정 | https://www.strava.com/settings/api |
| **가비아** | 도메인 DNS | https://dns.gabia.com |

## 참고 문서

- `CLAUDE.md` — AI 어시스턴트용 프로젝트 가이드
- `docs/PLATFORM_DESIGN.md` — 전체 시스템 설계 (5개 도메인, 6단계 로드맵)
- `docs/STRAVA_COMPARISON.md` — Strava vs O-Rider 기능 비교
- `README.md` — 프로젝트 소개
