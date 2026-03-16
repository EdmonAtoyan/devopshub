"use client";

import { TrashIcon } from "@/components/icons";
import { PostCard } from "@/components/post-card";
import { Shell } from "@/components/shell";
import { UsernameInline } from "@/components/verified-badge";
import { apiRequest, assetUrl } from "@/lib/api";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { applyPostInteraction, type PostActionType, type PostViewerState, toPostCardData } from "@/lib/posts";
import { createTextPreview } from "@/lib/preview";
import { connectRealtime, type SocketLike } from "@/lib/realtime";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  username: string;
  verified?: boolean;
  name: string;
  bio?: string;
  avatarUrl?: string;
  specialties: string[];
  reputation: number;
  githubUrl?: string;
  gitlabUrl?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  stats: {
    posts: number;
    followers: number;
    following: number;
    articles: number;
    snippets: number;
  };
};

type ProfileTab = "posts" | "snippets" | "saved" | "activity";
type ActivityItem = {
  type: "FOLLOW" | "POST_CREATED" | "SNIPPET_CREATED" | "LIKE";
  user?: string;
  postId?: string;
  snippetId?: string;
  snippetTitle?: string;
  createdAt: string;
};

type SavedPostSnapshot = {
  id: string;
  body: string;
  createdAt: string;
  viewCount: number;
  author: { id: string; username: string; verified?: boolean; name: string };
  tags: { tag: { name: string } }[];
  _count: { likes: number; comments: number; bookmarks: number; reposts: number };
  viewer: PostViewerState;
};

type SavedPost = SavedPostSnapshot & {
  originalPost?: SavedPostSnapshot | null;
};

type SavedPostEntry = {
  savedAt: string;
  post: SavedPost;
};

type ProfilePost = SavedPost;

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params?.username ?? "";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [me, setMe] = useState<CurrentUser>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [profilePosts, setProfilePosts] = useState<ProfilePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [savedPosts, setSavedPosts] = useState<SavedPostEntry[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<Record<string, Partial<Record<PostActionType, boolean>>>>({});
  const showGifs = me?.showGifs !== false;

  const loadMe = async () => {
    try {
      setMe(await getCurrentUser());
    } catch {
      setMe(null);
    }
  };

  const load = async () => {
    try {
      const data = await apiRequest<Profile | null>(`users/${username}`);
      setProfile(data);
      setError(data ? "" : "Profile not found.");
    } catch {
      setError("Could not load profile.");
    }
  };

  useEffect(() => {
    if (!username) return;
    setProfilePosts([]);
    setPostsError("");
    setSavedPosts([]);
    setSavedError("");
    void load();
    void loadMe();
  }, [username]);

  useEffect(() => {
    if (!profile?.id) return;
    let mounted = true;
    let socket: SocketLike | null = null;

    const onFollowEvent = (payload: { followeeId?: string }) => {
      if (!mounted) return;
      if (payload?.followeeId !== profile.id) return;
      void load();
    };

    const setup = async () => {
      socket = await connectRealtime();
      if (!socket || !mounted) return;
      socket.on("new_follow", onFollowEvent);
    };
    void setup();

    return () => {
      mounted = false;
      if (socket) {
        socket.off("new_follow", onFollowEvent);
        socket.disconnect();
      }
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!username || tab !== "activity") return;

    const loadActivity = async () => {
      try {
        const data = await apiRequest<ActivityItem[]>(`users/${username}/activity`);
        setActivity(data);
      } catch {
        setActivity([]);
      }
    };

    void loadActivity();
  }, [tab, username]);

  useEffect(() => {
    if (!profile?.id || !me?.id || me.username === profile.username) {
      setIsFollowing(false);
      return;
    }

    let cancelled = false;

    const loadFollowState = async () => {
      try {
        const data = await apiRequest<{ following: boolean }>(`users/${profile.id}/following`);
        if (!cancelled) setIsFollowing(data.following);
      } catch {
        if (!cancelled) setIsFollowing(false);
      }
    };

    void loadFollowState();

    return () => {
      cancelled = true;
    };
  }, [me?.id, me?.username, profile?.id, profile?.username]);

  useEffect(() => {
    if (tab !== "saved") return;
    if (!me?.username || me.username !== username) {
      setTab("posts");
    }
  }, [me?.username, tab, username]);

  useEffect(() => {
    if (tab !== "posts" || !username) return;

    let cancelled = false;
    setPostsLoading(true);

    const loadProfilePosts = async () => {
      try {
        const data = await apiRequest<ProfilePost[]>(`users/${username}/posts?limit=12&commentLimit=0`);
        if (!cancelled) {
          setProfilePosts(data);
          setPostsError("");
        }
      } catch {
        if (!cancelled) {
          setProfilePosts([]);
          setPostsError("Could not load posts.");
        }
      } finally {
        if (!cancelled) {
          setPostsLoading(false);
        }
      }
    };

    void loadProfilePosts();

    return () => {
      cancelled = true;
    };
  }, [tab, username]);

  useEffect(() => {
    if (tab !== "saved" || me?.username !== username) return;

    let cancelled = false;
    setSavedLoading(true);

    const loadSavedPosts = async () => {
      try {
        const data = await apiRequest<SavedPostEntry[]>("users/me/bookmarks?limit=30");
        if (!cancelled) {
          setSavedPosts(data);
          setSavedError("");
        }
      } catch {
        if (!cancelled) {
          setSavedPosts([]);
          setSavedError("Could not load saved posts.");
        }
      } finally {
        if (!cancelled) {
          setSavedLoading(false);
        }
      }
    };

    void loadSavedPosts();

    return () => {
      cancelled = true;
    };
  }, [me?.username, tab, username]);

  const updateFollowerCount = (delta: number) => {
    setProfile((current) =>
      current
        ? {
            ...current,
            stats: {
              ...current.stats,
              followers: Math.max(0, current.stats.followers + delta),
            },
          }
        : current,
    );
  };

  const toggleFollow = async () => {
    if (!profile || followLoading) return;
    if (!me?.id) {
      setError("Login is required to follow users.");
      return;
    }

    const previousFollowing = isFollowing;
    const nextFollowing = !previousFollowing;
    const optimisticDelta = nextFollowing ? 1 : -1;

    setFollowLoading(true);
    setIsFollowing(nextFollowing);
    updateFollowerCount(optimisticDelta);

    try {
      const data = await apiRequest<{ following: boolean }>(`users/${profile.id}/follow`, { method: "POST" });
      setIsFollowing(data.following);
      if (data.following !== nextFollowing) {
        const resolvedDelta = data.following === previousFollowing ? 0 : data.following ? 1 : -1;
        updateFollowerCount(resolvedDelta - optimisticDelta);
      }
      setError("");
    } catch {
      setIsFollowing(previousFollowing);
      updateFollowerCount(-optimisticDelta);
      setError("Could not update follow state. Please try again.");
    } finally {
      setFollowLoading(false);
    }
  };

  const removeSavedPost = async (postId: string) => {
    try {
      await apiRequest(`feed/${postId}/bookmark`, { method: "POST" });
      setSavedPosts((current) => current.filter((entry) => (entry.post.originalPost || entry.post).id !== postId));
      setSavedError("");
    } catch {
      setSavedError("Could not update saved posts.");
    }
  };

  const interact = async (postId: string, action: PostActionType) => {
    if (!me?.id) {
      setError(action === "repost" ? "Login is required to repost." : "Login is required for this action.");
      return;
    }
    if (pendingActions[postId]?.[action]) {
      return;
    }

    const previousActive = getInteractionState(profilePosts, savedPosts, postId, action);
    setPendingActions((current) => ({
      ...current,
      [postId]: {
        ...current[postId],
        [action]: true,
      },
    }));
    setProfilePosts((current) => current.map((post) => applyPostInteraction(post, postId, action)));
    setSavedPosts((current) =>
      current.map((entry) => ({
        ...entry,
        post: applyPostInteraction(entry.post, postId, action),
      })),
    );

    try {
      if (action === "repost") {
        const result = await apiRequest<{ reposted: boolean }>(`feed/${postId}/repost`, { method: "POST" });
        setProfilePosts((current) => current.map((post) => applyPostInteraction(post, postId, action, result.reposted)));
        setSavedPosts((current) =>
          current.map((entry) => ({
            ...entry,
            post: applyPostInteraction(entry.post, postId, action, result.reposted),
          })),
        );
      } else if (action === "like") {
        const result = await apiRequest<{ liked: boolean }>(`feed/${postId}/like`, { method: "POST" });
        setProfilePosts((current) => current.map((post) => applyPostInteraction(post, postId, action, result.liked)));
        setSavedPosts((current) =>
          current.map((entry) => ({
            ...entry,
            post: applyPostInteraction(entry.post, postId, action, result.liked),
          })),
        );
      } else {
        const result = await apiRequest<{ bookmarked: boolean }>(`feed/${postId}/bookmark`, { method: "POST" });
        setProfilePosts((current) => current.map((post) => applyPostInteraction(post, postId, action, result.bookmarked)));
        setSavedPosts((current) => {
          if (!result.bookmarked) {
            return current.filter((entry) => (entry.post.originalPost || entry.post).id !== postId);
          }
          return current.map((entry) => ({
            ...entry,
            post: applyPostInteraction(entry.post, postId, action, result.bookmarked),
          }));
        });
      }
      setError("");
      setSavedError("");
    } catch {
      setProfilePosts((current) => current.map((post) => applyPostInteraction(post, postId, action, previousActive)));
      setSavedPosts((current) =>
        current.map((entry) => ({
          ...entry,
          post: applyPostInteraction(entry.post, postId, action, previousActive),
        })),
      );
      setError(action === "repost" ? "Login is required to repost." : "Login is required for this action.");
    } finally {
      setPendingActions((current) => {
        const next = {
          ...current,
          [postId]: {
            ...current[postId],
            [action]: false,
          },
        };
        if (!next[postId]?.like && !next[postId]?.bookmark && !next[postId]?.repost) {
          delete next[postId];
        }
        return next;
      });
    }
  };

  if (!profile) {
    return (
      <Shell>
        <section className="page-section text-base text-danger-soft">{error || "Loading..."}</section>
      </Shell>
    );
  }

  const isMe = me?.username === profile.username;

  return (
    <Shell>
      <section className="page-header">
        <div className="space-y-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
              <div className="h-24 w-24 overflow-hidden rounded-2xl border border-line bg-bg">
                {profile.avatarUrl ? (
                  <img src={assetUrl(profile.avatarUrl)} alt={profile.username} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">No photo</div>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
                    <UsernameInline username={profile.username} verified={profile.verified} />
                  </h1>
                  <p className="mt-2 max-w-2xl text-base leading-8 text-slate-400">{profile.bio || "DevOps engineer"}</p>
                </div>
              </div>
            </div>

            {isMe ? (
              <Link href="/settings" className="btn-secondary w-full sm:w-auto">
                Edit Profile
              </Link>
            ) : (
              <button
                className={`${isFollowing ? "btn-secondary profile-follow-button is-following" : "btn-primary profile-follow-button"} w-full sm:w-auto`}
                disabled={followLoading}
                aria-disabled={followLoading}
                title={isFollowing ? "Unfollow this user" : "Follow this user"}
                onClick={() => void toggleFollow()}
              >
                {followLoading ? "Updating..." : isFollowing ? "Unfollow" : "Follow"}
              </button>
            )}
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <p className="text-2xl font-semibold text-slate-100">{profile.stats.posts}</p>
              <p className="mt-1 text-sm text-slate-400">Posts</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl font-semibold text-slate-100">{profile.stats.followers}</p>
              <p className="mt-1 text-sm text-slate-400">Followers</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl font-semibold text-slate-100">{profile.stats.following}</p>
              <p className="mt-1 text-sm text-slate-400">Following</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl font-semibold text-slate-100">{profile.stats.snippets}</p>
              <p className="mt-1 text-sm text-slate-400">Snippets</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-accent">
            {profile.specialties.map((skill) => (
              <span key={skill} className="rounded-xl border border-line bg-bg/50 px-3 py-1.5">
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-2 border-t border-line pt-5">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              className={`tab-button ${tab === "posts" ? "is-active" : ""}`}
              onClick={() => setTab("posts")}
            >
              Posts
            </button>
            <button
              type="button"
              className={`tab-button ${tab === "snippets" ? "is-active" : ""}`}
              onClick={() => setTab("snippets")}
            >
              Snippets
            </button>
            {isMe ? (
              <button
                type="button"
                className={`tab-button ${tab === "saved" ? "is-active" : ""}`}
                onClick={() => setTab("saved")}
              >
                Saved
              </button>
            ) : null}
            <button
              type="button"
              className={`tab-button ${tab === "activity" ? "is-active" : ""}`}
              onClick={() => setTab("activity")}
            >
              Activity
            </button>
          </div>

          {tab === "posts" ? (
            <div className="space-y-3">
              <div className="subtle-panel text-sm text-slate-300">
                Posts published: <span className="font-semibold text-slate-100">{profile.stats.posts}</span>
              </div>
              {postsLoading ? <p className="subtle-panel text-sm text-slate-400">Loading posts...</p> : null}
              {!postsLoading && profilePosts.length === 0 ? (
                <p className="subtle-panel text-sm text-slate-400">No posts published yet.</p>
              ) : null}
              {!postsLoading
                ? profilePosts.map((post) => {
                    const subject = post.originalPost || post;

                    return (
                      <PostCard
                        key={post.id}
                        className="subtle-panel p-5"
                        post={toPostCardData(subject)}
                        showGifs={showGifs}
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
                        onLike={() => void interact(subject.id, "like")}
                        onBookmark={() => void interact(subject.id, "bookmark")}
                        onRepost={me?.id && me.id !== subject.author.id ? () => void interact(subject.id, "repost") : undefined}
                        disabledActions={pendingActions[subject.id]}
                        footer={
                          <Link href={`/feed/${post.id}`} className="post-link-button w-fit">
                            Open thread
                          </Link>
                        }
                      />
                    );
                  })
                : null}
              {postsError ? <p className="text-sm text-danger-soft">{postsError}</p> : null}
            </div>
          ) : null}

          {tab === "snippets" ? (
            <div className="subtle-panel text-sm text-slate-300">
              Snippets shared: <span className="font-semibold text-slate-100">{profile.stats.snippets}</span>
            </div>
          ) : null}

          {tab === "saved" ? (
            <div className="space-y-3">
              {savedLoading ? (
                <p className="subtle-panel text-sm text-slate-400">Loading saved posts...</p>
              ) : null}
              {!savedLoading && savedPosts.length === 0 ? (
                <p className="subtle-panel text-sm text-slate-400">Saved posts will appear here after you bookmark them from the feed.</p>
              ) : null}
              {!savedLoading
                ? savedPosts.map((entry) => {
                    const subject = entry.post.originalPost || entry.post;
                    const preview = createTextPreview(subject.body, { maxChars: 220, maxLines: 5 });

                    return (
                      <PostCard
                        key={entry.post.id}
                        className="subtle-panel p-5"
                        post={toPostCardData(subject)}
                        showGifs={showGifs}
                        context={
                          entry.post.originalPost
                            ? {
                                label: "Saved repost by",
                                username: entry.post.author.username,
                                verified: entry.post.author.verified,
                              }
                            : undefined
                        }
                        metaNote={`Saved ${new Date(entry.savedAt).toLocaleString()}`}
                        body={preview.text}
                        headerAction={
                          <button
                            type="button"
                            className="post-link-button"
                            onClick={() => void removeSavedPost(subject.id)}
                          >
                            <TrashIcon size={14} />
                            <span>Remove</span>
                          </button>
                        }
                        onLike={() => void interact(subject.id, "like")}
                        onBookmark={() => void interact(subject.id, "bookmark")}
                        onRepost={me?.id && me.id !== subject.author.id ? () => void interact(subject.id, "repost") : undefined}
                        disabledActions={pendingActions[subject.id]}
                        footer={
                          <Link href={`/feed/${entry.post.id}`} className="post-link-button w-fit">
                            Open thread
                          </Link>
                        }
                      />
                    );
                  })
                : null}
              {savedError ? <p className="text-sm text-danger-soft">{savedError}</p> : null}
            </div>
          ) : null}

          {tab === "activity" ? (
            <div className="space-y-3">
              {activity.length === 0 ? (
                <p className="subtle-panel text-sm text-slate-400">No recent activity.</p>
              ) : (
                activity.map((item, index) => (
                  <div key={`${item.type}-${item.createdAt}-${index}`} className="relative pl-6">
                    <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-accent" />
                    {index < activity.length - 1 ? <span className="absolute left-[4px] top-5 h-[calc(100%+0.5rem)] w-px bg-line" /> : null}
                    <div className="subtle-panel text-sm">
                      <p className="text-slate-200">{formatActivity(item)}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-danger-soft">{error}</p> : null}
      </section>
    </Shell>
  );
}

function formatActivity(item: ActivityItem) {
  if (item.type === "FOLLOW") return `${item.user || "Someone"} followed this profile`;
  if (item.type === "POST_CREATED") return "Created a new post";
  if (item.type === "SNIPPET_CREATED") return `Created snippet${item.snippetTitle ? `: ${item.snippetTitle}` : ""}`;
  if (item.type === "LIKE") return `${item.user || "Someone"} liked a post`;
  return "New activity";
}

function getInteractionState(
  profilePosts: ProfilePost[],
  savedPosts: SavedPostEntry[],
  targetId: string,
  action: PostActionType,
) {
  const subject =
    profilePosts
      .map((post) => (post.id === targetId ? post : post.originalPost?.id === targetId ? post.originalPost : null))
      .find(Boolean) ||
    savedPosts
      .map((entry) =>
        entry.post.id === targetId ? entry.post : entry.post.originalPost?.id === targetId ? entry.post.originalPost : null,
      )
      .find(Boolean);

  if (!subject) {
    return false;
  }

  if (action === "like") return subject.viewer.liked;
  if (action === "bookmark") return subject.viewer.bookmarked;
  return subject.viewer.reposted;
}
