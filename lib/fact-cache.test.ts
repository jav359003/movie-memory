import { describe, expect, it, vi } from "vitest";

import { FACT_CACHE_TTL_MS } from "@/lib/cache-policy";
import {
  loadFactOnce,
  readFactCache,
  writeFactCache,
} from "@/lib/fact-cache";

const fact = {
  id: "fact-1",
  movieTitle: "Arrival",
  content: "A fact.",
  createdAt: "2026-11-12T12:00:00.000Z",
};

describe("fact cache", () => {
  it("coalesces simultaneous client loads for the same user and movie", async () => {
    const loader = vi.fn().mockResolvedValue(fact);

    const [first, second] = await Promise.all([
      loadFactOnce("user-1", "Arrival", loader),
      loadFactOnce("user-1", "arrival", loader),
    ]);

    expect(first).toEqual(fact);
    expect(second).toEqual(fact);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("expires a stored fact after 30 seconds", () => {
    const now = Date.now();
    writeFactCache("user-1", "Arrival", fact, now);

    expect(readFactCache("user-1", "Arrival", now + FACT_CACHE_TTL_MS - 1)).toEqual(
      fact,
    );
    expect(readFactCache("user-1", "Arrival", now + FACT_CACHE_TTL_MS)).toBeNull();
  });
});
