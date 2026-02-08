import type {
  Activity,
  ActivitySummary,
  Segment,
  SegmentEffort,
  GroupRide,
  GroupRideParticipant,
  Comment,
  Kudos,
} from "@shared/types";

// ── Riders ──────────────────────────────────────────────────────────

export interface DemoRider {
  id: string;
  nickname: string;
  profileImage: string | null;
  bio: string;
  location: string;
  followers: number;
  following: number;
}

export const riders: DemoRider[] = [
  {
    id: "rider_1",
    nickname: "김민수",
    profileImage: null,
    bio: "서울 힐클라이머 | 주말 라이더",
    location: "서울 강남",
    followers: 128,
    following: 85,
  },
  {
    id: "rider_2",
    nickname: "이지원",
    profileImage: null,
    bio: "매일 출퇴근 자전거 | 로드바이크",
    location: "서울 마포",
    followers: 256,
    following: 142,
  },
  {
    id: "rider_3",
    nickname: "박서연",
    profileImage: null,
    bio: "클라이밍 좋아하는 여성 라이더",
    location: "경기 분당",
    followers: 89,
    following: 67,
  },
  {
    id: "rider_4",
    nickname: "최준혁",
    profileImage: null,
    bio: "파워미터 덕후 | Zwift 겸업",
    location: "서울 송파",
    followers: 342,
    following: 198,
  },
  {
    id: "rider_5",
    nickname: "정하늘",
    profileImage: null,
    bio: "그란폰도 완주 목표",
    location: "경기 일산",
    followers: 64,
    following: 45,
  },
];

export const riderMap = Object.fromEntries(riders.map((r) => [r.id, r]));

// ── Helper ──────────────────────────────────────────────────────────

function ts(daysAgo: number, hour: number = 7, minute: number = 0): number {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function makeSummary(overrides: Partial<ActivitySummary>): ActivitySummary {
  return {
    distance: 30000,
    ridingTimeMillis: 3600000,
    averageSpeed: 25.0,
    maxSpeed: 45.0,
    averageCadence: 85,
    maxCadence: 110,
    averageHeartRate: 145,
    maxHeartRate: 175,
    averagePower: 180,
    maxPower: 450,
    normalizedPower: 195,
    elevationGain: 350,
    calories: 680,
    relativeEffort: 85,
    ...overrides,
  };
}

// ── Activities (15) ─────────────────────────────────────────────────

export const activities: Activity[] = [
  {
    id: "act_01",
    userId: "rider_1",
    nickname: "김민수",
    profileImage: null,
    type: "ride",
    createdAt: ts(0, 10),
    startTime: ts(0, 7),
    endTime: ts(0, 10),
    summary: makeSummary({
      distance: 62400,
      ridingTimeMillis: 7920000,
      averageSpeed: 28.4,
      maxSpeed: 52.3,
      averageHeartRate: 152,
      maxHeartRate: 182,
      averagePower: 210,
      maxPower: 580,
      normalizedPower: 225,
      elevationGain: 780,
      calories: 1340,
    }),
    thumbnailTrack: "",
    groupId: null,
    groupRideId: null,
    photoCount: 3,
    kudosCount: 12,
    commentCount: 4,
    segmentEffortCount: 3,
    description: "남산 + 북악 모닝 라이딩",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_02",
    userId: "rider_2",
    nickname: "이지원",
    profileImage: null,
    type: "ride",
    createdAt: ts(0, 9),
    startTime: ts(0, 6, 30),
    endTime: ts(0, 8, 30),
    summary: makeSummary({
      distance: 45200,
      ridingTimeMillis: 5400000,
      averageSpeed: 30.1,
      maxSpeed: 48.5,
      averageHeartRate: 148,
      maxHeartRate: 178,
      averagePower: 195,
      maxPower: 520,
      normalizedPower: 210,
      elevationGain: 320,
      calories: 980,
    }),
    thumbnailTrack: "",
    groupId: null,
    groupRideId: null,
    photoCount: 1,
    kudosCount: 8,
    commentCount: 2,
    segmentEffortCount: 2,
    description: "한강 출근길 라이딩",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_03",
    userId: "rider_3",
    nickname: "박서연",
    profileImage: null,
    type: "ride",
    createdAt: ts(1, 17),
    startTime: ts(1, 14),
    endTime: ts(1, 17),
    summary: makeSummary({
      distance: 38500,
      ridingTimeMillis: 6300000,
      averageSpeed: 22.0,
      maxSpeed: 42.1,
      averageHeartRate: 158,
      maxHeartRate: 188,
      averagePower: 165,
      maxPower: 420,
      normalizedPower: 180,
      elevationGain: 920,
      calories: 850,
    }),
    thumbnailTrack: "",
    groupId: null,
    groupRideId: null,
    photoCount: 5,
    kudosCount: 15,
    commentCount: 6,
    segmentEffortCount: 4,
    description: "북한산 둘레길 힐클라임",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_04",
    userId: "rider_4",
    nickname: "최준혁",
    profileImage: null,
    type: "ride",
    createdAt: ts(1, 12),
    startTime: ts(1, 8),
    endTime: ts(1, 12),
    summary: makeSummary({
      distance: 95300,
      ridingTimeMillis: 12600000,
      averageSpeed: 27.2,
      maxSpeed: 55.0,
      averageHeartRate: 142,
      maxHeartRate: 172,
      averagePower: 230,
      maxPower: 650,
      normalizedPower: 248,
      elevationGain: 1250,
      calories: 2100,
    }),
    thumbnailTrack: "",
    groupId: null,
    groupRideId: null,
    photoCount: 8,
    kudosCount: 24,
    commentCount: 8,
    segmentEffortCount: 5,
    description: "팔당댐 → 양수리 센추리 라이딩",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_05",
    userId: "rider_5",
    nickname: "정하늘",
    profileImage: null,
    type: "ride",
    createdAt: ts(2, 11),
    startTime: ts(2, 8),
    endTime: ts(2, 11),
    summary: makeSummary({
      distance: 52100,
      ridingTimeMillis: 7200000,
      averageSpeed: 26.1,
      maxSpeed: 46.8,
      averageHeartRate: 138,
      maxHeartRate: 168,
      averagePower: 175,
      maxPower: 480,
      normalizedPower: 190,
      elevationGain: 580,
      calories: 1180,
    }),
    thumbnailTrack: "",
    groupId: null,
    groupRideId: null,
    photoCount: 2,
    kudosCount: 6,
    commentCount: 1,
    segmentEffortCount: 2,
    description: "일산 → 파주 왕복",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_06",
    userId: "rider_1",
    nickname: "김민수",
    profileImage: null,
    type: "ride",
    createdAt: ts(3, 9),
    startTime: ts(3, 6),
    endTime: ts(3, 9),
    summary: makeSummary({
      distance: 72500,
      ridingTimeMillis: 9000000,
      averageSpeed: 29.0,
      maxSpeed: 53.2,
      averageHeartRate: 155,
      maxHeartRate: 185,
      averagePower: 220,
      maxPower: 600,
      normalizedPower: 238,
      elevationGain: 650,
      calories: 1560,
    }),
    thumbnailTrack: "",
    groupId: "group_1",
    groupRideId: "gr_01",
    photoCount: 4,
    kudosCount: 18,
    commentCount: 5,
    segmentEffortCount: 3,
    description: "팀 라이딩 - 한강 → 팔당",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_07",
    userId: "rider_2",
    nickname: "이지원",
    profileImage: null,
    type: "ride",
    createdAt: ts(3, 9),
    startTime: ts(3, 6),
    endTime: ts(3, 9),
    summary: makeSummary({
      distance: 71800,
      ridingTimeMillis: 8700000,
      averageSpeed: 29.7,
      maxSpeed: 51.8,
      averageHeartRate: 150,
      maxHeartRate: 180,
      averagePower: 200,
      maxPower: 540,
      normalizedPower: 218,
      elevationGain: 640,
      calories: 1480,
    }),
    thumbnailTrack: "",
    groupId: "group_1",
    groupRideId: "gr_01",
    photoCount: 2,
    kudosCount: 14,
    commentCount: 3,
    segmentEffortCount: 3,
    description: "팀 라이딩 - 한강 → 팔당",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_08",
    userId: "rider_4",
    nickname: "최준혁",
    profileImage: null,
    type: "ride",
    createdAt: ts(3, 9),
    startTime: ts(3, 6),
    endTime: ts(3, 8, 45),
    summary: makeSummary({
      distance: 72200,
      ridingTimeMillis: 8400000,
      averageSpeed: 30.9,
      maxSpeed: 55.5,
      averageHeartRate: 148,
      maxHeartRate: 176,
      averagePower: 240,
      maxPower: 680,
      normalizedPower: 258,
      elevationGain: 660,
      calories: 1520,
    }),
    thumbnailTrack: "",
    groupId: "group_1",
    groupRideId: "gr_01",
    photoCount: 1,
    kudosCount: 20,
    commentCount: 4,
    segmentEffortCount: 3,
    description: "팀 라이딩 - 한강 → 팔당",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_09",
    userId: "rider_3",
    nickname: "박서연",
    profileImage: null,
    type: "ride",
    createdAt: ts(4, 18),
    startTime: ts(4, 15),
    endTime: ts(4, 18),
    summary: makeSummary({
      distance: 28900,
      ridingTimeMillis: 4500000,
      averageSpeed: 23.1,
      maxSpeed: 38.5,
      averageHeartRate: 162,
      maxHeartRate: 190,
      averagePower: 155,
      maxPower: 380,
      normalizedPower: 170,
      elevationGain: 720,
      calories: 680,
    }),
    thumbnailTrack: "",
    groupId: null,
    groupRideId: null,
    photoCount: 6,
    kudosCount: 11,
    commentCount: 3,
    segmentEffortCount: 2,
    description: "남산 반복 힐클라임 x3",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_10",
    userId: "rider_1",
    nickname: "김민수",
    profileImage: null,
    type: "ride",
    createdAt: ts(5, 8),
    startTime: ts(5, 6),
    endTime: ts(5, 8),
    summary: makeSummary({
      distance: 35600,
      ridingTimeMillis: 4800000,
      averageSpeed: 26.7,
      maxSpeed: 44.2,
      averageHeartRate: 140,
      maxHeartRate: 170,
      averagePower: 185,
      maxPower: 450,
      normalizedPower: 198,
      elevationGain: 280,
      calories: 720,
    }),
    thumbnailTrack: "",
    groupId: null,
    groupRideId: null,
    photoCount: 0,
    kudosCount: 5,
    commentCount: 1,
    segmentEffortCount: 1,
    description: "한강 리커버리 라이딩",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_11",
    userId: "rider_5",
    nickname: "정하늘",
    profileImage: null,
    type: "ride",
    createdAt: ts(5, 14),
    startTime: ts(5, 10),
    endTime: ts(5, 14),
    summary: makeSummary({
      distance: 85200,
      ridingTimeMillis: 11400000,
      averageSpeed: 26.9,
      maxSpeed: 50.2,
      averageHeartRate: 145,
      maxHeartRate: 178,
      averagePower: 185,
      maxPower: 520,
      normalizedPower: 200,
      elevationGain: 980,
      calories: 1850,
    }),
    thumbnailTrack: "",
    groupId: null,
    groupRideId: null,
    photoCount: 4,
    kudosCount: 10,
    commentCount: 2,
    segmentEffortCount: 3,
    description: "북한산 → 의정부 → 일산 루프",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_12",
    userId: "rider_2",
    nickname: "이지원",
    profileImage: null,
    type: "ride",
    createdAt: ts(6, 9),
    startTime: ts(6, 6, 30),
    endTime: ts(6, 8, 30),
    summary: makeSummary({
      distance: 44800,
      ridingTimeMillis: 5200000,
      averageSpeed: 31.0,
      maxSpeed: 49.5,
      averageHeartRate: 146,
      maxHeartRate: 176,
      averagePower: 198,
      maxPower: 530,
      normalizedPower: 215,
      elevationGain: 310,
      calories: 960,
    }),
    thumbnailTrack: "",
    groupId: null,
    groupRideId: null,
    photoCount: 0,
    kudosCount: 7,
    commentCount: 1,
    segmentEffortCount: 2,
    description: "출퇴근 라이딩 (마포 → 강남)",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_13",
    userId: "rider_4",
    nickname: "최준혁",
    profileImage: null,
    type: "ride",
    createdAt: ts(7, 11),
    startTime: ts(7, 7),
    endTime: ts(7, 11),
    summary: makeSummary({
      distance: 110500,
      ridingTimeMillis: 14400000,
      averageSpeed: 27.6,
      maxSpeed: 58.2,
      averageHeartRate: 140,
      maxHeartRate: 175,
      averagePower: 235,
      maxPower: 700,
      normalizedPower: 252,
      elevationGain: 1580,
      calories: 2450,
    }),
    thumbnailTrack: "",
    groupId: null,
    groupRideId: null,
    photoCount: 10,
    kudosCount: 32,
    commentCount: 10,
    segmentEffortCount: 6,
    description: "팔당 → 양평 → 지평 그란폰도",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_14",
    userId: "rider_3",
    nickname: "박서연",
    profileImage: null,
    type: "ride",
    createdAt: ts(7, 17),
    startTime: ts(7, 14),
    endTime: ts(7, 17),
    summary: makeSummary({
      distance: 42300,
      ridingTimeMillis: 6600000,
      averageSpeed: 23.1,
      maxSpeed: 41.5,
      averageHeartRate: 155,
      maxHeartRate: 185,
      averagePower: 160,
      maxPower: 400,
      normalizedPower: 175,
      elevationGain: 850,
      calories: 920,
    }),
    thumbnailTrack: "",
    groupId: null,
    groupRideId: null,
    photoCount: 3,
    kudosCount: 9,
    commentCount: 2,
    segmentEffortCount: 3,
    description: "불광동 → 북악 → 남산 힐클라임",
    visibility: "everyone",
    gpxPath: null,
  },
  {
    id: "act_15",
    userId: "rider_1",
    nickname: "김민수",
    profileImage: null,
    type: "ride",
    createdAt: ts(8, 12),
    startTime: ts(8, 7),
    endTime: ts(8, 12),
    summary: makeSummary({
      distance: 102000,
      ridingTimeMillis: 13200000,
      averageSpeed: 27.8,
      maxSpeed: 56.5,
      averageHeartRate: 148,
      maxHeartRate: 180,
      averagePower: 215,
      maxPower: 620,
      normalizedPower: 232,
      elevationGain: 1120,
      calories: 2200,
    }),
    thumbnailTrack: "",
    groupId: "group_1",
    groupRideId: "gr_02",
    photoCount: 6,
    kudosCount: 22,
    commentCount: 7,
    segmentEffortCount: 4,
    description: "주말 팀 라이딩 - 양수리 코스",
    visibility: "everyone",
    gpxPath: null,
  },
];

// ── Segments (5) ────────────────────────────────────────────────────

export const segments: Segment[] = [
  {
    id: "seg_namsan",
    name: "남산 힐클라임",
    description: "남산 도서관 → 남산타워 정상",
    creatorId: "rider_1",
    source: "official",
    status: "active",
    startLat: 37.5512,
    startLon: 126.9882,
    endLat: 37.5509,
    endLon: 126.9882,
    polyline: "",
    distance: 2800,
    elevationGain: 210,
    averageGrade: 7.5,
    geoHash: "wydm9",
    category: "climb",
    climbCategory: "4",
    totalEfforts: 1842,
    starCount: 256,
    kom: { time: 378000, userId: "rider_4", nickname: "최준혁", recordedAt: ts(14) },
    qom: { time: 456000, userId: "rider_3", nickname: "박서연", recordedAt: ts(21) },
  },
  {
    id: "seg_bukak",
    name: "북악 스카이웨이",
    description: "성북동 → 북악스카이웨이 정상",
    creatorId: "rider_3",
    source: "official",
    status: "active",
    startLat: 37.5929,
    startLon: 126.9864,
    endLat: 37.6012,
    endLon: 126.9651,
    polyline: "",
    distance: 4500,
    elevationGain: 340,
    averageGrade: 7.6,
    geoHash: "wydm9",
    category: "climb",
    climbCategory: "3",
    totalEfforts: 2156,
    starCount: 384,
    kom: { time: 582000, userId: "rider_1", nickname: "김민수", recordedAt: ts(5) },
    qom: { time: 714000, userId: "rider_3", nickname: "박서연", recordedAt: ts(7) },
  },
  {
    id: "seg_hangang",
    name: "한강 잠실대교 → 광나루",
    description: "잠실대교 남단 → 광나루 자전거공원",
    creatorId: "rider_2",
    source: "official",
    status: "active",
    startLat: 37.5175,
    startLon: 127.0854,
    endLat: 37.5448,
    endLon: 127.1215,
    polyline: "",
    distance: 8200,
    elevationGain: 15,
    averageGrade: 0.2,
    geoHash: "wydm6",
    category: "flat",
    climbCategory: null,
    totalEfforts: 5230,
    starCount: 512,
    kom: { time: 624000, userId: "rider_4", nickname: "최준혁", recordedAt: ts(3) },
    qom: { time: 738000, userId: "rider_2", nickname: "이지원", recordedAt: ts(6) },
  },
  {
    id: "seg_paldang",
    name: "팔당댐 스프린트",
    description: "팔당대교 → 팔당댐 입구",
    creatorId: "rider_4",
    source: "user",
    status: "active",
    startLat: 37.5218,
    startLon: 127.2815,
    endLat: 37.5185,
    endLon: 127.3012,
    polyline: "",
    distance: 3200,
    elevationGain: 25,
    averageGrade: 0.8,
    geoHash: "wydjz",
    category: "sprint",
    climbCategory: null,
    totalEfforts: 3120,
    starCount: 198,
    kom: { time: 258000, userId: "rider_4", nickname: "최준혁", recordedAt: ts(1) },
    qom: { time: 312000, userId: "rider_2", nickname: "이지원", recordedAt: ts(8) },
  },
  {
    id: "seg_bukansan",
    name: "북한산 우이령길",
    description: "우이동 → 우이령 고개",
    creatorId: "rider_3",
    source: "official",
    status: "active",
    startLat: 37.6572,
    startLon: 127.0125,
    endLat: 37.6685,
    endLon: 126.9882,
    polyline: "",
    distance: 5800,
    elevationGain: 480,
    averageGrade: 8.3,
    geoHash: "wydmc",
    category: "climb",
    climbCategory: "2",
    totalEfforts: 890,
    starCount: 142,
    kom: { time: 852000, userId: "rider_1", nickname: "김민수", recordedAt: ts(10) },
    qom: { time: 1020000, userId: "rider_3", nickname: "박서연", recordedAt: ts(12) },
  },
];

export const segmentMap = Object.fromEntries(segments.map((s) => [s.id, s]));

// ── Segment Efforts (20) ────────────────────────────────────────────

export const segmentEfforts: SegmentEffort[] = [
  // 남산 (seg_namsan)
  { id: "eff_01", userId: "rider_4", nickname: "최준혁", activityId: "act_04", elapsedTime: 378000, averageSpeed: 26.7, averageHeartRate: 175, averagePower: 310, averageCadence: 78, recordedAt: ts(14), rank: 1 },
  { id: "eff_02", userId: "rider_1", nickname: "김민수", activityId: "act_01", elapsedTime: 402000, averageSpeed: 25.1, averageHeartRate: 172, averagePower: 285, averageCadence: 82, recordedAt: ts(0), rank: 2 },
  { id: "eff_03", userId: "rider_2", nickname: "이지원", activityId: "act_02", elapsedTime: 420000, averageSpeed: 24.0, averageHeartRate: 168, averagePower: 260, averageCadence: 80, recordedAt: ts(2), rank: 3 },
  { id: "eff_04", userId: "rider_3", nickname: "박서연", activityId: "act_09", elapsedTime: 456000, averageSpeed: 22.1, averageHeartRate: 178, averagePower: 225, averageCadence: 75, recordedAt: ts(4), rank: 4 },

  // 북악 (seg_bukak)
  { id: "eff_05", userId: "rider_1", nickname: "김민수", activityId: "act_01", elapsedTime: 582000, averageSpeed: 27.8, averageHeartRate: 170, averagePower: 295, averageCadence: 80, recordedAt: ts(5), rank: 1 },
  { id: "eff_06", userId: "rider_4", nickname: "최준혁", activityId: "act_04", elapsedTime: 594000, averageSpeed: 27.3, averageHeartRate: 165, averagePower: 305, averageCadence: 82, recordedAt: ts(1), rank: 2 },
  { id: "eff_07", userId: "rider_3", nickname: "박서연", activityId: "act_03", elapsedTime: 714000, averageSpeed: 22.7, averageHeartRate: 180, averagePower: 230, averageCadence: 72, recordedAt: ts(7), rank: 3 },
  { id: "eff_08", userId: "rider_5", nickname: "정하늘", activityId: "act_05", elapsedTime: 750000, averageSpeed: 21.6, averageHeartRate: 160, averagePower: 210, averageCadence: 76, recordedAt: ts(8), rank: 4 },

  // 한강 (seg_hangang)
  { id: "eff_09", userId: "rider_4", nickname: "최준혁", activityId: "act_04", elapsedTime: 624000, averageSpeed: 47.3, averageHeartRate: 158, averagePower: 280, averageCadence: 95, recordedAt: ts(3), rank: 1 },
  { id: "eff_10", userId: "rider_2", nickname: "이지원", activityId: "act_02", elapsedTime: 648000, averageSpeed: 45.6, averageHeartRate: 155, averagePower: 255, averageCadence: 92, recordedAt: ts(0), rank: 2 },
  { id: "eff_11", userId: "rider_1", nickname: "김민수", activityId: "act_06", elapsedTime: 660000, averageSpeed: 44.7, averageHeartRate: 160, averagePower: 270, averageCadence: 90, recordedAt: ts(3), rank: 3 },
  { id: "eff_12", userId: "rider_5", nickname: "정하늘", activityId: "act_05", elapsedTime: 702000, averageSpeed: 42.1, averageHeartRate: 148, averagePower: 235, averageCadence: 88, recordedAt: ts(5), rank: 4 },

  // 팔당댐 스프린트 (seg_paldang)
  { id: "eff_13", userId: "rider_4", nickname: "최준혁", activityId: "act_08", elapsedTime: 258000, averageSpeed: 44.7, averageHeartRate: 170, averagePower: 350, averageCadence: 100, recordedAt: ts(1), rank: 1 },
  { id: "eff_14", userId: "rider_2", nickname: "이지원", activityId: "act_07", elapsedTime: 276000, averageSpeed: 41.7, averageHeartRate: 165, averagePower: 300, averageCadence: 98, recordedAt: ts(3), rank: 2 },
  { id: "eff_15", userId: "rider_1", nickname: "김민수", activityId: "act_06", elapsedTime: 282000, averageSpeed: 40.9, averageHeartRate: 168, averagePower: 310, averageCadence: 96, recordedAt: ts(3), rank: 3 },
  { id: "eff_16", userId: "rider_5", nickname: "정하늘", activityId: "act_11", elapsedTime: 318000, averageSpeed: 36.2, averageHeartRate: 155, averagePower: 260, averageCadence: 92, recordedAt: ts(5), rank: 4 },

  // 북한산 (seg_bukansan)
  { id: "eff_17", userId: "rider_1", nickname: "김민수", activityId: "act_15", elapsedTime: 852000, averageSpeed: 24.5, averageHeartRate: 172, averagePower: 280, averageCadence: 76, recordedAt: ts(10), rank: 1 },
  { id: "eff_18", userId: "rider_4", nickname: "최준혁", activityId: "act_13", elapsedTime: 870000, averageSpeed: 24.0, averageHeartRate: 168, averagePower: 295, averageCadence: 78, recordedAt: ts(7), rank: 2 },
  { id: "eff_19", userId: "rider_3", nickname: "박서연", activityId: "act_14", elapsedTime: 1020000, averageSpeed: 20.5, averageHeartRate: 182, averagePower: 220, averageCadence: 70, recordedAt: ts(12), rank: 3 },
  { id: "eff_20", userId: "rider_5", nickname: "정하늘", activityId: "act_11", elapsedTime: 1080000, averageSpeed: 19.3, averageHeartRate: 158, averagePower: 200, averageCadence: 72, recordedAt: ts(8), rank: 4 },
];

// ── Group Rides (3) ─────────────────────────────────────────────────

function makeParticipant(
  riderId: string,
  activityId: string,
  overrides: Partial<GroupRideParticipant>,
): GroupRideParticipant {
  const rider = riderMap[riderId]!;
  return {
    activityId,
    nickname: rider.nickname,
    profileImage: null,
    distance: 72000,
    ridingTimeMillis: 9000000,
    averageSpeed: 28.8,
    averageHeartRate: 150,
    averagePower: 220,
    averageCadence: 85,
    ...overrides,
  };
}

export const groupRides: GroupRide[] = [
  {
    id: "gr_01",
    groupId: "group_1",
    startTime: ts(3, 6),
    endTime: ts(3, 9),
    participantCount: 3,
    totalDistance: 216500,
    participants: {
      rider_1: makeParticipant("rider_1", "act_06", { distance: 72500, ridingTimeMillis: 9000000, averageSpeed: 29.0, averageHeartRate: 155, averagePower: 220 }),
      rider_2: makeParticipant("rider_2", "act_07", { distance: 71800, ridingTimeMillis: 8700000, averageSpeed: 29.7, averageHeartRate: 150, averagePower: 200 }),
      rider_4: makeParticipant("rider_4", "act_08", { distance: 72200, ridingTimeMillis: 8400000, averageSpeed: 30.9, averageHeartRate: 148, averagePower: 240 }),
    },
    createdAt: ts(3, 9),
  },
  {
    id: "gr_02",
    groupId: "group_1",
    startTime: ts(8, 7),
    endTime: ts(8, 12),
    participantCount: 4,
    totalDistance: 398200,
    participants: {
      rider_1: makeParticipant("rider_1", "act_15", { distance: 102000, ridingTimeMillis: 13200000, averageSpeed: 27.8, averageHeartRate: 148, averagePower: 215 }),
      rider_2: makeParticipant("rider_2", "act_12", { distance: 98500, ridingTimeMillis: 12800000, averageSpeed: 27.7, averageHeartRate: 146, averagePower: 198 }),
      rider_4: makeParticipant("rider_4", "act_13", { distance: 105200, ridingTimeMillis: 13000000, averageSpeed: 29.1, averageHeartRate: 142, averagePower: 238 }),
      rider_5: makeParticipant("rider_5", "act_11", { distance: 92500, ridingTimeMillis: 13400000, averageSpeed: 24.9, averageHeartRate: 145, averagePower: 180 }),
    },
    createdAt: ts(8, 12),
  },
  {
    id: "gr_03",
    groupId: "group_1",
    startTime: ts(14, 6),
    endTime: ts(14, 10),
    participantCount: 5,
    totalDistance: 325000,
    participants: {
      rider_1: makeParticipant("rider_1", "act_01", { distance: 68000, ridingTimeMillis: 8400000, averageSpeed: 29.1, averageHeartRate: 152, averagePower: 210 }),
      rider_2: makeParticipant("rider_2", "act_02", { distance: 67500, ridingTimeMillis: 8200000, averageSpeed: 29.6, averageHeartRate: 148, averagePower: 195 }),
      rider_3: makeParticipant("rider_3", "act_03", { distance: 62000, ridingTimeMillis: 9000000, averageSpeed: 24.8, averageHeartRate: 158, averagePower: 165 }),
      rider_4: makeParticipant("rider_4", "act_04", { distance: 68500, ridingTimeMillis: 8100000, averageSpeed: 30.4, averageHeartRate: 145, averagePower: 235 }),
      rider_5: makeParticipant("rider_5", "act_05", { distance: 59000, ridingTimeMillis: 9200000, averageSpeed: 23.1, averageHeartRate: 140, averagePower: 175 }),
    },
    createdAt: ts(14, 10),
  },
];

// ── Group Info ───────────────────────────────────────────────────────

export interface DemoGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  totalDistance: number;
  totalRides: number;
  members: string[];
}

export const groups: DemoGroup[] = [
  {
    id: "group_1",
    name: "서울 로드바이크 클럽",
    description: "매주 토요일 아침 한강 출발! 초보부터 고수까지 환영합니다.",
    memberCount: 5,
    totalDistance: 939700,
    totalRides: 3,
    members: ["rider_1", "rider_2", "rider_3", "rider_4", "rider_5"],
  },
];

// ── Comments ────────────────────────────────────────────────────────

export const comments: Record<string, Comment[]> = {
  act_01: [
    { id: "c1", userId: "rider_2", nickname: "이지원", profileImage: null, text: "남산 + 북악 조합 멋지네요! 다음에 같이 가요 💪", createdAt: ts(0, 11) },
    { id: "c2", userId: "rider_4", nickname: "최준혁", profileImage: null, text: "파워 데이터 좋은데요? 훈련 효과 최고!", createdAt: ts(0, 12) },
    { id: "c3", userId: "rider_3", nickname: "박서연", profileImage: null, text: "고도 780m 대단해요!", createdAt: ts(0, 13) },
    { id: "c4", userId: "rider_5", nickname: "정하늘", profileImage: null, text: "저도 다음 주에 도전해볼게요", createdAt: ts(0, 14) },
  ],
  act_04: [
    { id: "c5", userId: "rider_1", nickname: "김민수", profileImage: null, text: "센추리 라이딩 완주 축하! 🎉", createdAt: ts(1, 13) },
    { id: "c6", userId: "rider_2", nickname: "이지원", profileImage: null, text: "평속 27km 넘기다니 대단합니다", createdAt: ts(1, 14) },
    { id: "c7", userId: "rider_3", nickname: "박서연", profileImage: null, text: "양수리 경치 좋았겠네요!", createdAt: ts(1, 15) },
  ],
  act_13: [
    { id: "c8", userId: "rider_1", nickname: "김민수", profileImage: null, text: "110km 그란폰도 ㄷㄷ 존경합니다", createdAt: ts(7, 12) },
    { id: "c9", userId: "rider_5", nickname: "정하늘", profileImage: null, text: "저도 이 코스 목표로 훈련 중이에요!", createdAt: ts(7, 13) },
  ],
};

// ── Kudos ────────────────────────────────────────────────────────────

export const kudos: Record<string, Kudos[]> = {
  act_01: [
    { userId: "rider_2", nickname: "이지원", profileImage: null, createdAt: ts(0, 10, 30) },
    { userId: "rider_3", nickname: "박서연", profileImage: null, createdAt: ts(0, 11) },
    { userId: "rider_4", nickname: "최준혁", profileImage: null, createdAt: ts(0, 11, 30) },
    { userId: "rider_5", nickname: "정하늘", profileImage: null, createdAt: ts(0, 12) },
  ],
  act_04: [
    { userId: "rider_1", nickname: "김민수", profileImage: null, createdAt: ts(1, 13) },
    { userId: "rider_2", nickname: "이지원", profileImage: null, createdAt: ts(1, 13, 30) },
    { userId: "rider_3", nickname: "박서연", profileImage: null, createdAt: ts(1, 14) },
  ],
};

// ── Weekly stats (for charts) ───────────────────────────────────────

export interface WeeklyStat {
  week: string; // "2/3", "1/27", etc.
  distance: number; // km
  time: number; // hours
  elevation: number; // meters
  rides: number;
}

export function getWeeklyStats(userId: string): WeeklyStat[] {
  const weeks: WeeklyStat[] = [];
  const now = new Date();
  for (let w = 11; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - w * 7 - weekStart.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekActivities = activities.filter(
      (a) =>
        a.userId === userId &&
        a.startTime >= weekStart.getTime() &&
        a.startTime < weekEnd.getTime(),
    );

    weeks.push({
      week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      distance: Math.round(
        weekActivities.reduce((s, a) => s + a.summary.distance, 0) / 1000,
      ),
      time: Math.round(
        weekActivities.reduce((s, a) => s + a.summary.ridingTimeMillis, 0) / 3600000 * 10,
      ) / 10,
      elevation: Math.round(
        weekActivities.reduce((s, a) => s + a.summary.elevationGain, 0),
      ),
      rides: weekActivities.length,
    });
  }
  return weeks;
}

// ── This week summary ───────────────────────────────────────────────

export function getThisWeekSummary(userId: string) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(monday.getDate() - monday.getDay() + 1);
  monday.setHours(0, 0, 0, 0);

  const weekActivities = activities.filter(
    (a) => a.userId === userId && a.startTime >= monday.getTime(),
  );

  return {
    rides: weekActivities.length,
    distance: weekActivities.reduce((s, a) => s + a.summary.distance, 0),
    time: weekActivities.reduce((s, a) => s + a.summary.ridingTimeMillis, 0),
    elevation: weekActivities.reduce((s, a) => s + a.summary.elevationGain, 0),
  };
}

// ── Elevation profile (simulated) ───────────────────────────────────

export function generateElevationProfile(
  totalDistance: number,
  elevationGain: number,
  points: number = 50,
): { distance: number; elevation: number }[] {
  const result: { distance: number; elevation: number }[] = [];
  let elev = 50; // start elevation
  const step = totalDistance / points;

  for (let i = 0; i <= points; i++) {
    const progress = i / points;
    // Simulate rolling terrain with peaks
    const base = Math.sin(progress * Math.PI * 2) * (elevationGain * 0.3);
    const climb = Math.sin(progress * Math.PI) * (elevationGain * 0.7);
    const noise = Math.sin(progress * 17) * 15;
    elev = 50 + base + climb + noise;
    result.push({
      distance: Math.round(step * i),
      elevation: Math.round(Math.max(0, elev)),
    });
  }
  return result;
}

// ── Speed/HR/Power profiles (simulated) ─────────────────────────────

export function generatePerformanceProfile(
  summary: ActivitySummary,
  points: number = 50,
): { distance: number; speed: number; heartRate: number; power: number }[] {
  const result: { distance: number; speed: number; heartRate: number; power: number }[] = [];
  const step = summary.distance / points;

  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const noise1 = Math.sin(t * 23) * 0.15 + Math.sin(t * 7) * 0.1;
    const noise2 = Math.sin(t * 19) * 0.12 + Math.sin(t * 11) * 0.08;
    const noise3 = Math.sin(t * 29) * 0.2 + Math.sin(t * 13) * 0.1;

    result.push({
      distance: Math.round(step * i),
      speed: Math.max(5, summary.averageSpeed * (1 + noise1)),
      heartRate: Math.max(80, (summary.averageHeartRate ?? 140) * (1 + noise2)),
      power: Math.max(50, (summary.averagePower ?? 180) * (1 + noise3)),
    });
  }
  return result;
}

// ── Helpers ─────────────────────────────────────────────────────────

export function getActivitiesForUser(userId: string): Activity[] {
  return activities.filter((a) => a.userId === userId);
}

export function getEffortsForSegment(segmentId: string): SegmentEffort[] {
  const segmentEffortMap: Record<string, string[]> = {
    seg_namsan: ["eff_01", "eff_02", "eff_03", "eff_04"],
    seg_bukak: ["eff_05", "eff_06", "eff_07", "eff_08"],
    seg_hangang: ["eff_09", "eff_10", "eff_11", "eff_12"],
    seg_paldang: ["eff_13", "eff_14", "eff_15", "eff_16"],
    seg_bukansan: ["eff_17", "eff_18", "eff_19", "eff_20"],
  };
  const ids = segmentEffortMap[segmentId] ?? [];
  return segmentEfforts.filter((e) => ids.includes(e.id));
}

export function getGroupRidesForGroup(groupId: string): GroupRide[] {
  return groupRides.filter((r) => r.groupId === groupId);
}
