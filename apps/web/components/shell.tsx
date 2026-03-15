"use client";

import { apiRequest, assetUrl } from "@/lib/api";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { connectRealtime, type SocketLike } from "@/lib/realtime";
import {
  BellIcon,
  FileTextIcon,
  HomeIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  SnippetIcon,
  TerminalIcon,
  UserIcon,
  UserPlusIcon,
  XIcon,
} from "./icons";
import { PostCard } from "./post-card";
import { NewsPanel } from "./news-panel";
import { SnippetCard } from "./snippet-card";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatedLogo } from "./animated-logo";
import { PixelInfinityLoader } from "./pixel-infinity-loader";
import { type PostViewerState, toPostCardData } from "@/lib/posts";

const ThemeToggle = dynamic(() => import("./theme-toggle").then((module) => module.ThemeToggle), {
  ssr: false,
});

type UserSearchResult = {
  id: string;
  username: string;
  verified?: boolean;
  name: string;
  bio?: string;
  avatarUrl?: string;
};

type SearchPostResult = {
  id: string;
  body: string;
  createdAt: string;
  viewCount: number;
  author: { id?: string; username: string; verified?: boolean; name?: string };
  tags: { tag: { name: string } }[];
  _count: { likes: number; comments: number; bookmarks: number; reposts: number };
  viewer: PostViewerState;
  originalPost?: SearchPostResult | null;
};

type SearchResponse = {
  users: UserSearchResult[];
  posts: SearchPostResult[];
  articles: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
  tags: Array<Record<string, unknown>>;
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
  createdAt: string;
  viewCount: number;
  author: { id?: string; username: string; verified?: boolean; name?: string };
  tags: { tag: { name: string } }[];
  _count: { likes: number; comments: number; bookmarks: number; reposts: number };
  viewer: PostViewerState;
  originalPost?: SidebarPost | null;
};

type SidebarSnippet = {
  id: string;
  title: string;
  language: string;
  version: number;
  author: { username: string; verified?: boolean };
};

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<CurrentUser>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse>({
    users: [],
    posts: [],
    articles: [],
    tools: [],
    tags: [],
  });
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
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const mobileNotificationsRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileOverlayOpen = notificationsOpen || profileMenuOpen || mobileNavOpen;

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
        setMe(await getCurrentUser());
      } catch {
        setMe(null);
      }
    };

    void load();
  }, []);

  const nav = useMemo(() => {
    const items = [
      { href: "/feed", label: "Feed", description: "Community updates and discussions", icon: HomeIcon, activePrefix: "/feed" },
      { href: "/articles", label: "Articles", description: "Long-form technical writing", icon: FileTextIcon, activePrefix: "/articles" },
      { href: "/snippets", label: "Snippets", description: "Reusable infrastructure code", icon: SnippetIcon, activePrefix: "/snippets" },
      { href: "/tools", label: "Tools", description: "Utility workflows for daily ops", icon: TerminalIcon, activePrefix: "/tools" },
    ];

    if (me?.username) {
      items.push({
        href: `/profile/${me.username}`,
        label: "Profile",
        description: "Your reputation, activity, and specialties",
        icon: UserIcon,
        activePrefix: "/profile",
      });
    }
    if (me) {
      items.push({
        href: "/settings",
        label: "Settings",
        description: "Account and profile controls",
        icon: SettingsIcon,
        activePrefix: "/settings",
      });
    }

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
    let socket: SocketLike | null = null;

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
      setSearchResults({ users: [], posts: [], articles: [], tools: [], tags: [] });
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const load = async () => {
        setSearchLoading(true);
        try {
          const results = await apiRequest<SearchResponse>(`search?q=${encodeURIComponent(query)}&limit=5`, {
            signal: controller.signal,
          });
          setSearchResults(results);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSearchResults({ users: [], posts: [], articles: [], tools: [], tags: [] });
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
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        searchRef.current &&
        !searchRef.current.contains(target) &&
        (!mobileSearchRef.current || !mobileSearchRef.current.contains(target))
      ) {
        setSearchOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(target) &&
        (!mobileNotificationsRef.current || !mobileNotificationsRef.current.contains(target))
      ) {
        setNotificationsOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) setProfileMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSearchOpen(false);
      setNotificationsOpen(false);
      setProfileMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
    setSearchOpen(false);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOverlayOpen || typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;

    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    body.dataset.scrollLocked = "true";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      delete body.dataset.scrollLocked;
      window.scrollTo({ top: scrollY, behavior: "auto" });
    };
  }, [mobileOverlayOpen]);

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

  const closeMobileChrome = () => {
    setMobileNavOpen(false);
    setSearchOpen(false);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
  };

  const searchResultsContent = (
    <>
      {searchLoading ? <p className="px-3 py-2 text-xs text-slate-400">Searching...</p> : null}

      {!searchLoading && searchResults.users.length === 0 && searchResults.posts.length === 0 ? (
        <p className="px-3 py-2 text-xs text-slate-400">No results found.</p>
      ) : null}

      {!searchLoading ? (
        <div className="space-y-1">
          {searchResults.users.length > 0 ? (
            <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              People
            </div>
          ) : null}
          {searchResults.users.map((user) => (
            <Link
              key={user.id}
              href={`/profile/${user.username}`}
              className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-800"
              onClick={() => {
                setSearchOpen(false);
                setUserQuery("");
                setMobileNavOpen(false);
              }}
            >
              <div className="h-10 w-10 overflow-hidden rounded-full border border-line bg-bg">
                {user.avatarUrl ? (
                  <img src={assetUrl(user.avatarUrl)} alt={user.username} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-500">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-200">
                  @{user.username} <span className="text-slate-400">· {user.name}</span>
                </p>
                <p className="truncate text-xs text-slate-400">{user.bio?.trim() || "No bio yet."}</p>
              </div>
            </Link>
          ))}

          {searchResults.posts.length > 0 ? (
            <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Posts
            </div>
          ) : null}
          {searchResults.posts.map((post) => {
            const subject = post.originalPost || post;
            return (
              <Link
                key={post.id}
                href={`/feed/${post.id}`}
                className="block rounded-xl focus-visible:outline-none"
                onClick={() => {
                  setSearchOpen(false);
                  setUserQuery("");
                  setMobileNavOpen(false);
                }}
              >
                <PostCard
                  className="subtle-panel m-1 p-3"
                  variant="compact"
                  post={toPostCardData(subject)}
                  context={
                    post.originalPost
                      ? {
                          label: "Reposted by",
                          username: post.author.username,
                          verified: post.author.verified,
                          createdAt: post.createdAt,
                        }
                      : undefined
                  }
                  bodyClassName="line-clamp-2"
                  showTags={false}
                  showActions={false}
                />
              </Link>
            );
          })}
        </div>
      ) : null}
    </>
  );

  const notificationsListContent = (
    <div className="scroll-panel max-h-[25rem] overflow-y-auto p-1">
      {notificationsLoading ? (
        <div className="px-2 py-3">
          <PixelInfinityLoader compact label="Loading notifications..." />
        </div>
      ) : notifications.length === 0 ? (
        <p className="px-3 py-3 text-xs text-slate-400">No notifications yet.</p>
      ) : (
        notifications.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`notification-item w-full rounded-xl border-b border-line/70 px-3 py-3 text-left transition-colors hover:bg-slate-800 ${
              item.isRead ? "opacity-80" : ""
            }`}
            onClick={() => void markNotificationRead(item.id, item.isRead)}
          >
            <p className="text-sm text-slate-200">{item.message}</p>
            <p className="mt-1 text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
          </button>
        ))
      )}
    </div>
  );

  return (
    <>
      {mobileOverlayOpen ? (
        <button
          type="button"
          aria-label="Close open panels"
          className="mobile-panel-backdrop md:hidden"
          onClick={closeMobileChrome}
        />
      ) : null}

      {mobileNavOpen ? (
        <aside
          id="mobile-nav-drawer"
          className="menu-pop fixed inset-y-3 left-3 z-[60] flex w-[min(21.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.75rem] border border-line bg-panel md:hidden"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-4">
            <div className="flex items-center gap-3">
              <AnimatedLogo className="logo-img h-8 w-auto" />
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-100">DevOps Hub</p>
                <p className="text-xs text-slate-500">Navigation</p>
              </div>
            </div>
            <button type="button" className="icon-button-subtle" onClick={closeMobileChrome} aria-label="Close menu">
              <XIcon size={16} />
            </button>
          </div>

          <div className="scroll-panel flex-1 space-y-5 overflow-y-auto px-4 py-4">
            <section ref={mobileSearchRef} className="space-y-3" onFocus={() => setSearchOpen(true)}>
              <div className="search-input-wrap">
                <SearchIcon size={16} className="search-input-icon" />
                <input
                  className="input search-input-field"
                  placeholder="Search people or posts"
                  value={userQuery}
                  onChange={(event) => setUserQuery(event.target.value)}
                />
              </div>

              {searchOpen && userQuery.trim().length >= 2 ? (
                <div className="rounded-2xl border border-line bg-bg/40 p-1">{searchResultsContent}</div>
              ) : null}
            </section>

            <nav className="grid gap-2">
              {nav.map((item) => {
                const active = item.activePrefix === "/profile" ? pathname?.startsWith("/profile/") : pathname?.startsWith(item.activePrefix);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "border-accent/40 bg-accent/10 text-slate-100"
                        : "border-line bg-bg/40 text-slate-300 hover:border-accent/20 hover:bg-slate-800"
                    }`}
                    onClick={closeMobileChrome}
                  >
                    <span className={`rounded-lg border p-1.5 ${active ? "border-accent/30 bg-accent/10 text-accent" : "border-line bg-panel text-slate-300"}`}>
                      <item.icon size={15} />
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <section className="space-y-3 border-t border-line pt-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Account</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {me ? `Signed in as @${me.username}` : "Sign in to publish, comment, and follow contributors."}
                </p>
              </div>

              {me ? (
                <>
                  <div ref={mobileNotificationsRef} className="space-y-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl border border-line bg-bg/40 px-3 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-accent/20 hover:bg-slate-800"
                      onClick={() => setNotificationsOpen((prev) => !prev)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <BellIcon size={15} />
                        Notifications
                      </span>
                      <span className="text-xs text-slate-500">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>
                    </button>
                    {notificationsOpen ? (
                      <div className="overflow-hidden rounded-2xl border border-line bg-bg/40">{notificationsListContent}</div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/profile/${me.username}`}
                      className="rounded-xl border border-line bg-bg/40 px-3 py-2.5 text-center text-sm font-medium text-slate-200 transition-colors hover:border-accent/20 hover:bg-slate-800"
                      onClick={closeMobileChrome}
                    >
                      Profile
                    </Link>
                    <Link
                      href="/settings"
                      className="rounded-xl border border-line bg-bg/40 px-3 py-2.5 text-center text-sm font-medium text-slate-200 transition-colors hover:border-accent/20 hover:bg-slate-800"
                      onClick={closeMobileChrome}
                    >
                      Settings
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      closeMobileChrome();
                      void logout();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-bg/40 px-3 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-accent/20 hover:bg-slate-800"
                  >
                    <LogOutIcon size={15} />
                    Logout
                  </button>
                </>
              ) : (
                <div className="grid gap-2">
                  <Link
                    href="/login"
                    className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-center text-sm font-medium text-slate-950 transition-colors hover:brightness-105"
                    onClick={closeMobileChrome}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-xl border border-line bg-bg/40 px-3 py-2.5 text-center text-sm font-medium text-slate-200 transition-colors hover:border-accent/20 hover:bg-slate-800"
                    onClick={closeMobileChrome}
                  >
                    Create Account
                  </Link>
                </div>
              )}

              <ThemeToggle compact />
            </section>
          </div>
        </aside>
      ) : null}

      <div
        suppressHydrationWarning
        className="mobile-shell desktop-shell mx-auto grid max-w-[90rem] gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 md:min-h-0 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_21rem]"
      >
        <div className="page-section page-enter sticky top-2 z-30 flex items-center justify-between gap-3 px-3 py-2.5 md:hidden">
          <button
            type="button"
            className="icon-button-subtle"
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => {
              setNotificationsOpen(false);
              setProfileMenuOpen(false);
              setMobileNavOpen((prev) => !prev);
            }}
          >
            <MenuIcon size={17} />
          </button>

          <Link href="/feed" className="flex min-w-0 flex-1 items-center gap-2" onClick={closeMobileChrome}>
            <AnimatedLogo className="logo-img h-8 w-auto" />
            <span className="truncate text-sm font-semibold tracking-tight text-slate-100">DevOps Hub</span>
          </Link>

          <div className="relative flex items-center justify-end">
            {me && !mobileNavOpen ? (
              <>
                <div ref={mobileNotificationsRef} className="relative">
                  <button
                    type="button"
                    className="icon-button-subtle relative"
                    aria-label="Open notifications"
                    aria-expanded={notificationsOpen}
                    onClick={() => {
                      setMobileNavOpen(false);
                      setProfileMenuOpen(false);
                      setNotificationsOpen((prev) => !prev);
                    }}
                  >
                    <BellIcon size={16} />
                    {unreadNotifications > 0 ? (
                      <span className="notification-badge">
                        {unreadNotifications > 99 ? "99+" : unreadNotifications}
                      </span>
                    ) : null}
                  </button>

                  {notificationsOpen ? (
                    <div className="menu-pop absolute right-0 top-[calc(100%+0.6rem)] z-[60] w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-line bg-panel">
                      <div className="border-b border-line px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-300">
                        Notifications
                      </div>
                      {notificationsListContent}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="h-8 w-8" />
            )}
          </div>
        </div>

        <aside className="desktop-column hidden page-enter md:block">
          <div className="desktop-scroll-pane sidebar-scroll-pane h-full md:pb-1">
            <div className="sidebar-panel page-section min-h-full space-y-6">
              <div className="space-y-3">
                <AnimatedLogo className="logo-img h-14 w-auto" />
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-slate-100">DevOps Hub</h1>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Community, reference material, and utility workflows for infrastructure engineers.
                  </p>
                </div>
              </div>

              <section ref={searchRef} className="subtle-panel relative space-y-3" onFocus={() => setSearchOpen(true)}>
                <div className="space-y-2">
                  <h2 className="text-[1.25rem] font-semibold leading-[1.4] tracking-tight text-slate-100 sm:text-[1.5rem]">
                    Search the platform
                  </h2>
                  <p className="text-[0.95rem] leading-[1.4] text-slate-400">
                    Jump directly to people and recent posts without leaving the current workflow.
                  </p>
                </div>
                <div className="search-input-wrap">
                  <SearchIcon size={16} className="search-input-icon" />
                  <input
                    className="input search-input-field"
                    placeholder="Search people or posts"
                    value={userQuery}
                    onChange={(event) => setUserQuery(event.target.value)}
                  />
                </div>

                {searchOpen && userQuery.trim().length >= 2 ? (
                  <div className="menu-pop search-results-panel scroll-panel absolute left-0 right-0 top-[calc(100%+0.6rem)] z-30 overflow-auto rounded-2xl border border-line bg-panel p-1">
                    {searchResultsContent}
                  </div>
                ) : null}
              </section>

              <section className="space-y-3">
                <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {nav.map((item) => {
                    const active = item.activePrefix === "/profile" ? pathname?.startsWith("/profile/") : pathname?.startsWith(item.activePrefix);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-2xl border px-4 py-3 transition-all ${
                          active
                            ? "border-accent/40 bg-accent/10 text-slate-100"
                            : "border-line bg-bg/40 text-slate-200 hover:border-accent/20 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 rounded-xl border p-2 ${active ? "border-accent/30 bg-accent/10 text-accent" : "border-line bg-panel text-slate-300"}`}>
                            <item.icon size={16} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{item.label}</span>
                            <span className={`mt-1 block text-xs leading-5 ${active ? "text-slate-300" : "text-slate-400"}`}>{item.description}</span>
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </section>

              <section className="space-y-3 border-t border-line pt-5">
                <div>
                  <h2 className="section-heading text-base">Account</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {me ? "Keep up with replies, mentions, and account settings." : "Sign in to publish, comment, and follow contributors."}
                  </p>
                </div>

                {!me ? (
                  <div className="space-y-3 overflow-visible">
                    <div className="action-cluster relative z-40 overflow-visible">
                      <Link href="/login" className="btn-primary w-full sm:flex-1 lg:w-full">
                        <LogInIcon size={16} />
                        Sign In
                      </Link>
                      <Link href="/register" className="btn-secondary w-full sm:flex-1 lg:w-full">
                        <UserPlusIcon size={16} />
                        Create Account
                      </Link>
                    </div>
                    <ThemeToggle />
                  </div>
                ) : (
                  <div className="space-y-3 overflow-visible">
                    <div className="sidebar-account-controls relative z-40 overflow-visible">
                      <div ref={notificationsRef} className="sidebar-account-control relative overflow-visible">
                        <button
                          type="button"
                          className="top-nav-button notifications-btn w-full"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            setNotificationsOpen((prev) => !prev);
                          }}
                        >
                          <BellIcon size={16} />
                          <span className="sidebar-account-label">Notifications</span>
                          {unreadNotifications > 0 ? (
                            <span className={`notification-badge ${bellPulse ? "pulse-dot" : ""}`}>
                              {unreadNotifications > 99 ? "99+" : unreadNotifications}
                            </span>
                          ) : null}
                        </button>

                        {notificationsOpen ? (
                          <div className="notification-dropdown sidebar-notification-dropdown menu-pop absolute bottom-full left-0 right-0 z-40 mb-2 overflow-hidden rounded-2xl border border-line bg-panel">
                            <div className="border-b border-line px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-300">
                              Notifications
                            </div>
                            {notificationsListContent}
                          </div>
                        ) : null}
                      </div>

                      <div ref={profileMenuRef} className="sidebar-account-control relative z-40 overflow-visible">
                        <button
                          type="button"
                          className="top-nav-button w-full"
                          onClick={() => {
                            setNotificationsOpen(false);
                            setProfileMenuOpen((prev) => !prev);
                          }}
                        >
                          <UserIcon size={16} />
                          <span className="sidebar-account-label truncate">{me.username}</span>
                          <span className="text-xs leading-none">▼</span>
                        </button>
                        {profileMenuOpen ? (
                          <div className="account-dropdown-panel menu-pop absolute right-0 bottom-full z-40 mb-2 min-w-[15rem] rounded-2xl border border-line bg-panel p-2">
                            <Link
                              href={`/profile/${me.username}`}
                              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
                              onClick={() => setProfileMenuOpen(false)}
                            >
                              <UserIcon size={14} />
                              Profile
                            </Link>
                            <Link
                              href="/settings"
                              className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
                              onClick={() => setProfileMenuOpen(false)}
                            >
                              <SettingsIcon size={14} />
                              Settings
                            </Link>
                            <div className="mt-2 border-t border-line pt-3">
                              <ThemeToggle compact />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setProfileMenuOpen(false);
                                void logout();
                              }}
                              className="btn-secondary mt-3 w-full justify-start"
                            >
                              <LogOutIcon size={14} />
                              Logout
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <div className="border-t border-line pt-5 text-sm text-slate-400">
                <div className="flex flex-wrap gap-3">
                  <Link href="/policies/terms" className="hover:text-slate-200">
                    Terms
                  </Link>
                  <Link href="/policies/privacy" className="hover:text-slate-200">
                    Privacy
                  </Link>
                  <Link href="/policies/guidelines" className="hover:text-slate-200">
                    Guidelines
                  </Link>
                  <Link href="/about" className="hover:text-slate-200">
                    About Us
                  </Link>
                  <Link href="/accessibility" className="hover:text-slate-200">
                    Accessibility
                  </Link>
                </div>
                <p className="mt-3 text-xs text-slate-500">DevOps Hub © 2026. All rights reserved.</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="desktop-main min-w-0 page-stack page-enter md:pr-1">{children}</main>

        <footer className="mt-1 border-t border-line pt-2 text-sm text-slate-500 md:hidden">
          <div className="flex flex-wrap gap-3 px-1">
            <Link href="/policies/terms" className="hover:text-slate-200">
              Terms
            </Link>
            <Link href="/policies/privacy" className="hover:text-slate-200">
              Privacy
            </Link>
            <Link href="/policies/guidelines" className="hover:text-slate-200">
              Guidelines
            </Link>
            <Link href="/about" className="hover:text-slate-200">
              About Us
            </Link>
            <Link href="/accessibility" className="hover:text-slate-200">
              Accessibility
            </Link>
          </div>
          <p className="mt-3 px-1 text-xs text-slate-500">DevOps Hub © 2026. All rights reserved.</p>
        </footer>

        <aside className="desktop-column hidden page-enter xl:block">
          <div className="desktop-scroll-pane right-sidebar-scroll-pane h-full space-y-4 pr-1 md:pb-1">
            <section className="page-section">
              <h2 className="text-lg font-semibold text-slate-100">Community pulse</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Supporting signals stay on the right so the main workflow remains focused on the center column.
              </p>
            </section>

            <section className="page-section">
              <div>
                <h2 className="section-heading text-base">Latest Posts</h2>
                <p className="section-copy mt-1">Fresh lessons learned and operational updates.</p>
              </div>
              <div className="mt-4 space-y-3">
                {latestPosts.length === 0 ? (
                  <p className="text-xs text-slate-500">No posts yet.</p>
                ) : (
                  latestPosts.map((post) => {
                    const subject = post.originalPost || post;
                    return (
                      <Link key={post.id} href={`/feed/${post.id}`} className="block rounded-xl focus-visible:outline-none">
                        <PostCard
                          className="subtle-panel p-3"
                          variant="compact"
                          post={toPostCardData(subject)}
                          context={
                            post.originalPost
                              ? {
                                  label: "Reposted by",
                                  username: post.author.username,
                                  verified: post.author.verified,
                                  createdAt: post.createdAt,
                                }
                              : undefined
                          }
                          bodyClassName="line-clamp-3"
                          showTags={false}
                          showActions={false}
                        />
                      </Link>
                    );
                  })
                )}
              </div>
            </section>

            <section className="page-section">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-heading text-base">Latest Snippets</h2>
                  <p className="section-copy mt-1">Reusable fragments worth copying into your next change set.</p>
                </div>
                <Link href="/snippets" className="text-xs font-medium text-accent hover:text-slate-100">
                  Browse
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {latestSnippets.length === 0 ? (
                  <p className="text-xs text-slate-500">No snippets yet.</p>
                ) : (
                  latestSnippets.map((snippet) => (
                    <SnippetCard key={snippet.id} className="subtle-panel p-3" compact snippet={snippet} />
                  ))
                )}
              </div>
            </section>

            <section className="page-section">
              <NewsPanel />
            </section>
          </div>
        </aside>
      </div>
    </>
  );
}
