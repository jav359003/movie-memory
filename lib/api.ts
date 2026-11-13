import type {
  ApiErrorBody,
  FactResponse,
  MeResponse,
  UpdateMovieRequest,
  UpdateMovieResponse,
} from "@/lib/contracts";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly issues?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function requestJson<T extends object>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as
    | T
    | ApiErrorBody
    | null;

  if (!response.ok) {
    const error = body && "error" in body ? body.error : null;
    throw new ApiError(
      error?.message ?? "The request failed.",
      response.status,
      error?.code ?? "UNKNOWN_ERROR",
      error?.issues,
    );
  }

  return body as T;
}

export function getMe() {
  return requestJson<MeResponse>("/api/me");
}

export function updateFavoriteMovie(input: UpdateMovieRequest) {
  return requestJson<UpdateMovieResponse>("/api/me/movie", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function getMovieFact(options: { refresh?: boolean } = {}) {
  const url = options.refresh ? "/api/fact?refresh=1" : "/api/fact";
  return requestJson<FactResponse>(url);
}
