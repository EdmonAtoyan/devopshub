"use client";

import { Shell } from "@/components/shell";
import { apiRequest, assetUrl } from "@/lib/api";
import { connectRealtime } from "@/lib/realtime";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  username: string;
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

type Me = { id: string; username: string } | null;
type ProfileTab = "posts" | "snippets" | "activity";
type ActivityItem = {
  type: "FOLLOW" | "POST_CREATED" | "SNIPPET_CREATED" | "LIKE";
  user?: string;
  postId?: string;
  snippetId?: string;
  snippetTitle?: string;
  createdAt: string;
};

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params?.username ?? "";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [me, setMe] = useState<Me>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const loadMe = async () => {
    try {
      const data = await apiRequest<Me>("auth/me");
      setMe(data);
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
    void load();
    void loadMe();
  }, [username]);

  useEffect(() => {
    if (!profile?.id) return;
    let mounted = true;
    let socket: {
      on: (event: string, cb: (...args: any[]) => void) => void;
      off: (event: string, cb?: (...args: any[]) => void) => void;
      disconnect: () => void;
    } | null = null;

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

  const follow = async () => {
    if (!profile) return;
    try {
      await apiRequest(`users/${profile.id}/follow`, { method: "POST" });
      await load();
    } catch {
      setError("Login is required to follow users.");
    }
  };

  if (!profile) {
    return (
      <Shell>
        <section className="card p-4 text-base text-danger-soft">{error || "Loading..."}</section>
      </Shell>
    );
  }

  const isMe = me?.username === profile.username;

  return (
    <Shell>
      <section className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-xl border border-line bg-bg">
              {profile.avatarUrl ? (
                <img src={assetUrl(profile.avatarUrl)} alt={profile.username} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">No photo</div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-semibold">@{profile.username}</h2>
              <p className="mt-1 text-base text-slate-400">{profile.bio || "DevOps engineer"}</p>
            </div>
          </div>

          {isMe ? (
            <Link href="/settings" className="rounded-lg border border-line px-3 py-2 text-sm text-slate-200">
              Edit Profile
            </Link>
          ) : (
            <button className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void follow()}>
              Follow
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg border border-line p-2">
            <p className="text-lg font-semibold text-slate-100">{profile.stats.posts}</p>
            <p className="text-slate-400">Posts</p>
          </div>
          <div className="rounded-lg border border-line p-2">
            <p className="text-lg font-semibold text-slate-100">{profile.stats.followers}</p>
            <p className="text-slate-400">Followers</p>
          </div>
          <div className="rounded-lg border border-line p-2">
            <p className="text-lg font-semibold text-slate-100">{profile.stats.following}</p>
            <p className="text-slate-400">Following</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-sm text-accent">
          {profile.specialties.map((skill) => (
            <span key={skill} className="rounded-lg border border-line px-2 py-1">
              {skill}
            </span>
          ))}
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <button
              type="button"
              className={`rounded-lg border px-3 py-1.5 ${tab === "posts" ? "border-accent text-accent" : "border-line text-slate-300"}`}
              onClick={() => setTab("posts")}
            >
              Posts
            </button>
            <button
              type="button"
              className={`rounded-lg border px-3 py-1.5 ${tab === "snippets" ? "border-accent text-accent" : "border-line text-slate-300"}`}
              onClick={() => setTab("snippets")}
            >
              Snippets
            </button>
            <button
              type="button"
              className={`rounded-lg border px-3 py-1.5 ${tab === "activity" ? "border-accent text-accent" : "border-line text-slate-300"}`}
              onClick={() => setTab("activity")}
            >
              Activity
            </button>
          </div>

          {tab === "posts" ? (
            <div className="rounded-lg border border-line p-3 text-sm text-slate-300">
              Posts published: <span className="font-semibold text-slate-100">{profile.stats.posts}</span>
            </div>
          ) : null}

          {tab === "snippets" ? (
            <div className="rounded-lg border border-line p-3 text-sm text-slate-300">
              Snippets shared: <span className="font-semibold text-slate-100">{profile.stats.snippets}</span>
            </div>
          ) : null}

          {tab === "activity" ? (
            <div className="space-y-3">
              {activity.length === 0 ? (
                <p className="rounded-lg border border-line p-3 text-sm text-slate-400">No recent activity.</p>
              ) : (
                activity.map((item, index) => (
                  <div key={`${item.type}-${item.createdAt}-${index}`} className="relative pl-6">
                    <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-accent" />
                    {index < activity.length - 1 ? <span className="absolute left-[4px] top-5 h-[calc(100%+0.5rem)] w-px bg-line" /> : null}
                    <div className="rounded-lg border border-line p-3 text-sm">
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
