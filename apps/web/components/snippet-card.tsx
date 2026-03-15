import { ButtonHTMLAttributes, Fragment, ReactNode } from "react";
import { AutoLinkedText } from "./auto-linked-text";

export type SnippetCardData = {
  title: string;
  description?: string;
  language: string;
  version?: number;
  createdAt?: string;
  author: { username: string; verified?: boolean; name?: string };
};

type SnippetCardProps = {
  snippet: SnippetCardData;
  className?: string;
  compact?: boolean;
  codeSection?: ReactNode;
  actionBar?: ReactNode;
};

type SnippetCodePanelProps = {
  className?: string;
  children: ReactNode;
};

type SnippetLanguageBadgeProps = {
  language: string;
  className?: string;
};

type SnippetActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "positive" | "danger";
};

export function SnippetCard({
  snippet,
  className,
  compact = false,
  codeSection,
  actionBar,
}: SnippetCardProps) {
  const metadata: ReactNode[] = [
    `@${snippet.author.username}`,
    ...(snippet.version !== undefined ? [<span key="version">v{snippet.version}</span>] : []),
    ...(snippet.createdAt ? [<span key="createdAt">{new Date(snippet.createdAt).toLocaleDateString()}</span>] : []),
  ];

  return (
    <article className={cx("snippet-card", compact && "is-compact", className)}>
      <header className="snippet-header-row">
        <div className="min-w-0 space-y-2">
          <h3 className={cx("snippet-title", compact && "is-compact")}>{snippet.title}</h3>
          {snippet.description?.trim() ? (
            <p className={cx("snippet-description", compact && "is-compact")}>
              <AutoLinkedText text={snippet.description.trim()} />
            </p>
          ) : null}

          {metadata.length > 0 ? (
            <div className="snippet-byline">
              {metadata.map((entry, index) => (
                <Fragment key={`${entry}-${index}`}>
                  {index > 0 ? <span className="snippet-byline-separator">•</span> : null}
                  <span>{entry}</span>
                </Fragment>
              ))}
            </div>
          ) : null}
        </div>

        {!codeSection ? <SnippetLanguageBadge language={snippet.language} /> : null}
      </header>

      {codeSection ? (
        <section className="snippet-code-region">
          <div className="snippet-code-header">
            <p className="snippet-code-label">Code snippet</p>
            <SnippetLanguageBadge language={snippet.language} />
          </div>
          {codeSection}
        </section>
      ) : null}

      {actionBar ? <div className="snippet-action-row">{actionBar}</div> : null}
    </article>
  );
}

export function SnippetCodePanel({ className, children }: SnippetCodePanelProps) {
  return (
    <pre className={cx("snippet-code-panel", className)}>
      <code>{children}</code>
    </pre>
  );
}

export function SnippetLanguageBadge({ language, className }: SnippetLanguageBadgeProps) {
  return <span className={cx("snippet-language-badge", className)}>{language.trim() || "text"}</span>;
}

export function SnippetActionButton({
  className,
  tone = "default",
  type,
  ...props
}: SnippetActionButtonProps) {
  return <button type={type ?? "button"} className={cx("snippet-action-button", tone !== "default" && `is-${tone}`, className)} {...props} />;
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
