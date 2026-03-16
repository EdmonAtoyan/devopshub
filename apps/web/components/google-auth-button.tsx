type GoogleAuthButtonProps = {
  className?: string;
  label?: string;
};

export function GoogleAuthButton({
  className = "",
  label = "Continue with Google",
}: GoogleAuthButtonProps) {
  return (
    <a
      href="/api/auth/google"
      className={`btn-secondary w-full justify-center gap-3 !border-white/70 !bg-white !text-slate-950 shadow-[0_24px_60px_-40px_rgba(255,255,255,0.9)] transition hover:!border-white hover:!bg-slate-100 ${className}`.trim()}
    >
      <img
        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
        alt=""
        aria-hidden="true"
        width="20"
        height="20"
        className="h-5 w-5 shrink-0"
      />
      <span>{label}</span>
    </a>
  );
}
