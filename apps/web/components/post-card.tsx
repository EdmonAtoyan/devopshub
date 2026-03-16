import { ReactNode, SVGProps } from "react";
import { AutoLinkedText } from "./auto-linked-text";
import { GifAttachment } from "./gif-attachment";
import { BookmarkIcon, EyeIcon, HeartIcon, MessageCircleIcon, RepeatIcon } from "./icons";
import { UsernameInline } from "./verified-badge";
import type { GifAttachment as GifAttachmentValue } from "@/lib/gifs";

export type PostCardAuthor = {
  id?: string;
  username: string;
  verified?: boolean;
  name?: string;
};

export type PostCardTag = {
  name: string;
};

export type PostCardCounts = {
  likes?: number;
  comments?: number;
  bookmarks?: number;
  reposts?: number;
};

export type PostCardViewerState = {
  liked?: boolean;
  bookmarked?: boolean;
  reposted?: boolean;
};

export type PostCardData = {
  id: string;
  body: string;
  gif?: GifAttachmentValue | null;
  createdAt: string;
  author: PostCardAuthor;
  tags?: PostCardTag[];
  counts?: PostCardCounts;
  viewCount?: number;
  viewer?: PostCardViewerState;
};

type PostContext = {
  label: string;
  username: string;
  verified?: boolean;
  createdAt?: string;
};

type PostCardProps = {
  post: PostCardData;
  className?: string;
  variant?: "default" | "compact";
  showVerifiedBadge?: boolean;
  context?: PostContext;
  metaNote?: ReactNode;
  headerAction?: ReactNode;
  body?: string;
  bodyClassName?: string;
  expanded?: boolean;
  showToggle?: boolean;
  onToggleExpand?: () => void;
  onLike?: () => void;
  onBookmark?: () => void;
  onRepost?: () => void;
  disabledActions?: {
    like?: boolean;
    bookmark?: boolean;
    repost?: boolean;
  };
  showTags?: boolean;
  showActions?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
  showGifs?: boolean;
};

export function PostCard({
  post,
  className,
  variant = "default",
  showVerifiedBadge,
  context,
  metaNote,
  headerAction,
  body,
  bodyClassName,
  expanded = false,
  showToggle = false,
  onToggleExpand,
  onLike,
  onBookmark,
  onRepost,
  disabledActions,
  showTags,
  showActions,
  footer,
  children,
  showGifs = true,
}: PostCardProps) {
  const tags = post.tags || [];
  const counts = post.counts || {};
  const shouldShowVerifiedBadge = showVerifiedBadge ?? variant === "default";
  const shouldShowTags = showTags ?? (variant === "default" && tags.length > 0);
  const shouldShowActions =
    showActions ??
    (variant === "default" &&
      (counts.likes !== undefined ||
        counts.bookmarks !== undefined ||
        counts.reposts !== undefined ||
        counts.comments !== undefined ||
        post.viewCount !== undefined));

  return (
    <article className={cx("post-card", className)}>
      <header className="post-header">
        <div className="post-meta">
          {context ? (
            <p className="post-context">
              <RepeatIcon size={13} />
              <span>
                {context.label} @{context.username}
              </span>
            </p>
          ) : null}

          <div className="post-author-row">
            <p className="post-author">
              <UsernameInline username={post.author.username} verified={post.author.verified} showBadge={shouldShowVerifiedBadge} />
            </p>
            <span className="post-timestamp">•</span>
            <p className="post-timestamp">{new Date(post.createdAt).toLocaleString()}</p>
          </div>

          {metaNote ? <div className="post-timestamp">{metaNote}</div> : context?.createdAt ? <p className="post-timestamp">Shared {new Date(context.createdAt).toLocaleString()}</p> : null}
        </div>

        {headerAction}
      </header>

      <div className="min-w-0 max-w-full">
        <p
          className={cx(
            "content-wrap whitespace-pre-wrap",
            variant === "compact" ? "text-sm leading-6 text-slate-200" : "post-content min-h-[1.5rem]",
            bodyClassName,
          )}
        >
          <AutoLinkedText text={body ?? post.body} />
        </p>

        {post.gif ? (
          <GifAttachment
            gif={post.gif}
            showByDefault={showGifs}
            compact={variant === "compact"}
            className="mt-3"
          />
        ) : null}

        {showToggle && onToggleExpand ? (
          <button type="button" className="post-toggle mt-3" onClick={onToggleExpand}>
            {expanded ? "↑ Show less" : "↓ Show more"}
          </button>
        ) : null}
      </div>

      {shouldShowTags ? (
        <div className="post-tags">
          {tags.map((tag) => (
            <span key={tag.name} className="post-tag">
              #{tag.name}
            </span>
          ))}
        </div>
      ) : null}

      {shouldShowActions ? (
        <div className="post-actions">
          <PostAction
            icon={HeartIcon}
            action="like"
            label="Like"
            value={counts.likes}
            active={!!post.viewer?.liked}
            onClick={onLike}
            disabled={!!disabledActions?.like}
          />
          <PostAction
            icon={BookmarkIcon}
            action="bookmark"
            label="Save"
            value={counts.bookmarks}
            active={!!post.viewer?.bookmarked}
            onClick={onBookmark}
            disabled={!!disabledActions?.bookmark}
          />
          <PostAction
            icon={RepeatIcon}
            action="repost"
            label="Repost"
            value={counts.reposts}
            active={!!post.viewer?.reposted}
            onClick={onRepost}
            disabled={!!disabledActions?.repost}
          />
          <PostAction icon={MessageCircleIcon} label="Comments" value={counts.comments} />
          <PostAction icon={EyeIcon} label="Views" value={post.viewCount} />
        </div>
      ) : null}

      {footer}
      {children}
    </article>
  );
}

type PostActionProps = {
  icon: (props: SVGProps<SVGSVGElement> & { size?: number }) => ReactNode;
  action?: "like" | "bookmark" | "repost";
  label: string;
  value?: number;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

function PostAction({ icon: Icon, action, label, value, active = false, onClick, disabled = false }: PostActionProps) {
  if (value === undefined && !onClick) {
    return null;
  }

  const className = cx(
    onClick ? "post-action-button" : "post-stat",
    active && "is-active",
    action === "like" && active && "is-liked",
    action === "bookmark" && active && "is-saved",
    action === "repost" && active && "is-reposted",
  );
  const shouldFillIcon = active && (action === "like" || action === "bookmark");
  const iconProps = shouldFillIcon
    ? { size: 14, fill: "currentColor", stroke: "currentColor", strokeWidth: 1.75 }
    : { size: 14 };

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={`${label} post. ${value ?? 0} ${label.toLowerCase()}`}
        aria-pressed={active}
        disabled={disabled}
        title={label}
      >
        <Icon {...iconProps} />
        {value !== undefined ? <span>{value}</span> : null}
      </button>
    );
  }

  return (
    <span className={className} title={label}>
      <Icon {...iconProps} />
      {value !== undefined ? <span>{value}</span> : null}
    </span>
  );
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
