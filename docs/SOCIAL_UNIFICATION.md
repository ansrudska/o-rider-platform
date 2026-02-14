# 소셜 시스템 통합 설계: 팔로우 → 친구(양방향)

> **상태**: 설계 완료, 구현 대기
> **결정**: 양방향 친구 모델로 통합 (모바일 앱 방식 채택)
> **영향 범위**: Cloud Functions 3개, Firestore Rules 1개, 웹 3개, 모바일 2개

---

## 1. 현재 상태 (As-Is)

같은 계정이라도 앱 친구 ≠ 웹 팔로우. 앱에서 친구 추가해도 웹에서 상대의 "friends" 활동을 볼 수 없음.

| | 모바일 앱 | 웹 대시보드 |
|---|---|---|
| **DB** | RTDB `/friends/{A}/{B}` | Firestore `following/{A}/users/{B}` |
| **모델** | 양방향 (상호 수락) | 단방향 팔로우 |
| **추가 방법** | 친구코드 (5자) / 요청+수락 | 팔로우 버튼 (즉시) |
| **역방향** | 클라이언트가 양쪽 동시 쓰기 | CF가 `followers/` 미러 생성 |
| **친구 요청** | RTDB `/friend_requests/{target}/{requester}` | 없음 |
| **온라인 상태** | RTDB `/locations/` 기반 | 미지원 |
| **피드 팬아웃** | 없음 (앱에서 피드 미사용) | CF `onActivityCreate` → `followers/` 조회 |
| **Visibility 규칙** | 앱 내 `LocationVisibility` | Firestore Rules `isFollowing()` |
| **CF 트리거** | 없음 | `onFollowCreate`, `onFollowDelete` |

### 현재 RTDB 구조 (모바일)

```
/friends/{userId}/{friendId}
  └── addedAt: number (millis)

/friend_requests/{targetId}/{requesterId}
  └── requestedAt: number (millis)

/users/{userId}
  ├── nickname: string
  └── friendCode: string (5자)

/locations/{userId}
  ├── isSharing: boolean
  └── timestamp: number
```

### 현재 Firestore 구조 (웹)

```
following/{userId}/users/{targetId}
  ├── userId: string
  ├── nickname: string
  ├── profileImage: string | null
  └── createdAt: Timestamp

followers/{targetId}/users/{userId}   ← CF가 자동 생성
  ├── userId: string
  ├── nickname: string
  ├── profileImage: string | null
  └── createdAt: Timestamp
```

### 현재 코드 참조

| 파일 | 역할 |
|------|------|
| `functions/src/follow.ts` | `onFollowCreate`: followers 미러 + 알림, `onFollowDelete`: followers 제거 |
| `functions/src/activity.ts:32-79` | `fanOutToFollowers()`: `followers/` 조회 → `feed/` 팬아웃 |
| `firestore/firestore.rules:6-8` | `isFollowing()` 헬퍼 → activity visibility 판단 |
| `web/src/pages/AthletePage.tsx` | 팔로우/언팔로우 버튼, follower/following 카운트 |
| `shared/types.ts:165-170` | `FollowRelation` 타입 |
| `android/.../FriendRealtimeClient.kt` | RTDB 양방향 친구 CRUD, 친구코드 검색 |
| `shared/.../Friend.kt` | `Friend`, `FriendRequest` KMP 모델 |

---

## 2. 목표 상태 (To-Be)

### 핵심 원칙

1. **Firestore `friends/` 컬렉션이 단일 소스 (Single Source of Truth)**
2. **양방향**: A→B 생성 시 CF가 B→A도 자동 생성
3. **친구코드, 요청+수락 모두 지원** (모바일과 동일한 UX)
4. **RTDB `/friends/`는 위치 공유 필터 전용** — CF가 Firestore→RTDB 자동 동기화
5. **웹 `following/`, `followers/` 폐기** (마이그레이션 후 삭제)

### 통합 후 흐름

```
[웹] 친구 요청 버튼 클릭
  → Firestore friend_requests/{targetId}/items/{requesterId} 생성
  → CF: 상대에게 알림

[웹/앱] 상대가 수락
  → Firestore friends/{A}/users/{B} 생성
  → CF: friends/{B}/users/{A} 자동 생성 (양방향)
  → CF: RTDB /friends/{A}/{B}, /friends/{B}/{A} 동기화
  → CF: friend_requests 삭제 + 알림

[앱] 친구코드로 추가
  → Firestore friends/{A}/users/{B} 생성 (또는 callable)
  → CF: 위와 동일한 양방향 처리
```

---

## 3. Firestore 스키마 변경

### 새 컬렉션

```
friends/{userA}/users/{userB}                    # 친구 관계 (양방향)
  ├── userId: string                             # = userB
  ├── nickname: string
  ├── profileImage: string | null
  ├── friendCode: string | null                  # 모바일 호환
  └── createdAt: Timestamp

friend_requests/{targetId}/items/{requesterId}   # 친구 요청
  ├── requesterId: string
  ├── nickname: string
  ├── profileImage: string | null
  └── createdAt: Timestamp
```

### 폐기 컬렉션 (마이그레이션 후 삭제)

```
following/{userId}/users/{targetId}              # → friends/로 대체
followers/{targetId}/users/{userId}              # → friends/ 양방향으로 불필요
```

### RTDB 변경 없음 (하위 호환)

```
/friends/{userId}/{friendId}                     # CF가 Firestore→RTDB 동기화
  └── addedAt: number

/friend_requests/{targetId}/{requesterId}        # 모바일은 기존 RTDB 경로 유지 가능
  └── requestedAt: number                        # (점진적으로 Firestore로 전환)
```

---

## 4. 변경 대상 파일

### Cloud Functions (3개)

#### `functions/src/friend.ts` (신규, `follow.ts` 대체)

```typescript
// 1. onFriendCreate: friends/{userA}/users/{userB} 생성 트리거
//    - 역방향 friends/{userB}/users/{userA} 존재 여부 확인
//    - 없으면 자동 생성 (양방향 완성)
//    - RTDB /friends/{userA}/{userB} 동기화
//    - 알림: "{nickname}님과 친구가 되었습니다."

// 2. onFriendDelete: friends/{userA}/users/{userB} 삭제 트리거
//    - 역방향 friends/{userB}/users/{userA} 삭제
//    - RTDB /friends/{userA}/{userB}, /friends/{userB}/{userA} 삭제

// 3. onFriendRequestCreate: friend_requests/{targetId}/items/{requesterId} 생성 트리거
//    - 알림: "{nickname}님이 친구 요청을 보냈습니다."

// 4. acceptFriendRequest (callable):
//    - friend_requests 삭제
//    - friends/{A}/users/{B} 생성 → onFriendCreate가 양방향 처리

// 5. addFriendByCode (callable):
//    - friendCode로 사용자 조회 (Firestore users/ 또는 RTDB /users/)
//    - friends/{A}/users/{B} 생성 → onFriendCreate가 양방향 처리
```

**무한 루프 방지**: `onFriendCreate`에서 역방향 생성 시, 이미 존재하면 스킵.

#### `functions/src/activity.ts` (수정)

```diff
- const followersSnap = await db
-   .collection("followers")
-   .doc(userId)
-   .collection("users")
-   .get();
+ const friendsSnap = await db
+   .collection("friends")
+   .doc(userId)
+   .collection("users")
+   .get();

- // friends visibility면 팔로우 관계 확인
- if (activity.visibility === "friends") {
-   const isFollowing = await db
-     .collection("following")
-     .doc(userId)
-     .collection(followerId)
-     .get();
-   if (isFollowing.empty) continue;
- }
+ // friends visibility: friends/ 컬렉션은 이미 양방향이므로 추가 확인 불필요
```

`friends/` 컬렉션이 양방향이므로 `friends/{userId}/users/` 조회만으로 충분. `visibility === "friends"` 시 상호 팔로우 확인이 불필요해짐 (이미 양방향).

#### `functions/src/index.ts` (수정)

```diff
- export { onFollowCreate, onFollowDelete } from "./follow";
+ export {
+   onFriendCreate,
+   onFriendDelete,
+   onFriendRequestCreate,
+   acceptFriendRequest,
+   addFriendByCode,
+ } from "./friend";
```

### Firestore Rules (1개)

#### `firestore/firestore.rules` (수정)

```diff
- // Helper: check if user follows target
- function isFollowing(userId, targetId) {
-   return exists(/databases/$(database)/documents/following/$(userId)/users/$(targetId));
- }
+ // Helper: check if users are friends
+ function isFriend(userId, targetId) {
+   return exists(/databases/$(database)/documents/friends/$(userId)/users/$(targetId));
+ }

  // Activities: visibility-based read
  allow read: if resource.data.visibility == "everyone"
              || (request.auth != null
                  && (resource.data.userId == request.auth.uid
                      || (resource.data.visibility == "friends"
-                         && isFollowing(request.auth.uid, resource.data.userId))));
+                         && isFriend(request.auth.uid, resource.data.userId))));

- // Following
- match /following/{userId}/users/{targetId} {
-   allow read: if request.auth != null;
-   allow create, delete: if request.auth != null && request.auth.uid == userId;
- }
-
- // Followers (written by Cloud Functions)
- match /followers/{targetId}/users/{userId} {
-   allow read: if request.auth != null;
- }

+ // Friends (양방향, CF가 역방향 자동 생성)
+ match /friends/{userId}/users/{friendId} {
+   allow read: if request.auth != null;
+   allow create: if request.auth != null && request.auth.uid == userId;
+   allow delete: if request.auth != null
+                  && (request.auth.uid == userId || request.auth.uid == friendId);
+ }
+
+ // Friend Requests
+ match /friend_requests/{targetId}/items/{requesterId} {
+   allow read: if request.auth != null
+                && (request.auth.uid == targetId || request.auth.uid == requesterId);
+   allow create: if request.auth != null && request.auth.uid == requesterId;
+   allow delete: if request.auth != null
+                  && (request.auth.uid == targetId || request.auth.uid == requesterId);
+ }
```

### 웹 (3개)

#### `web/src/pages/AthletePage.tsx` (수정)

- "팔로우" / "팔로잉" 버튼 → "친구 요청" / "친구" / "요청 취소" 상태 분기
- `following/` 대신 `friends/`, `friend_requests/` 조회
- follower/following 카운트 → 친구 수 (`friends/{userId}/users` 크기)
- 친구 요청 수락/거절 UI 추가 (알림에서 진입 시)

#### `shared/types.ts` (수정)

```diff
- export interface FollowRelation {
+ export interface FriendRelation {
    userId: string;
    nickname: string;
    profileImage: string | null;
+   friendCode: string | null;
    createdAt: number;
  }

+ export interface FriendRequest {
+   requesterId: string;
+   nickname: string;
+   profileImage: string | null;
+   createdAt: number;
+ }

  export interface Notification {
    id: string;
-   type: 'kudos' | 'comment' | 'follow' | 'group_invite' | 'kom';
+   type: 'kudos' | 'comment' | 'friend_request' | 'friend_accept' | 'group_invite' | 'kom';
    // ...
  }
```

#### `web/src/hooks/useActivities.ts` (변경 불필요)

현재 `activities` 컬렉션 직접 쿼리 + Firestore Rules의 visibility 기반 접근 제어. Rules에서 `isFollowing()` → `isFriend()`로 변경하면 자동 적용.

### 모바일 (2개)

#### `android/core-firebase/.../FriendRealtimeClient.kt` (수정)

**옵션 A — Firestore 직접 쓰기 추가** (권장):
- `acceptFriendRequest()`, `acceptFriendByCode()`, `removeFriend()` 에서 RTDB 쓰기 + Firestore `friends/` 쓰기 병렬 수행
- CF가 양방향 + RTDB 동기화 처리하므로, Firestore 한쪽만 써도 됨
- 읽기는 기존 RTDB 리스너 유지 (실시간 위치 공유에 RTDB 필수)

**옵션 B — Callable Function 전환**:
- `acceptFriendRequest`, `addFriendByCode` callable 호출
- 서버에서 Firestore + RTDB 모두 처리
- 클라이언트 코드 단순화, 오프라인 지원 약화

#### `android/app/build.gradle.kts` (조건부)

옵션 A 선택 시 `firebase-firestore` 의존성 추가 필요:
```kotlin
implementation(platform("com.google.firebase:firebase-bom:33.x.x"))
implementation("com.google.firebase:firebase-firestore")
```

---

## 5. 마이그레이션 전략

### Phase 1: 새 컬렉션 + CF 배포

1. `friend.ts` CF 배포 (기존 `follow.ts`와 병행)
2. Firestore Rules에 `friends/`, `friend_requests/` 규칙 추가
3. 기존 `following/`, `followers/` 규칙 유지 (하위 호환)

### Phase 2: 데이터 마이그레이션 (일회성 스크립트)

```typescript
// migration-social.ts (Admin SDK 스크립트)

// 1. 상호 팔로우 → friends/ 변환
//    A가 B를 팔로우 AND B가 A를 팔로우 → friends/{A}/users/{B} + friends/{B}/users/{A}
const followingSnap = await db.collectionGroup("users").get();
// ... 상호 관계 탐지 후 friends/ 생성

// 2. 단방향 팔로우 처리
//    A→B (B→A 없음) → friend_requests/{B}/items/{A} 변환 또는 삭제
//    사용자에게 "기존 팔로우가 친구 요청으로 전환됨" 알림

// 3. RTDB /friends/ 기존 데이터는 유지 (CF가 이후 동기화)
//    기존 RTDB 친구 → Firestore friends/에도 복사
```

### Phase 3: 웹 UI 전환

1. `AthletePage.tsx` 팔로우 → 친구 UI 전환
2. `shared/types.ts` 타입 변경
3. 구버전 호환 코드 제거

### Phase 4: 정리

1. `follow.ts` CF 삭제
2. Firestore Rules에서 `following/`, `followers/` 규칙 제거
3. `following/`, `followers/` 컬렉션 데이터 삭제 (선택)

---

## 6. 검증 시나리오

### 빌드 검증

```bash
cd o-rider-platform/web && npx tsc --noEmit        # 타입 체크
cd o-rider-platform/functions && npx tsc            # CF 빌드
firebase deploy --only firestore:rules --project orider-1ce26  # Rules 배포
```

### 기능 검증

| # | 시나리오 | 기대 결과 |
|---|---------|----------|
| 1 | 웹에서 친구 요청 전송 | `friend_requests/{B}/items/{A}` 생성, B에게 알림 |
| 2 | 웹에서 친구 요청 수락 | `friends/{A}/users/{B}` + `friends/{B}/users/{A}` 생성, RTDB 동기화, 요청 삭제 |
| 3 | 앱에서 친구코드로 추가 | Firestore `friends/` 양방향 생성, RTDB 동기화 |
| 4 | 웹에서 친구 확인 | AthletePage에서 "친구" 상태 표시, 친구 수 정확 |
| 5 | 앱에서 추가한 친구 → 웹에서 확인 | 웹 AthletePage에서도 친구로 표시 |
| 6 | friends visibility 활동 | 친구만 열람 가능, 비친구는 차단 |
| 7 | 친구 삭제 | 양쪽 `friends/` + RTDB 모두 삭제 |
| 8 | 피드 팬아웃 | 활동 생성 시 `friends/` 기반 팬아웃 정상 작동 |

### 엣지 케이스

| 케이스 | 처리 방법 |
|--------|----------|
| CF 양방향 생성 무한 루프 | `onFriendCreate`에서 역방향 이미 존재 시 스킵 |
| 동시 친구 요청 (A→B, B→A) | 두 요청 모두 수락 가능, 결과적으로 친구 관계 1개 |
| 마이그레이션 중 새 팔로우 | Phase 1에서 `follow.ts` 병행 → 새 팔로우도 마이그레이션 대상 |
| RTDB 동기화 실패 | CF 재시도 (Firebase 기본 재시도) + RTDB는 보조 데이터이므로 치명적이지 않음 |
| 오프라인 앱에서 친구 추가 | 옵션 A: Firestore 오프라인 캐시 지원 / 옵션 B: callable은 온라인 필수 |
