# O-Rider Web Platform

O-Rider 사이클링 앱의 웹 대시보드 + Cloud Functions 백엔드.

**Live**: https://orider-1ce26.web.app

## 기능

- **활동 피드** — 라이딩 기록 타임라인, 통계, 차트
- **Google 로그인** — Firebase Auth 기반
- **Strava 연동** — OAuth 인증 → 활동 가져오기 → GPS 스트림 차트
- **데모 모드** — 비로그인 시 샘플 데이터로 UI 체험
- **그룹 대시보드** — 그룹 라이딩 통계, 멤버 비교
- **세그먼트 리더보드** — KOM/QOM 기록

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Vite 6 |
| Charts | Chart.js 4, react-chartjs-2 |
| Maps | Leaflet, react-leaflet |
| Backend | Firebase Cloud Functions (Node 20, 2nd Gen) |
| DB | Firestore |
| Auth | Firebase Auth (Google Sign-In) |
| Hosting | Firebase Hosting |

## 프로젝트 구조

```
o-rider-platform/
├── web/                    # React 프론트엔드
│   └── src/
│       ├── contexts/       # AuthContext (Google Auth)
│       ├── hooks/          # useStrava, useActivities, useFirestore
│       ├── pages/          # Home, Activity, Athlete, Settings, StravaCallback, ...
│       ├── components/     # Layout, ActivityCard, Charts, ...
│       ├── services/       # Firebase SDK 초기화
│       └── data/           # 데모 데이터
├── functions/              # Cloud Functions
│   └── src/
│       ├── strava.ts       # Strava API 프록시 (4 callables)
│       ├── auth.ts         # ensureUserProfile
│       ├── activity.ts     # 피드 팬아웃 + 그룹 라이드 매칭
│       ├── kudos.ts        # kudos 카운트 + 알림
│       ├── comment.ts      # 댓글 카운트 + 알림
│       └── follow.ts       # 팔로우/팔로워 동기화
├── shared/                 # 공유 TypeScript 타입
│   └── types.ts
├── firestore/              # Firestore 보안 규칙
│   └── firestore.rules
└── firebase.json           # Firebase 배포 설정
```

## 로컬 개발

```bash
# 의존성 설치
cd web && npm install
cd ../functions && npm install

# 웹 개발 서버
cd web && npm run dev

# Functions 빌드
cd functions && npx tsc --watch
```

## 환경 변수

### `web/.env`
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=orider-1ce26.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=orider-1ce26
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_STRAVA_CLIENT_ID=194266
```

### Cloud Functions Secrets
```bash
printf 'VALUE' | firebase functions:secrets:set STRAVA_CLIENT_ID --project orider-1ce26 --data-file -
printf 'VALUE' | firebase functions:secrets:set STRAVA_CLIENT_SECRET --project orider-1ce26 --data-file -
```

## 배포

```bash
# 웹 빌드 + 배포
cd web && npm run build
firebase deploy --only hosting --project orider-1ce26

# Functions 빌드 + 배포
cd functions && npx tsc
firebase deploy --only functions --project orider-1ce26

# Firestore 규칙 배포
firebase deploy --only firestore:rules --project orider-1ce26

# 전체 배포
firebase deploy --project orider-1ce26
```

## Strava 연동 플로우

```
1. 사용자 → "Strava 연동" 클릭
2. 브라우저 → Strava OAuth authorize (client_id, redirect_uri)
3. Strava → /strava/callback?code=XXX 리다이렉트
4. StravaCallbackPage → stravaExchangeToken (Cloud Function)
5. Cloud Function → Strava token exchange (client_secret 서버 보호)
6. Cloud Function → Firestore에 토큰 저장 + 프로필 업데이트
7. StravaCallbackPage → stravaImportActivities (최근 30개)
8. Cloud Function → Strava API → 활동 변환 → Firestore 저장
9. HomePage → Firestore 실시간 구독 → UI 표시
```

## 사전 설정

1. [Firebase Console](https://console.firebase.google.com/project/orider-1ce26) → Authentication → Google 활성화
2. [Strava API](https://www.strava.com/settings/api) → Authorization Callback Domain = `orider-1ce26.web.app`
3. Firebase Blaze 플랜 (Cloud Functions 필수)
