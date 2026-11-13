import type { MovieFactDto } from "@/lib/contracts";
import { FACT_CACHE_TTL_MS } from "@/lib/cache-policy";

type FactCacheEntry = {
  fact: MovieFactDto;
  cachedAt: number;
};

const inFlightFactLoads = new Map<string, Promise<MovieFactDto>>();

function storageKey(userId: string, movieTitle: string) {
  return `movie-memory:fact:${userId}:${movieTitle.trim().toLowerCase()}`;
}

function browserStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function readFactCache(
  userId: string,
  movieTitle: string,
  now = Date.now(),
) {
  const storage = browserStorage();
  if (!storage) return null;

  const key = storageKey(userId, movieTitle);
  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    const entry = JSON.parse(raw) as FactCacheEntry;
    if (now - entry.cachedAt >= FACT_CACHE_TTL_MS) {
      storage.removeItem(key);
      return null;
    }
    return entry.fact;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function writeFactCache(
  userId: string,
  movieTitle: string,
  fact: MovieFactDto,
  cachedAt = Date.now(),
) {
  browserStorage()?.setItem(
    storageKey(userId, movieTitle),
    JSON.stringify({ fact, cachedAt } satisfies FactCacheEntry),
  );
}

export function clearFactCache(userId: string, movieTitle: string) {
  browserStorage()?.removeItem(storageKey(userId, movieTitle));
}

export function loadFactOnce(
  userId: string,
  movieTitle: string,
  loader: () => Promise<MovieFactDto>,
) {
  const key = storageKey(userId, movieTitle);
  const existing = inFlightFactLoads.get(key);
  if (existing) return existing;

  const request = loader().finally(() => {
    inFlightFactLoads.delete(key);
  });
  inFlightFactLoads.set(key, request);
  return request;
}
