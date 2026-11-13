import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { OnboardingForm } from "@/components/onboarding-form";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function OnboardingPage() {
  await connection();
  const session = await auth();
  if (!session?.user.id) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { favoriteMovie: true },
  });

  if (user?.favoriteMovie) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6 py-16">
      <section className="w-full">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          First, make it yours
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          What movie stays with you?
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          You can change this later from the dashboard.
        </p>
        <OnboardingForm />
      </section>
    </main>
  );
}
