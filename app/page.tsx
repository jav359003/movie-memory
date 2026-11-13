import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function Home() {
  await connection();
  const session = await auth();

  if (session?.user.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { favoriteMovie: true },
    });
    redirect(user?.favoriteMovie ? "/dashboard" : "/onboarding");
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent"
      />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-7 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3" aria-label="Movie Memory">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--panel)] text-sm font-semibold text-white"
            >
              M
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-light)]">
              Movie Memory
            </span>
          </div>
          <span className="hidden text-sm text-[var(--muted)] sm:block">
            Your favorite, remembered.
          </span>
        </header>

        <div className="grid min-w-0 flex-1 items-center gap-16 py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.8fr)] lg:gap-24 lg:py-20">
          <section className="min-w-0 max-w-3xl">
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-balance sm:text-7xl lg:text-[5.5rem]">
              One movie. A new reason to remember it.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted-light)]">
              Save the film that stays with you. Movie Memory returns a concise,
              AI-generated fact and keeps your recent discoveries close.
            </p>
            <form
              className="mt-10"
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <button className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-6 font-semibold text-[#06140c] transition hover:bg-[var(--accent-strong)] focus-visible:outline-none active:translate-y-px">
                Continue with Google
              </button>
            </form>
            <p className="mt-4 text-sm text-[var(--muted)]">
              Secure Google sign-in. No separate password to manage.
            </p>
          </section>

          <aside
            aria-label="How Movie Memory works"
            className="relative mx-auto min-w-0 w-full max-w-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.28)] sm:max-w-lg sm:p-8 lg:mx-0"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-[var(--muted)]">
                  Current favorite
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-[-0.03em]">
                  Arrival
                </p>
              </div>
              <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                Saved
              </span>
            </div>

            <div className="my-7 h-px bg-[var(--border)]" />

            <div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-[var(--fact-accent)]">
                  A fact to remember
                </p>
                <p className="text-xs text-[var(--muted)]">Just generated</p>
              </div>
              <p className="mt-4 text-xl leading-8 text-white">
                A concise discovery about your saved movie appears here, ready
                for your next visit.
              </p>
            </div>

            <ol className="mt-9 grid gap-4 border-t border-[var(--border)] pt-6 text-sm sm:grid-cols-3 sm:gap-5">
              <li>
                <span className="block font-semibold text-white">Sign in</span>
                <span className="mt-1 block leading-5 text-[var(--muted)]">
                  With Google
                </span>
              </li>
              <li>
                <span className="block font-semibold text-white">Save</span>
                <span className="mt-1 block leading-5 text-[var(--muted)]">
                  One favorite
                </span>
              </li>
              <li>
                <span className="block font-semibold text-white">Discover</span>
                <span className="mt-1 block leading-5 text-[var(--muted)]">
                  A new fact
                </span>
              </li>
            </ol>
          </aside>
        </div>

      </div>
    </main>
  );
}
