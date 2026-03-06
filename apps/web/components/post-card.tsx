export type PostCardProps = {
  author: string;
  body: string;
  tags: string[];
  likes: number;
  replies: number;
  time: string;
};

export function PostCard({ author, body, tags, likes, replies, time }: PostCardProps) {
  return (
    <article className="card p-4">
      <header className="flex items-center justify-between text-sm text-slate-400">
        <span className="font-medium text-slate-100">@{author}</span>
        <span>{time}</span>
      </header>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="rounded-md bg-slate-900 px-2 py-1 text-xs text-accent">
            #{tag}
          </span>
        ))}
      </div>
      <footer className="mt-4 flex gap-4 text-xs text-slate-400">
        <button className="transition hover:text-accent">Like {likes}</button>
        <button className="transition hover:text-accent">Reply {replies}</button>
        <button className="transition hover:text-accent">Bookmark</button>
      </footer>
    </article>
  );
}
