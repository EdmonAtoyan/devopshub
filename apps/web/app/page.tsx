import { AnimatedLogo } from "@/components/animated-logo";
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4">
      <section className="card w-full max-w-2xl p-8 text-center">
        <div className="flex justify-center">
          <AnimatedLogo className="logo-img h-20 w-auto max-w-full sm:h-24" />
        </div>
        <p className="mt-4 text-slate-400">Community for infrastructure engineers.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/feed" className="btn-positive-solid rounded-lg px-4 py-2 text-sm font-semibold">
            Open Feed
          </Link>
          <Link href="/login" className="rounded-lg border border-line px-4 py-2 text-sm text-slate-300">
            Sign In
          </Link>
        </div>
      </section>
    </main>
  );
}
