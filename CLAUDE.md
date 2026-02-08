# CLAUDE.md

This file provides guidance to Claude Code when working with the O-Rider web platform.

## Build Commands

```bash
# Web frontend
cd web && npm run dev                    # 개발 서버 (Vite)
cd web && npm run build                  # 프로덕션 빌드 (tsc + vite build)
cd web && npx tsc --noEmit               # 타입 체크만

# Cloud Functions
cd functions && npx tsc                  # 빌드
cd functions && npx tsc --watch          # 워치 모드

# Firebase 배포
firebase deploy --only hosting --project orider-1ce26
firebase deploy --only functions --project orider-1ce26
firebase deploy --only firestore:rules --project orider-1ce26

# Secrets 설정 (줄바꿈 없이!)
printf 'VALUE' | firebase functions:secrets:set SECRET_NAME --project orider-1ce26 --data-file -
```

### 배포 시 주의사항

- `firebase.json`의 `predeploy`가 npm stdin 오류를 일으킬 수 있음 → 수동으로 `npx tsc` 실행 후 `predeploy: []`로 임시 변경하여 배포, 이후 복원
- Secrets 설정 시 `<<<` 사용 금지 (줄바꿈 추가됨) → 반드시 `printf | --data-file -` 사용

## Project Architecture

### 웹 프론트엔드 (`web/src/`)

```
web/src/
├── main.tsx                    # 엔트리 (BrowserRouter + AuthProvider)
├── App.tsx                     # 라우트 정의
├── contexts/
│   └── AuthContext.tsx          # Google Auth + Firestore 프로필 구독 + useAuth()
├── hooks/
│   ├── useStrava.ts            # Strava OAuth + callable 호출
│   ├── useActivities.ts        # 데모/Firestore 활동 자동 스위칭
│   └── useFirestore.ts         # useDocument, useCollection, queryDocuments
├── pages/
│   ├── HomePage.tsx            # 활동 피드 + 사이드바 (데모/실제 전환)
│   ├── ActivityPage.tsx        # 활동 상세 (Strava 스트림 지원)
│   ├── AthletePage.tsx         # 사용자 프로필
│   ├── SettingsPage.tsx        # Strava 연동 관리
│   ├── StravaCallbackPage.tsx  # OAuth 콜백 처리
│   ├── GroupDashboardPage.tsx  # 그룹 대시보드
│   └── ...
├── components/
│   ├── Layout.tsx              # 네비게이션 (로그인/로그아웃 UI 포함)
│   ├── ActivityCard.tsx        # 활동 카드
│   └── ...                     # StatCard, Charts, Avatar, ...
├── services/
│   └── firebase.ts             # auth, firestore, functions, googleProvider
└── data/
    └── demo.ts                 # 데모 데이터 (비로그인 시 사용)
```

### Cloud Functions (`functions/src/`)

```
functions/src/
├── index.ts                    # 11개 함수 export
├── strava.ts                   # Strava API 프록시 (secrets: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET)
│   ├── stravaExchangeToken     # OAuth 코드 → 토큰 교환
│   ├── stravaImportActivities  # 활동 목록 가져오기 (Ride/VirtualRide만)
│   ├── stravaGetActivityStreams # GPS 스트림 가져오기 (캐시)
│   └── stravaDisconnect        # 연동 해제
├── auth.ts
│   └── ensureUserProfile       # 첫 로그인 시 프로필 생성
├── activity.ts                 # onActivityCreate (피드 팬아웃 + 그룹 매칭)
├── kudos.ts                    # onKudosCreate/Delete
├── comment.ts                  # onCommentCreate
└── follow.ts                   # onFollowCreate/Delete
```

### 공유 타입 (`shared/types.ts`)

Activity, ActivitySummary, UserProfile, ActivityStreams, Segment, SegmentEffort, Comment, Kudos, GroupRide, FollowRelation 등

## Firestore 스키마

```
activities/{activityId}                  # 활동 (source:"strava" + stravaActivityId 가능)
activity_streams/strava_{stravaId}       # Strava GPS 스트림 캐시 (서버 작성)
users/{uid}                              # 유저 프로필 (서버 작성)
users/{uid}/strava_tokens/current        # Strava 토큰 (서버 전용, 클라이언트 접근 불가)
feed/{userId}/{activityId}               # 피드 인덱스 (서버 작성)
kudos/{activityId}/{userId}              # 좋아요
comments/{activityId}/{commentId}        # 댓글
notifications/{userId}/{notifId}         # 알림
segments/{segmentId}                     # 세그먼트
segment_efforts/{segmentId}/{effortId}   # 세그먼트 기록
following/{userId}/{targetId}            # 팔로우
followers/{targetId}/{userId}            # 팔로워 (서버 작성)
group_rides/{groupRideId}                # 그룹 라이드 (서버 작성)
```

## Key Design Patterns

### 인증 플로우
- 비로그인 → 데모 데이터 표시 (demo.ts)
- Google 로그인 → `ensureUserProfile` callable → Firestore `users/{uid}` 생성
- Strava 연동 → OAuth → `stravaExchangeToken` → 토큰 Firestore 저장

### 데이터 스위칭 (useActivities)
```
로그인 + Strava 연동됨 → Firestore 실시간 구독 (where userId == uid)
비로그인 또는 미연동 → demo.ts 데모 데이터
```

### Strava API 프록시
- Strava API는 CORS 미지원 → 모든 호출은 Cloud Functions (onCall) 경유
- client_secret은 서버에서만 사용 (Secret Manager)
- 토큰 자동 갱신 (getValidAccessToken 헬퍼)
- 스트림 데이터 Firestore 캐시 (1MB 미만)

### UI
- Tailwind CSS (orange 테마: orange-500, orange-600)
- 한국어 UI
- 반응형 (모바일/데스크톱)

## 환경 변수

### web/.env
```
VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_DATABASE_URL,
VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET,
VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID,
VITE_STRAVA_CLIENT_ID
```

### Cloud Functions Secrets
- `STRAVA_CLIENT_ID` — Strava API Client ID
- `STRAVA_CLIENT_SECRET` — Strava API Client Secret

## Dependencies

### web/
- React 19, React Router 7, Firebase 11, Chart.js 4, Leaflet 1.9
- Tailwind CSS 4, Vite 6, TypeScript 5.6

### functions/
- firebase-admin 12, firebase-functions 5
- Node 20, TypeScript 5.4

## 라우트

| 경로 | 페이지 | 인증 |
|------|--------|------|
| `/` | HomePage | 불필요 (데모 가능) |
| `/activity/:activityId` | ActivityPage | 불필요 |
| `/athlete/:userId` | AthletePage | 불필요 |
| `/group/:groupId` | GroupDashboardPage | 불필요 |
| `/segment/:segmentId` | SegmentPage | 불필요 |
| `/explore` | ExplorePage | 불필요 |
| `/settings` | SettingsPage | 필요 |
| `/strava/callback` | StravaCallbackPage | 필요 |

## 관련 프로젝트

- **o-rider/** — 모바일 앱 (Kotlin Multiplatform, Android + iOS)
- **o-rider/CLAUDE.md** — 모바일 앱 가이드
- **docs/PLATFORM_DESIGN.md** — 전체 시스템 설계 문서
