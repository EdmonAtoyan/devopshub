type VerifiedBadgeProps = {
  className?: string;
};

type UsernameInlineProps = {
  username: string;
  verified?: boolean;
  className?: string;
  showAt?: boolean;
  showBadge?: boolean;
};

export function VerifiedBadge({ className }: VerifiedBadgeProps) {
  return (
    <span className={cx("verified-badge", className)} title="Verified" aria-label="Verified">
      <svg
        viewBox="0 0 16 16"
        fill="none"
        className="verified-badge-icon"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path className="verified-badge-check" d="M3.15 8.2 6.45 11.35 12.85 4.95" pathLength="1" />
        <circle className="verified-badge-head" cx="8" cy="5.15" r="2.05" />
        <path className="verified-badge-body" d="M4.45 12.45c.75-1.8 2-2.7 3.55-2.7 1.6 0 2.85.9 3.55 2.7" />
      </svg>
    </span>
  );
}

export function UsernameInline({
  username,
  verified = false,
  className,
  showAt = true,
  showBadge = true,
}: UsernameInlineProps) {
  return (
    <span className={cx("verified-username", className)}>
      <span className="verified-username-label">
        {showAt ? "@" : ""}
        {username}
      </span>
      {verified && showBadge ? <VerifiedBadge /> : null}
    </span>
  );
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
