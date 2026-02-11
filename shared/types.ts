// Activity
export interface Activity {
  id: string;
  userId: string;
  nickname: string;
  profileImage: string | null;
  type: 'ride';
  createdAt: number;
  startTime: number;
  endTime: number;
  summary: ActivitySummary;
  thumbnailTrack: string; // encoded polyline
  groupId: string | null;
  groupRideId: string | null;
  photoCount: number;
  kudosCount: number;
  commentCount: number;
  segmentEffortCount: number;
  description: string;
  visibility: 'everyone' | 'friends' | 'private';
  gpxPath: string | null;
}

export interface ActivitySummary {
  distance: number; // meters
  ridingTimeMillis: number;
  averageSpeed: number; // km/h
  maxSpeed: number;
  averageCadence: number | null;
  maxCadence: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  averagePower: number | null;
  maxPower: number | null;
  normalizedPower: number | null;
  elevationGain: number; // meters
  calories: number | null;
  relativeEffort: number | null; // TRIMP
}

// Photo
export interface ActivityPhoto {
  id: string;
  storagePath: string;
  thumbnailPath: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  caption: string | null;
}

// Social
export interface Kudos {
  userId: string;
  nickname: string;
  profileImage: string | null;
  createdAt: number;
}

export interface Comment {
  id: string;
  userId: string;
  nickname: string;
  profileImage: string | null;
  text: string;
  createdAt: number;
}

export interface Notification {
  id: string;
  type: 'kudos' | 'comment' | 'follow' | 'group_invite' | 'kom';
  fromUserId: string;
  fromNickname: string;
  fromProfileImage: string | null;
  activityId: string | null;
  segmentId: string | null;
  message: string;
  read: boolean;
  createdAt: number;
}

// Segment
export interface Segment {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  source: 'official' | 'user' | 'auto';
  status: 'active' | 'pending' | 'hidden';
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  polyline: string; // encoded polyline
  distance: number; // meters
  elevationGain: number;
  averageGrade: number; // percent
  geoHash: string;
  category: 'climb' | 'sprint' | 'flat';
  climbCategory: null | '4' | '3' | '2' | '1' | 'HC';
  totalEfforts: number;
  starCount: number;
  kom: SegmentRecord | null;
  qom: SegmentRecord | null;
}

export interface SegmentRecord {
  time: number; // ms
  userId: string;
  nickname: string;
  recordedAt: number;
}

export interface SegmentEffort {
  id: string;
  userId: string;
  nickname: string;
  activityId: string;
  elapsedTime: number; // ms
  averageSpeed: number;
  averageHeartRate: number | null;
  averagePower: number | null;
  averageCadence: number | null;
  recordedAt: number;
  rank: number | null;
}

export interface UserPR {
  bestTime: number;
  secondBest: number | null;
  thirdBest: number | null;
  bestEffortId: string;
  secondEffortId: string | null;
  thirdEffortId: string | null;
  totalEfforts: number;
  lastEffortAt: number;
}

// Group Ride
export interface GroupRide {
  id: string;
  groupId: string;
  startTime: number;
  endTime: number;
  participantCount: number;
  totalDistance: number;
  participants: Record<string, GroupRideParticipant>;
  createdAt: number;
}

export interface GroupRideParticipant {
  activityId: string;
  nickname: string;
  profileImage: string | null;
  distance: number;
  ridingTimeMillis: number;
  averageSpeed: number;
  averageHeartRate: number | null;
  averagePower: number | null;
  averageCadence: number | null;
}

// Follow
export interface FollowRelation {
  userId: string;
  nickname: string;
  profileImage: string | null;
  createdAt: number;
}

// Migration
export type MigrationStatus = "NOT_STARTED" | "RUNNING" | "PARTIAL_DONE" | "DONE" | "FAILED";
export type MigrationPeriod = "recent_90" | "recent_180" | "all";

export interface MigrationScope {
  period: MigrationPeriod;
  includePhotos: boolean;
  includeSegments: boolean;
}

export type MigrationPhase = "activities" | "streams" | "complete";

export interface MigrationProgress {
  totalActivities: number;
  importedActivities: number;
  skippedActivities: number;
  currentPage: number;
  totalPages: number;
  phase: MigrationPhase;
  totalStreams: number;
  fetchedStreams: number;
  failedStreams: number;
  startedAt: number;
  updatedAt: number;
}

export interface MigrationReport {
  totalActivities: number;
  totalDistance: number;
  totalTime: number;
  totalElevation: number;
  totalCalories: number;
  totalPhotos: number;
  totalSegmentEfforts: number;
  totalStreams: number;
  earliestActivity: number;
  latestActivity: number;
  topRoutes: { name: string; distance: number; count: number }[];
  // Legacy compat
  totalSegmentPRs?: number;
}

export interface MigrationState {
  status: MigrationStatus;
  scope: MigrationScope | null;
  progress: MigrationProgress | null;
  report: MigrationReport | null;
}

// User Profile
export type Visibility = 'everyone' | 'friends' | 'private';

export interface UserProfile {
  nickname: string;
  email: string | null;
  photoURL: string | null;
  stravaConnected: boolean;
  stravaAthleteId: number | null;
  stravaNickname: string | null;
  defaultVisibility?: Visibility;
  createdAt?: number;
  migration?: MigrationState;
}

// Activity Streams (Strava GPS data)
export interface ActivityStreams {
  userId: string;
  latlng?: [number, number][];
  altitude?: number[];
  heartrate?: number[];
  watts?: number[];
  cadence?: number[];
  velocity_smooth?: number[];
  time?: number[];
  distance?: number[];
}
