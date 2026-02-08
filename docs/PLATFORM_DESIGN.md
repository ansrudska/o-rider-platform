# O-Rider 한국형 스트라바 시스템 설계

## Context

스트라바가 2025년 3월 한국 시장에서 철수하면서, 한국 사이클리스트 수십만 명이 대체 앱을 찾고 있다.
O-Rider는 이미 사이클링 컴퓨터 + 그룹 라이딩 기능을 갖추고 있으며, 여기에 SNS + 세그먼트 + 대시보드를 추가하여 한국형 스트라바로 확장한다.

핵심 목표: **스트라바 이탈 유저의 전환 장벽을 낮추고, SNS 네트워크 효과로 락인**

---

## 시스템 구성 (5개 도메인)

```
┌─────────────────────────────────────────────────────────┐
│                    O-Rider Platform                      │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│  D1      │  D2      │  D3      │  D4      │  D5         │
│  Activity│  Social  │  Segment │  Migration│  Dashboard  │
│  Engine  │  (SNS)   │  Engine  │  Bridge   │  (Web)      │
├──────────┼──────────┼──────────┼──────────┼─────────────┤
│ 활동 업로드│ 피드     │ 세그먼트  │ 스트라바   │ 웹 대시보드  │
│ 사진 첨부 │ Kudos    │ 리더보드  │ GPX 임포트│ 그룹 통계   │
│ GPX 저장 │ 댓글     │ PR 관리  │ 사진 임포트│ 경로 지도   │
│ 세션 요약 │ 알림     │ 클라이언트│ 기록 복원 │ 멤버 비교   │
│ 사진 저장 │ 팔로우   │ 매칭     │ API 연동  │ 차트/그래프 │
│          │ 공유     │          │           │             │
└──────────┴──────────┴──────────┴──────────┴─────────────┘
          │                                       │
          ▼                                       ▼
┌─────────────────────┐         ┌─────────────────────────┐
│  Firebase (Backend)  │         │  Mobile App (변경사항)    │
├─────────────────────┤         ├─────────────────────────┤
│ Realtime DB          │         │ 라이딩 종료 → 활동 업로드  │
│ Firestore            │         │ 세그먼트 로컬 매칭        │
│ Cloud Storage        │         │ SNS UI (피드, 사진)      │
│ Cloud Functions      │         │ 스트라바 마이그레이션 UI   │
│ Auth (기존)          │         │ HR/파워 존, PR 표시      │
│ Hosting (웹)         │         │                         │
└─────────────────────┘         └─────────────────────────┘
```

---

## 도메인별 상세

### D1. Activity Engine (활동 엔진)

**역할**: 라이딩 기록을 클라우드에 저장하고 조회하는 핵심 파이프라인

```
라이딩 종료
  → 세션 요약 생성 (거리, 시간, 속도, HR, 파워, 케이던스, 획득고도)
  → Firebase 업로드:
      Firestore: /activities/{activityId}         ← 요약 + 메타데이터
      Cloud Storage: /rides/{userId}/{id}.gpx     ← 전체 트랙포인트
      Cloud Storage: /photos/{userId}/{id}/       ← 사진
```

**데이터 모델**:
```
activities/{activityId}
  ├── userId, nickname, profileImage
  ├── type: "ride"
  ├── createdAt, startTime, endTime
  ├── summary/
  │   ├── distance, ridingTimeMillis
  │   ├── averageSpeed, maxSpeed
  │   ├── averageCadence, maxCadence
  │   ├── averageHeartRate, maxHeartRate
  │   ├── averagePower, maxPower, normalizedPower
  │   ├── elevationGain
  │   ├── calories
  │   └── relativeEffort (TRIMP)
  ├── thumbnailTrack: "encoded_polyline"
  ├── groupId: null | "group123"        ← 그룹 라이딩이면
  ├── groupRideId: null | "gr456"       ← 같은 그룹 라이드 식별
  ├── photoCount: 3
  ├── kudosCount: 7
  ├── commentCount: 4
  ├── segmentEffortCount: 5
  ├── description: "한강 잠실-여의도 왕복"
  ├── visibility: "friends"             ← everyone/friends/private
  └── gpxPath: "rides/abc123/act1.gpx"

activity_photos/{activityId}/{photoId}
  ├── storagePath, thumbnailPath
  ├── latitude, longitude
  ├── timestamp
  └── caption (선택)
```

### D2. Social / SNS

**역할**: 활동 피드, Kudos, 댓글, 알림, 팔로우, 공유

```
피드 구조:
  - Firestore: /feed/{userId}/{activityId}  ← 팔로우한 사람의 활동 인덱스
  - Cloud Functions: 활동 업로드 시 팔로워에게 팬아웃

Kudos:
  - Firestore: /kudos/{activityId}/{userId}
  - Cloud Functions: kudos 시 activity.kudosCount 증가 + 알림 발송

댓글:
  - Firestore: /comments/{activityId}/{commentId}
  - Cloud Functions: 댓글 시 activity.commentCount 증가 + 알림 발송

알림:
  - Firestore: /notifications/{userId}/{notifId}
  - FCM 푸시 (Cloud Functions에서 발송)

팔로우:
  - Firestore: /following/{userId}/{targetId}
  - Firestore: /followers/{targetId}/{userId}
```

### D3. Segment Engine (세그먼트 엔진)

**역할**: 세그먼트 정의, 클라이언트 매칭, 리더보드, PR

#### 세그먼트 생성 3가지 방식

```
방식 1: 운영자 사전등록
  - 한국 주요 코스를 GPX/좌표로 미리 등록
  - 대상: 남산, 북한산, 4대강 종주 구간, 유명 힐클라임
  - source: "official"
  - 관리자 도구 (웹 대시보드 or 스크립트)로 일괄 등록

방식 2: 유저 생성
  - 라이딩 완료 후 트랙에서 구간 선택 → 세그먼트 생성
  - source: "user"
  - 모더레이션: 중복 감지 (기존 세그먼트와 80% 이상 겹치면 경고)

방식 3: 자동 감지
  - ClimbDetector(기존)가 힐클라임 감지 → 세그먼트 후보 제안
  - source: "auto"
  - 유저 승인 후 세그먼트로 등록 (자동 등록 X, 노이즈 방지)
  - 기준: Cat4 이상 (500m+, 3%+ 경사)
```

#### 세그먼트 데이터 모델

```
Firestore: /segments/{segmentId}
  ├── name, description
  ├── creatorId
  ├── source: "official" | "user" | "auto"
  ├── status: "active" | "pending" | "hidden"
  ├── startLat, startLon, endLat, endLon
  ├── polyline: "encoded_polyline"
  ├── distance, elevationGain, averageGrade
  ├── geoHash (시작점 기준)
  ├── category: "climb" | "sprint" | "flat"
  ├── climbCategory: null | "4" | "3" | "2" | "1" | "HC"
  ├── totalEfforts, starCount
  ├── kom/                               ← KOM (King of Mountain)
  │   ├── time, userId, nickname, recordedAt
  └── qom/                               ← QOM (Queen of Mountain)
      ├── time, userId, nickname, recordedAt
```

#### 세그먼트 매칭 (클라이언트)

```
1. 라이딩 시작 → GeoHash로 주변 세그먼트 다운로드 (반경 ~5km)
2. 라이딩 중 → 트랙포인트가 세그먼트 시작점 50m 반경 진입 시 매칭 시작
3. 세그먼트 폴리라인과 경로 유사도 확인 (30m 이내 유지)
4. 이탈 시 매칭 취소, 종료점 50m 반경 도착 시 기록 완성
5. 로컬 PR 비교 후 결과 업로드
```

#### 세그먼트 기록 + PR

```
Firestore: /segment_efforts/{segmentId}/{effortId}
  ├── userId, nickname
  ├── activityId
  ├── elapsedTime (ms)
  ├── averageSpeed, averageHeartRate, averagePower, averageCadence
  ├── recordedAt
  └── rank (Cloud Functions에서 계산)

Firestore: /user_prs/{userId}/segments/{segmentId}
  ├── bestTime, secondBest, thirdBest
  ├── bestEffortId, secondEffortId, thirdEffortId
  ├── totalEfforts
  └── lastEffortAt
```

### D4. Migration Bridge (스트라바 마이그레이션)

**역할**: 스트라바 데이터 → O-Rider 전환

```
방법 1: API 임포트 (OAuth 이미 있음)
  1. GET /athlete/activities → 활동 목록
  2. GET /activities/{id}/streams → 트랙포인트
  3. GET /activities/{id}/photos → 사진 URL
  4. 각 활동 → Activity Engine으로 저장
  5. 세그먼트 매칭 → PR 자동 생성
  * Rate limit: 15분당 100건 → 백그라운드 점진적 임포트

방법 2: ZIP 임포트
  1. 사용자가 스트라바 ZIP 선택
  2. activities/ → GPX 파싱 (GpxParser 기존)
  3. photos/ → EXIF GPS 추출 → 활동에 매핑
  4. 세그먼트 매칭 → PR 생성
```

### D5. Web Dashboard

**역할**: 그룹 라이딩 통계, 멤버 비교, 경로 지도

```
기술 스택:
  - React + TypeScript
  - Firebase SDK (Auth, Firestore, Storage)
  - Leaflet (OSM 지도)
  - Chart.js (차트/그래프)
  - Firebase Hosting 배포

주요 페이지:
  1. 그룹 대시보드 (/group/{groupId})
     - 그룹 라이딩 목록
     - 멤버별 참여 기록
     - 누적 통계 (총 거리, 횟수)
  2. 그룹 라이드 상세 (/group/{groupId}/ride/{rideId})
     - 참가자 비교 (HR, 파워, 케이던스)
     - 경로 지도
     - 사진 갤러리
  3. 세그먼트 리더보드 (/segment/{segmentId})
     - 전체 / 친구 / 그룹 필터
     - KOM 표시
  4. 개인 프로필 (/athlete/{userId})
     - 활동 히스토리
     - PR 목록
     - Progress Chart (주/월별 추이)
```

---

## 인프라 구조

```
Firebase (orider-1ce26) - 기존 GCP 프로젝트 확장
│
├── Realtime DB (기존 유지)
│   ├── /locations/        실시간 위치 (기존)
│   ├── /groups/           그룹 관리 (기존)
│   ├── /group_members/    그룹 멤버 (기존)
│   └── /route_sharing/    P2P 경로 공유 (기존)
│
├── Firestore (신규)
│   ├── /activities/       활동 피드
│   ├── /feed/             팔로우 피드 인덱스
│   ├── /kudos/            좋아요
│   ├── /comments/         댓글
│   ├── /notifications/    알림
│   ├── /segments/         세그먼트 정의
│   ├── /segment_efforts/  세그먼트 기록
│   ├── /user_prs/         PR
│   ├── /following/        팔로우 관계
│   └── /followers/        팔로워 관계
│
├── Cloud Storage (신규)
│   ├── /rides/{userId}/   GPX 파일
│   └── /photos/{userId}/  사진 (원본 + 썸네일)
│
├── Cloud Functions (신규)
│   ├── onActivityCreate   → 피드 팬아웃 + 그룹 라이드 매칭
│   ├── onKudosCreate      → kudosCount 증가 + 푸시 알림
│   ├── onCommentCreate    → commentCount 증가 + 푸시 알림
│   ├── onSegmentEffort    → 리더보드 순위 계산 + KOM 갱신
│   └── scheduledAggregation → 주/월 통계 집계
│
├── Auth (기존)
│   └── 익명 + Google Sign-In
│
└── Hosting (신규)
    └── 웹 대시보드 (React)
```

**기존 Realtime DB는 그대로 유지** (실시간 위치, 그룹 관리 등)
**신규 데이터는 Firestore에** (복합 쿼리, 정렬, 필터에 강함)

---

## 구현 페이즈

### Phase 1: 활동 업로드 + 그룹 대시보드 (MVP)

모바일:
- 라이딩 종료 → Firestore에 활동 요약 업로드
- Cloud Storage에 GPX 업로드
- 그룹 라이딩이면 groupRideId 자동 부여

웹 대시보드:
- React 프로젝트 초기화 + Firebase Hosting
- 그룹 라이딩 목록 / 멤버별 기록 비교
- 경로 지도 (Leaflet + OSM)

결과: 그룹 라이딩 기록을 웹에서 조회 + 비교 가능

### Phase 2: SNS 기본 루프

모바일:
- 활동 피드 UI (친구들의 최근 활동)
- Kudos (좋아요)
- 카카오톡 공유 (라이딩 카드 이미지 생성)

서버:
- Cloud Functions: 피드 팬아웃, kudos 카운트, 푸시 알림

결과: "타고 → 올리고 → 보고 → 좋아요" 기본 SNS 순환

### Phase 3: 사진 + 댓글

모바일:
- 라이딩 중/후 사진 첨부 (EXIF GPS → 지도 매핑)
- 댓글 UI
- 알림 센터

서버:
- Cloud Storage 사진 업로드/썸네일 생성
- Cloud Functions: 댓글 카운트, 알림

결과: SNS 완성 (사진 + 소통)

### Phase 4: 세그먼트 + PR

모바일:
- 주변 세그먼트 다운로드 (GeoHash)
- 라이딩 중 세그먼트 로컬 매칭
- PR 관리 (로컬 + 서버 동기화)
- 세그먼트 탐색/생성 UI

웹 대시보드:
- 세그먼트 리더보드 페이지
- KOM 표시

서버:
- Cloud Functions: 리더보드 순위 계산

결과: 경쟁 + 동기부여 요소 완성

### Phase 5: 스트라바 마이그레이션

모바일:
- "스트라바에서 가져오기" UI
- API 임포트 (백그라운드 점진적)
- ZIP 임포트 (GPX + 사진)
- 임포트된 활동에서 세그먼트 매칭 → PR 자동 생성

결과: 스트라바 이탈 유저의 전환 장벽 해소

### Phase 6: 고급 분석 + 한국 특화

모바일:
- HR/파워 존 설정 + 존별 분석
- Relative Effort (TRIMP)
- Fitness & Freshness 그래프
- Matched Activities (같은 경로 추이)
- 프라이버시 존

웹 대시보드:
- 개인 프로필 + Progress Chart
- 연간 리뷰 (Year in Sport)

한국 특화:
- 한국 주요 코스 세그먼트 사전 등록 (남산, 북한산, 4대강 등)
- 인증 배지 시스템
- 코스 리뷰/별점

---

## 비용 추정 (Phase별 누적)

| Phase | 유저 수 | 월 비용 | 누적 인프라 |
|-------|-------:|--------:|------------|
| 1 | ~1,000 | ~₩0 | Firebase 무료 티어 |
| 2 | ~5,000 | ~₩5만 | + Cloud Functions |
| 3 | ~10,000 | ~₩15만 | + Cloud Storage |
| 4 | ~30,000 | ~₩80만 | + Firestore 쿼리 증가 |
| 5 | ~50,000 | ~₩150만 | + 마이그레이션 트래픽 |
| 6 | ~100,000 | ~₩300만 | + 분석 데이터 |

---

## 결정사항

| 항목 | 결정 |
|------|------|
| DB 분리 | 기존 Realtime DB 유지 + 신규는 Firestore |
| 웹 프레임워크 | React + TypeScript |
| 그룹 라이드 매칭 | 자동 매칭 (같은 그룹 + 시간 겹침) |
| 세그먼트 생성 | 3가지 모두: 운영자 사전등록 + 유저 생성 + 자동 감지 |
| Phase 1 플랫폼 | Android 먼저 (iOS는 개발 중이므로 Phase 2~) |

---

## 그룹 라이드 자동 매칭 로직

```
Cloud Functions: onActivityCreate

1. 새 활동이 업로드됨 (groupId 있음)
2. 같은 groupId의 최근 24시간 활동 조회
3. 시간 겹침 판단:
   - 새 활동의 startTime ~ endTime과
   - 기존 활동의 startTime ~ endTime이
   - 30분 이상 겹치면 같은 그룹 라이드로 판정
4. 매칭된 활동들에 같은 groupRideId 부여
   - 이미 groupRideId가 있으면 그것 사용
   - 없으면 새로 생성

Firestore: /group_rides/{groupRideId}
  ├── groupId
  ├── startTime (가장 빠른 멤버 기준)
  ├── endTime (가장 늦은 멤버 기준)
  ├── participantCount
  ├── totalDistance (합산)
  ├── participants/
  │   ├── {userId1}/
  │   │   ├── activityId, nickname
  │   │   ├── distance, ridingTimeMillis
  │   │   ├── averageSpeed, averageHeartRate, averagePower
  │   │   └── averageCadence
  │   └── {userId2}/ ...
  └── createdAt
```

---

## 도메인 의존 관계

```
D4 Migration ──→ D1 Activity ──→ D2 Social
                      │              │
                      │              ├── 피드 팬아웃
                      │              ├── Kudos/댓글
                      │              └── 알림
                      │
                      ├──→ D3 Segment
                      │       ├── 매칭 (클라이언트)
                      │       ├── 리더보드/PR
                      │       └── KOM
                      │
                      └──→ D5 Dashboard
                              ├── 그룹 라이드 조회
                              ├── 세그먼트 리더보드
                              └── 개인 프로필

의존 순서:
  D1 (Activity) → 모든 도메인의 기반. 반드시 먼저 구현
  D3 (Segment) → D1에 의존. 활동이 있어야 매칭 가능
  D2 (Social)  → D1에 의존. 활동이 있어야 피드 생성
  D4 (Migration) → D1, D3에 의존. 활동 저장 + 세그먼트 매칭 필요
  D5 (Dashboard) → D1, D2, D3 모두 활용
```

---

## Firestore 보안 규칙 (핵심)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 활동: 본인만 쓰기, visibility에 따라 읽기
    match /activities/{activityId} {
      allow create: if request.auth != null
                    && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null
                  && (resource.data.userId == request.auth.uid
                      || resource.data.visibility == "everyone"
                      || (resource.data.visibility == "friends"
                          && isFriend(request.auth.uid, resource.data.userId)));
      allow update, delete: if request.auth.uid == resource.data.userId;
    }

    // 세그먼트: 누구나 읽기, 인증된 유저만 생성
    match /segments/{segmentId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.creatorId
                    || isAdmin(request.auth.uid);
    }

    // 세그먼트 기록: 본인만 쓰기, 누구나 읽기 (리더보드)
    match /segment_efforts/{segmentId}/{effortId} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.data.userId == request.auth.uid;
    }

    // Kudos: 인증된 유저만
    match /kudos/{activityId}/{userId} {
      allow read: if request.auth != null;
      allow create, delete: if request.auth.uid == userId;
    }

    // 댓글: 인증된 유저만 쓰기, 본인 것만 삭제
    match /comments/{activityId}/{commentId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.userId;
    }

    // 알림: 본인 것만 읽기/업데이트
    match /notifications/{userId}/{notifId} {
      allow read, update: if request.auth.uid == userId;
    }

    // 피드: 본인 것만 읽기
    match /feed/{userId}/{activityId} {
      allow read: if request.auth.uid == userId;
    }

    // 팔로우: 본인만 관리
    match /following/{userId}/{targetId} {
      allow read: if request.auth != null;
      allow create, delete: if request.auth.uid == userId;
    }
    match /followers/{targetId}/{userId} {
      allow read: if request.auth != null;
      // Cloud Functions에서만 쓰기 (팔로우 시 자동)
    }

    // 그룹 라이드: 참가자만 읽기
    match /group_rides/{groupRideId} {
      allow read: if request.auth != null;
      // Cloud Functions에서만 쓰기 (자동 매칭)
    }

    // PR: 본인 것만 쓰기/읽기
    match /user_prs/{userId}/segments/{segmentId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
