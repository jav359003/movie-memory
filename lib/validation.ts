import { z } from "zod";

export const updateMovieSchema = z.object({
  favoriteMovie: z
    .string()
    .trim()
    .min(1, "Enter a movie title.")
    .max(120, "Keep the title under 120 characters."),
});
