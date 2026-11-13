import { afterEach, describe, expect, it, vi } from "vitest";

import { getMe, getMovieFact } from "@/lib/api";

describe("typed API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes a 401 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(getMe()).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Sign in to continue.",
    });
  });

  it("normalizes a 500 response even when the server body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("broken", { status: 500 })),
    );

    await expect(getMovieFact()).rejects.toMatchObject({
      status: 500,
      code: "UNKNOWN_ERROR",
      message: "The request failed.",
    });
  });

  it("marks an explicit fact refresh in the request URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          fact: {
            id: "fact-1",
            movieTitle: "Arrival",
            content: "A fact.",
            createdAt: "2026-11-12T12:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getMovieFact({ refresh: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/fact?refresh=1",
      expect.any(Object),
    );
  });
});
