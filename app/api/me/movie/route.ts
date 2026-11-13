import { auth } from "@/auth";
import { apiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateMovieSchema } from "@/lib/validation";

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user.id) {
    return apiError(401, "UNAUTHORIZED", "Sign in to continue.");
  }

  const json = await request.json().catch(() => null);
  const result = updateMovieSchema.safeParse(json);

  if (!result.success) {
    return apiError(
      400,
      "INVALID_MOVIE",
      "Check the movie title and try again.",
      result.error.flatten().fieldErrors,
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { favoriteMovie: result.data.favoriteMovie },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      favoriteMovie: true,
    },
  });

  return Response.json({ user });
}
