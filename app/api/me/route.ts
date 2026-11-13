import { auth } from "@/auth";
import { apiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user.id) {
    return apiError(401, "UNAUTHORIZED", "Sign in to continue.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      favoriteMovie: true,
    },
  });

  if (!user) {
    return apiError(404, "USER_NOT_FOUND", "Your account could not be found.");
  }

  return Response.json({ user });
}
