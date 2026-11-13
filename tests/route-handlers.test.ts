import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUser: vi.fn(),
  updateUser: vi.fn(),
  findFact: vi.fn(),
  createFact: vi.fn(),
  generateFact: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUser,
      update: mocks.updateUser,
    },
    movieFact: {
      findFirst: mocks.findFact,
      create: mocks.createFact,
    },
  },
}));
vi.mock("@/lib/openai", () => ({
  generateMovieFact: mocks.generateFact,
}));

import { GET as getFact } from "@/app/api/fact/route";
import { GET as getMe } from "@/app/api/me/route";
import { PUT as putMovie } from "@/app/api/me/movie/route";

const session = { user: { id: "user-1" } };
const persistedFact = {
  id: "fact-1",
  movieTitle: "Arrival",
  content: "A generated fact.",
  createdAt: new Date("2026-11-12T12:00:00.000Z"),
};

describe("route-handler security and failures", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue(session);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("rejects an unauthenticated profile request before touching the database", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await getMe();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
    });
    expect(mocks.findUser).not.toHaveBeenCalled();
  });

  it("rejects an invalid movie without writing to the database", async () => {
    const response = await putMovie(
      new Request("http://localhost/api/me/movie", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favoriteMovie: "   " }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_MOVIE" },
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("returns a normalized 502 response when OpenAI fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findUser.mockResolvedValue({ favoriteMovie: "Arrival" });
    mocks.findFact.mockResolvedValue(null);
    mocks.generateFact.mockRejectedValue(new Error("OpenAI unavailable"));

    const response = await getFact(new Request("http://localhost/api/fact"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: "FACT_GENERATION_FAILED",
        message: "We could not generate a fact right now. Please try again.",
      },
    });
    expect(mocks.createFact).not.toHaveBeenCalled();
  });
});

describe("fact generation deduplication", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue(session);
    mocks.findUser.mockResolvedValue({ favoriteMovie: "Arrival" });
    mocks.findFact.mockResolvedValue(null);
    mocks.generateFact.mockResolvedValue("A generated fact.");
    mocks.createFact.mockResolvedValue(persistedFact);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("coalesces simultaneous normal requests into one OpenAI call", async () => {
    const [first, second] = await Promise.all([
      getFact(new Request("http://localhost/api/fact")),
      getFact(new Request("http://localhost/api/fact")),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toEqual(await second.json());
    expect(mocks.findFact).toHaveBeenCalledTimes(1);
    expect(mocks.generateFact).toHaveBeenCalledTimes(1);
    expect(mocks.createFact).toHaveBeenCalledTimes(1);
  });

  it("allows an explicit refresh to bypass the recent-fact cache", async () => {
    const response = await getFact(
      new Request("http://localhost/api/fact?refresh=1"),
    );

    expect(response.status).toBe(200);
    expect(mocks.findFact).not.toHaveBeenCalled();
    expect(mocks.generateFact).toHaveBeenCalledTimes(1);
    expect(mocks.createFact).toHaveBeenCalledTimes(1);
  });
});
