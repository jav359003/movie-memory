import { auth } from "@/auth";
import { FACT_CACHE_TTL_MS } from "@/lib/cache-policy";
import { apiError } from "@/lib/http";
import { generateMovieFact } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

type PersistedFact = {
  id: string;
  movieTitle: string;
  content: string;
  createdAt: Date;
};

const factSelect = {
  id: true,
  movieTitle: true,
  content: true,
  createdAt: true,
} as const;

// React development replay can start the same request twice before the first
// response reaches localStorage. Coalescing by user and movie prevents duplicate
// OpenAI calls in one server process; the database lookup covers later requests.
const inFlightFactRequests = new Map<string, Promise<PersistedFact>>();

function serializeFact(fact: PersistedFact) {
  return { ...fact, createdAt: fact.createdAt.toISOString() };
}

async function generateAndPersistFact(userId: string, movieTitle: string) {
  const content = await generateMovieFact(movieTitle);
  return prisma.movieFact.create({
    data: { userId, movieTitle, content },
    select: factSelect,
  });
}

async function getRecentOrGenerateFact(userId: string, movieTitle: string) {
  const recentFact = await prisma.movieFact.findFirst({
    where: {
      userId,
      movieTitle,
      createdAt: { gte: new Date(Date.now() - FACT_CACHE_TTL_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: factSelect,
  });

  return recentFact ?? generateAndPersistFact(userId, movieTitle);
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user.id) {
    return apiError(401, "UNAUTHORIZED", "Sign in to continue.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { favoriteMovie: true },
  });

  if (!user?.favoriteMovie) {
    return apiError(
      409,
      "MOVIE_REQUIRED",
      "Choose a favorite movie before generating a fact.",
    );
  }

  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  const key = `${session.user.id}:${user.favoriteMovie.trim().toLowerCase()}`;

  try {
    if (refresh) {
      const fact = await generateAndPersistFact(
        session.user.id,
        user.favoriteMovie,
      );
      return Response.json({ fact: serializeFact(fact) });
    }

    const existingRequest = inFlightFactRequests.get(key);
    if (existingRequest) {
      const fact = await existingRequest;
      return Response.json({ fact: serializeFact(fact) });
    }

    const factRequest = getRecentOrGenerateFact(
      session.user.id,
      user.favoriteMovie,
    );
    inFlightFactRequests.set(key, factRequest);

    try {
      const fact = await factRequest;
      return Response.json({ fact: serializeFact(fact) });
    } finally {
      inFlightFactRequests.delete(key);
    }
  } catch (error) {
    console.error("Movie fact generation failed", error);
    return apiError(
      502,
      "FACT_GENERATION_FAILED",
      "We could not generate a fact right now. Please try again.",
    );
  }
}
