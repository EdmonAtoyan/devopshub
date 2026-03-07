"use client";

import { apiRequest, assetUrl } from "@/lib/api";
import { connectRealtime } from "@/lib/realtime";
import {
  BellIcon,
  FileTextIcon,
  HomeIcon,
  LogInIcon,
  LogOutIcon,
  SearchIcon,
  SettingsIcon,
  SnippetIcon,
  TerminalIcon,
  UserIcon,
  UserPlusIcon,
} from "./icons";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatedLogo } from "./animated-logo";
import { PixelInfinityLoader } from "./pixel-infinity-loader";

const ThemeToggle = dynamic(() => import("./theme-toggle").then((module) => module.ThemeToggle), {
  ssr: false,
});

type Me = {
  id: string;
  username: string;
  email: string;
} | null;

type UserSearchResult = {
  id: string;
  username: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
};

type NotificationItem = {
  id: string;
  userId?: string;
  message: string;
  type: string;
  createdAt: string;
  isRead: boolean;
};

type NotificationsResponse = {
  unreadCount: number;
  notifications: NotificationItem[];
};

type SidebarPost = {
  id: string;
  body: string;
  author: { username: string };
  createdAt: string;
};

type SidebarSnippet = {
  id: string;
  title: string;
  author: { username: string };
  createdAt: string;
};

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [bellPulse, setBellPulse] = useState(false);
  const [latestPosts, setLatestPosts] = useState<SidebarPost[]>([]);
  const [latestSnippets, setLatestSnippets] = useState<SidebarSnippet[]>([]);

  const searchRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!me) {
      setNotifications([]);
      setUnreadNotifications(0);
      return;
    }

    setNotificationsLoading(true);
    try {
      const data = await apiRequest<NotificationsResponse>("notifications");
      setNotifications(data.notifications);
      setUnreadNotifications(data.unreadCount);
    } catch {
      setNotifications([]);
      setUnreadNotifications(0);
    } finally {
      setNotificationsLoading(false);
    }
  }, [me]);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await apiRequest<Me>("auth/me");
        setMe(user);
      } catch {
        setMe(null);
      }
    };

    void load();
  }, []);

  const nav = useMemo(() => {
    const items = [
      { href: "/feed", label: "Feed", icon: HomeIcon },
      { href: "/articles", label: "Articles", icon: FileTextIcon },
      { href: "/snippets", label: "Snippets", icon: SnippetIcon },
      { href: "/tools", label: "Tools", icon: TerminalIcon },
    ];

    if (me?.username) items.push({ href: `/profile/${me.username}`, label: "Profile", icon: UserIcon });
    if (me) items.push({ href: "/settings", label: "Settings", icon: SettingsIcon });

    return items;
  }, [me]);

  useEffect(() => {
    const coreRoutes = ["/feed", "/articles", "/snippets", "/tools", "/settings"];
    coreRoutes.forEach((route) => router.prefetch(route));
    if (me?.username) router.prefetch(`/profile/${me.username}`);
  }, [router, me?.username]);

  const logout = async () => {
    try {
      await apiRequest("auth/logout", { method: "POST" });
    } finally {
      setMe(null);
      router.push("/login");
      router.refresh();
    }
  };

  useEffect(() => {
    if (!me) {
      setNotifications([]);
      setUnreadNotifications(0);
      return;
    }

    void loadNotifications();
    const timer = setInterval(() => void loadNotifications(), 30_000);
    return () => clearInterval(timer);
  }, [me, loadNotifications]);

  useEffect(() => {
    if (!notificationsOpen || !me) return;
    void loadNotifications();
  }, [notificationsOpen, me, loadNotifications]);

  useEffect(() => {
    if (!me?.id) return;

    let mounted = true;
    let socket: {
      on: (event: string, cb: (...args: any[]) => void) => void;
      off: (event: string, cb?: (...args: any[]) => void) => void;
      disconnect: () => void;
      emit: (event: string, payload?: any) => void;
    } | null = null;

    const onNewNotification = (payload: NotificationItem) => {
      if (!mounted) return;
      if (payload.userId && payload.userId !== me.id) return;

      setNotifications((prev) => {
        if (prev.some((entry) => entry.id === payload.id)) return prev;
        return [{ ...payload, isRead: false }, ...prev].slice(0, 50);
      });
      setUnreadNotifications((prev) => prev + 1);
      setBellPulse(true);
      setTimeout(() => setBellPulse(false), 1000);
    };

    const setup = async () => {
      socket = await connectRealtime();
      if (!socket || !mounted) return;
      socket.emit("join_user");
      socket.on("new_notification", onNewNotification);
    };

    void setup();

    return () => {
      mounted = false;
      if (socket) {
        socket.off("new_notification", onNewNotification);
        socket.disconnect();
      }
    };
  }, [me?.id]);

  const markNotificationRead = async (notificationId: string, alreadyRead: boolean) => {
    if (alreadyRead) return;
    try {
      const data = await apiRequest<{ success: boolean; unreadCount?: number }>(`notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      setNotifications((prev) =>
        prev.map((entry) => (entry.id === notificationId ? { ...entry, isRead: true } : entry)),
      );
      if (typeof data.unreadCount === "number") {
        setUnreadNotifications(data.unreadCount);
      } else {
        setUnreadNotifications((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Keep UI stable if request fails.
    }
  };

  useEffect(() => {
    const query = userQuery.trim();
    if (query.length < 2) {
      setUserResults([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const load = async () => {
        setSearchLoading(true);
        try {
          const results = await apiRequest<UserSearchResult[]>(`search/users?q=${encodeURIComponent(query)}&limit=8`, {
            signal: controller.signal,
          });
          setUserResults(results);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setUserResults([]);
        } finally {
          setSearchLoading(false);
        }
      };

      void load();
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [userQuery]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(target)) setNotificationsOpen(false);
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) setProfileMenuOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    const loadSidebarItems = async () => {
      try {
        const [posts, snippets] = await Promise.all([
          apiRequest<SidebarPost[]>("feed?sort=latest&limit=5&commentLimit=0"),
          apiRequest<SidebarSnippet[]>("snippets?limit=5"),
        ]);
        setLatestPosts(posts);
        setLatestSnippets(snippets);
      } catch {
        setLatestPosts([]);
        setLatestSnippets([]);
      }
    };

    void loadSidebarItems();
  }, []);

  return (
    <div suppressHydrationWarning className="mx-auto grid min-h-screen max-w-7xl gap-4 p-3 md:grid-cols-[240px_minmax(0,1fr)_320px] md:p-4">
      <aside className="card sticky top-4 h-fit overflow-visible p-4 page-enter">
        <AnimatedLogo className="logo-img h-14 w-auto" />
        <p className="mt-1 text-base text-slate-400">Community for infrastructure engineers</p>
        <div ref={searchRef} className="relative mt-4" onFocus={() => setSearchOpen(true)}>
          <SearchIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="h-9 w-full rounded-lg border border-line bg-bg pl-9 pr-3 text-sm text-slate-100 outline-none transition-all duration-150 focus:border-accent"
            placeholder="Search users..."
            value={userQuery}
            onChange={(event) => setUserQuery(event.target.value)}
          />

          {searchOpen && userQuery.trim().length >= 2 ? (
            <div className="menu-pop absolute left-0 right-0 top-[calc(100%+0.4rem)] z-30 max-h-80 overflow-auto rounded-lg border border-line bg-panel p-1 shadow-2xl">
              {searchLoading ? <p className="px-3 py-2 text-xs text-slate-400">Searching...</p> : null}

              {!searchLoading && userResults.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">No users found.</p>
              ) : null}

              {!searchLoading
                ? userResults.map((user) => (
                    <Link
                      key={user.id}
                      href={`/profile/${user.username}`}
                      className="flex items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-slate-800"
                      onClick={() => {
                        setSearchOpen(false);
                        setUserQuery("");
                      }}
                    >
                      <div className="h-8 w-8 overflow-hidden rounded-full border border-line bg-bg">
                        {user.avatarUrl ? (
                          <img src={assetUrl(user.avatarUrl)} alt={user.username} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-500">
                            {user.username.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-200">
                          @{user.username} <span className="text-slate-400">· {user.name}</span>
                        </p>
                        <p className="truncate text-xs text-slate-400">{user.bio?.trim() || "No bio yet."}</p>
                      </div>
                    </Link>
                  ))
                : null}
            </div>
          ) : null}
        </div>

        <nav className="mt-4 flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-base text-slate-200 transition-colors hover:bg-slate-800"
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {!me ? (
            <>
              <Link href="/login" className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-slate-300">
                <LogInIcon size={14} />
                Login
              </Link>
              <Link href="/register" className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-slate-300">
                <UserPlusIcon size={14} />
                Register
              </Link>
              <ThemeToggle />
            </>
          ) : (
            <>
              <div ref={notificationsRef} className="relative overflow-visible">
                <button
                  type="button"
                  className="top-nav-button notifications-btn"
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                >
                  <BellIcon size={14} />
                  Notifications
                  {unreadNotifications > 0 ? (
                    <span className={`notification-badge ${bellPulse ? "pulse-dot" : ""}`}>
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  ) : null}
                </button>

                {notificationsOpen ? (
                  <div className="notification-dropdown menu-pop absolute right-0 top-full mt-2 min-w-[320px] max-w-[90vw] overflow-hidden rounded-xl border border-line bg-white shadow-2xl">
                    <div className="border-b border-line px-3 py-2 text-xs text-slate-300">Notifications</div>
                    <div className="max-h-[400px] overflow-y-auto p-1">
                      {notificationsLoading ? (
                        <div className="px-2 py-3">
                          <PixelInfinityLoader compact label="Loading notifications..." />
                        </div>
                      ) : notifications.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-slate-400">No notifications yet.</p>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`notification-item w-full rounded-md border-b border-line/70 px-3 py-2 text-left transition-colors hover:bg-slate-800 ${
                              item.isRead ? "opacity-80" : ""
                            }`}
                            onClick={() => void markNotificationRead(item.id, item.isRead)}
                          >
                            <p className="text-xs text-slate-200">{item.message}</p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {new Date(item.createdAt).toLocaleString()}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  className="top-nav-button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                >
                  <UserIcon size={14} />
                  {me.username}
                  <span className="text-xs leading-none">▼</span>
                </button>
                {profileMenuOpen ? (
                  <div className="menu-pop absolute right-0 z-40 mt-2 min-w-[220px] rounded-lg border border-line bg-panel p-2 shadow-2xl">
                    <Link
                      href={`/profile/${me.username}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      <UserIcon size={14} />
                      Profile
                    </Link>
                    <Link
                      href="/settings"
                      className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      <SettingsIcon size={14} />
                      Settings
                    </Link>
                    <div className="mt-2 border-t border-line pt-2">
                      <ThemeToggle compact />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void logout();
                      }}
                      className="mt-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      <LogOutIcon size={14} />
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="mt-4 border-t border-line pt-3 text-sm text-slate-400">
          <div className="flex flex-wrap gap-3">
            <Link href="/policies/terms" className="hover:text-slate-200">Terms</Link>
            <Link href="/policies/privacy" className="hover:text-slate-200">Privacy</Link>
            <Link href="/policies/guidelines" className="hover:text-slate-200">Guidelines</Link>
          </div>
        </div>
      </aside>

      <main className="min-w-0 space-y-4 page-enter">{children}</main>

      <aside className="card sticky top-4 hidden h-fit max-h-[calc(100vh-2rem)] overflow-hidden p-4 page-enter md:block">
        <h2 className="text-base font-semibold text-slate-200">Latest Posts</h2>
        <div className="mt-3 space-y-2">
          {latestPosts.length === 0 ? (
            <p className="text-xs text-slate-500">No posts yet.</p>
          ) : (
            latestPosts.map((post) => (
              <article key={post.id} className="rounded-lg border border-line p-2">
                <p className="line-clamp-2 text-sm text-slate-200">{post.body}</p>
                <p className="mt-1 text-[11px] text-slate-500">@{post.author.username}</p>
              </article>
            ))
          )}
        </div>

        <h2 className="mt-4 text-base font-semibold text-slate-200">Latest Snippets</h2>
        <div className="mt-3 space-y-2">
          {latestSnippets.length === 0 ? (
            <p className="text-xs text-slate-500">No snippets yet.</p>
          ) : (
            latestSnippets.map((snippet) => (
              <article key={snippet.id} className="rounded-lg border border-line p-2">
                <p className="line-clamp-2 text-sm text-slate-200">{snippet.title}</p>
                <p className="mt-1 text-[11px] text-slate-500">@{snippet.author.username}</p>
              </article>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
