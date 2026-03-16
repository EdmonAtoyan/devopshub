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
      <span
        aria-hidden="true"
        className="flex h-5 w-5 items-center justify-center rounded-full bg-white"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" role="presentation">
          <path
            fill="#EA4335"
            d="M12.24 10.285v3.821h5.445c-.24 1.541-1.8 4.52-5.445 4.52-3.275 0-5.94-2.713-5.94-6.055s2.665-6.055 5.94-6.055c1.864 0 3.109.795 3.821 1.484l2.603-2.509C16.994 3.94 14.848 3 12.24 3 7.544 3 3.75 6.794 3.75 11.49s3.794 8.49 8.49 8.49c4.898 0 8.146-3.44 8.146-8.287 0-.558-.06-.984-.134-1.408H12.24Z"
          />
          <path
            fill="#34A853"
            d="M3.75 7.01 6.86 9.29c.84-1.66 2.57-2.774 5.38-2.774 1.864 0 3.109.795 3.821 1.484l2.603-2.509C16.994 3.94 14.848 3 12.24 3 8.98 3 6.16 4.87 4.77 7.59l-1.02-.58Z"
          />
          <path
            fill="#FBBC05"
            d="M12.24 19.98c2.538 0 4.667-.834 6.223-2.266l-2.875-2.357c-.77.54-1.8.919-3.348.919-3.63 0-5.365-2.458-6.24-3.49l-3.088 2.38C4.286 17.938 7.992 19.98 12.24 19.98Z"
          />
          <path
            fill="#4285F4"
            d="M20.386 11.693c0-.558-.06-.984-.134-1.408H12.24v3.821h5.445c-.117.753-.55 1.861-1.495 2.61l2.875 2.357c1.725-1.59 2.721-3.93 2.721-7.38Z"
          />
        </svg>
      </span>
      <span>{label}</span>
    </a>
  );
}
