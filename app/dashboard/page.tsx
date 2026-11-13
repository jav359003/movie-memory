import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { DashboardClient } from "@/components/dashboard-client";
import { SignOutButton } from "@/components/sign-out-button";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function DashboardPage() {
  await connection();
  const session = await auth();
  if (!session?.user.id) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      favoriteMovie: true,
    },
  });

  if (!user?.favoriteMovie) redirect("/onboarding");

  const recentFacts = await prisma.movieFact.findMany({
    where: {
      userId: session.user.id,
      movieTitle: user.favoriteMovie,
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      movieTitle: true,
      content: true,
      createdAt: true,
    },
  });
  const facts = recentFacts.map((fact) => ({
    ...fact,
    createdAt: fact.createdAt.toISOString(),
  }));
  const profileName = user.name ?? user.email?.split("@")[0] ?? "Movie fan";
  const profileEmail = user.email ?? session.user.email;
  const profileInitials = profileName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header className="mb-12 flex items-center justify-between gap-4 border-b border-[var(--border)] pb-5 sm:mb-16">
        <Link href="/dashboard" className="shrink-0 font-semibold tracking-[-0.02em]">
          Movie <span className="text-[var(--accent)]">Memory</span>
        </Link>
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {user.image ? (
              <Image
                src={user.image}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-full object-cover ring-1 ring-[var(--border-strong)]"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--panel)] text-sm font-semibold text-[var(--muted-light)] ring-1 ring-[var(--border-strong)]"
              >
                {profileInitials}
              </span>
            )}
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-48 truncate text-sm font-medium text-white">
                {profileName}
              </p>
              {profileEmail ? (
                <p className="max-w-48 truncate text-xs text-[var(--muted)]">
                  {profileEmail}
                </p>
              ) : null}
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>
      <DashboardClient
        userId={session.user.id}
        initialMovie={user.favoriteMovie}
        initialFacts={facts}
      />
    </main>
  );
}
