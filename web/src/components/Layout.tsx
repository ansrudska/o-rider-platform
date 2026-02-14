import { useState, useEffect } from "react";
import { Outlet, Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  collection, query, orderBy, limit, onSnapshot, writeBatch, doc, deleteDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firestore, functions } from "../services/firebase";
import Avatar from "./Avatar";
import { useAuth } from "../contexts/AuthContext";
import type { Notification } from "@shared/types";
import iconSvg from "../assets/icon.svg";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR");
}

const BASE_NAV_ITEMS = [
  { to: "/", label: "대시보드" },
  { to: "/explore", label: "리더보드" },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user, profile, loading, signInWithGoogle, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();



  const NAV_ITEMS = BASE_NAV_ITEMS;

  // Real-time notification subscription
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(firestore, "notifications", user.uid, "items"),
      orderBy("createdAt", "desc"),
      limit(20),
    );
    return onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification),
      );
    }, () => {});
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    const batch = writeBatch(firestore);
    notifications
      .filter((n) => !n.read)
      .forEach((n) => {
        batch.update(doc(firestore, "notifications", user.uid, "items", n.id), { read: true });
      });
    await batch.commit();
  };

  const handleNotifClick = (n: Notification) => {
    // Mark as read
    if (!n.read && user) {
      import("firebase/firestore").then(({ updateDoc }) => {
        updateDoc(doc(firestore, "notifications", user.uid, "items", n.id), { read: true });
      });
    }
    setNotifOpen(false);
    if (n.activityId) {
      navigate(`/activity/${n.activityId}`);
    } else if (n.type === "follow" || n.type === "friend_request" || n.type === "friend_accept") {
      navigate(`/athlete/${n.fromUserId}`);
    }
  };

  const notifIcon = (type: string) => {
    switch (type) {
      case "kudos": return "👍";
      case "comment": return "💬";
      case "follow": return "👤";
      case "friend_request": return "🤝";
      case "friend_accept": return "🤝";
      case "kom": return "👑";
      default: return "🔔";
    }
  };

  const handleAcceptFriend = async (n: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const accept = httpsCallable(functions, "acceptFriendRequest");
      await accept({ requesterId: n.fromUserId });
      // 읽음 처리
      import("firebase/firestore").then(({ updateDoc }) => {
        updateDoc(doc(firestore, "notifications", user.uid, "items", n.id), { read: true });
      });
    } catch (err) {
      console.error("Accept friend failed:", err);
    }
  };

  const handleDeclineFriend = async (n: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteDoc(doc(firestore, "friend_requests", user.uid, "items", n.fromUserId));
      import("firebase/firestore").then(({ updateDoc }) => {
        updateDoc(doc(firestore, "notifications", user.uid, "items", n.id), { read: true });
      });
    } catch (err) {
      console.error("Decline friend failed:", err);
    }
  };

  const profilePath = user ? `/athlete/${user.uid}` : "/settings";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-16 md:pb-0">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Left: logo + nav */}
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-2 font-bold text-lg"
            >
              <img src={iconSvg} alt="O-Rider" className="w-8 h-8 rounded-lg" />
              <span className="text-orange-600 hidden sm:inline">O-Rider</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-orange-50 text-orange-600 dark:bg-orange-900/20"
                        : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Right: auth-dependent */}
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            ) : user ? (
              <>
                {/* Notification bell */}
                <div className="relative">
                  <button
                    onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
                    className="relative p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-orange-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setNotifOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">알림</span>
                          {unreadCount > 0 && (
                            <button
                              onClick={handleMarkAllRead}
                              className="text-xs text-orange-500 hover:text-orange-600"
                            >
                              모두 읽음
                            </button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                              알림이 없습니다.
                            </div>
                          ) : (
                            notifications.map((n) => (
                              <button
                                key={n.id}
                                onClick={() => handleNotifClick(n)}
                                className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-50 dark:border-gray-800 ${
                                  !n.read ? "bg-orange-50/50 dark:bg-orange-900/20" : ""
                                }`}
                              >
                                <span className="text-base mt-0.5">{notifIcon(n.type)}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-2">{n.message}</p>
                                  {n.type === "friend_request" && !n.read && (
                                    <div className="flex gap-2 mt-1.5">
                                      <button
                                        onClick={(e) => handleAcceptFriend(n, e)}
                                        className="px-3 py-1 text-xs font-medium rounded-md bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                                      >
                                        수락
                                      </button>
                                      <button
                                        onClick={(e) => handleDeclineFriend(n, e)}
                                        className="px-3 py-1 text-xs font-medium rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                                      >
                                        거절
                                      </button>
                                    </div>
                                  )}
                                  <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 block">{timeAgo(typeof n.createdAt === "number" ? n.createdAt : (n.createdAt as any)?.toMillis?.() ?? Date.now())}</span>
                                </div>
                                {!n.read && (
                                  <span className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 shrink-0" />
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Profile dropdown */}
                <div className="relative">
                  <button
                    onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                    className="flex items-center gap-2"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Avatar name={profile?.nickname ?? user.displayName ?? "User"} size="sm" />
                    )}
                  </button>
                  {profileOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setProfileOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                            {profile?.nickname ?? user.displayName}
                          </div>
                        </div>
                        <Link
                          to={`/athlete/${user.uid}`}
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                          onClick={() => setProfileOpen(false)}
                        >
                          내 프로필
                        </Link>

                        <Link
                          to="/settings"
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                          onClick={() => setProfileOpen(false)}
                        >
                          설정
                        </Link>
                        {profile?.stravaConnected ? (
                          <div className="px-4 py-2 text-xs text-green-600 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                            Strava 연동됨
                          </div>
                        ) : (
                          <Link
                            to="/settings"
                            className="block px-4 py-2 text-sm text-orange-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                            onClick={() => setProfileOpen(false)}
                          >
                            Strava 연동
                          </Link>
                        )}
                        <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                        <button
                          onClick={() => {
                            setProfileOpen(false);
                            logout();
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          로그아웃
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google로 로그인
              </button>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-gray-500 dark:text-gray-400"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm font-medium ${
                    isActive
                      ? "bg-orange-50 text-orange-600 dark:bg-orange-900/20"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 relative z-0 animate-page-in">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400 dark:text-gray-500">
          <span>&copy; 2026 O-Rider <span className="inline-block ml-1 px-1.5 py-0.5 text-[10px] rounded bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-medium">Beta</span></span>
          <div className="flex items-center gap-4">
            <Link to="/feedback" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">피드백</Link>
            <Link to="/terms" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">이용약관</Link>
            <a href="mailto:orider.app@gmail.com" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">문의</a>
          </div>
        </div>
      </footer>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <nav className="flex items-center justify-around h-14">
          {/* Feed tab */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors ${
                isActive
                  ? "text-orange-600"
                  : "text-gray-500 dark:text-gray-400"
              }`
            }
          >
            <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>피드</span>
          </NavLink>

          {/* Explore tab */}
          <NavLink
            to="/explore"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors ${
                isActive
                  ? "text-orange-600"
                  : "text-gray-500 dark:text-gray-400"
              }`
            }
          >
            <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>리더보드</span>
          </NavLink>

          {/* Friends tab */}
          <NavLink
            to="/friends"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors ${
                isActive
                  ? "text-orange-600"
                  : "text-gray-500 dark:text-gray-400"
              }`
            }
          >
            <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>친구</span>
          </NavLink>

          {/* Notifications tab */}
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            className={`flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors relative ${
              notifOpen
                ? "text-orange-600"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 left-1/2 ml-1.5 min-w-[16px] h-4 px-1 bg-orange-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            <span>알림</span>
          </button>

          {/* Profile tab */}
          <NavLink
            to={profilePath}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors ${
                isActive || location.pathname.startsWith("/athlete/")
                  ? "text-orange-600"
                  : "text-gray-500 dark:text-gray-400"
              }`
            }
          >
            <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>프로필</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
