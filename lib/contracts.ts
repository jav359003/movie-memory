export type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  favoriteMovie: string | null;
};

export type MovieFactDto = {
  id: string;
  movieTitle: string;
  content: string;
  createdAt: string;
};

export type MeResponse = {
  user: UserProfile;
};

export type UpdateMovieRequest = {
  favoriteMovie: string;
};

export type UpdateMovieResponse = MeResponse;

export type FactResponse = {
  fact: MovieFactDto;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    issues?: Record<string, string[]>;
  };
};
