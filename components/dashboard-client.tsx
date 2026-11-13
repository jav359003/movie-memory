"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  PencilLine,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { ApiError, getMovieFact, updateFavoriteMovie } from "@/lib/api";
import type { MovieFactDto } from "@/lib/contracts";
import {
  clearFactCache,
  loadFactOnce,
  readFactCache,
  writeFactCache,
} from "@/lib/fact-cache";

type DashboardClientProps = {
  userId: string;
  initialMovie: string;
  initialFacts: MovieFactDto[];
};

export function DashboardClient({
  userId,
  initialMovie,
  initialFacts,
}: DashboardClientProps) {
  const [movie, setMovie] = useState(initialMovie);
  const [draft, setDraft] = useState(initialMovie);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fact, setFact] = useState<MovieFactDto | null>(null);
  const [facts, setFacts] = useState(initialFacts);
  const [factLoading, setFactLoading] = useState(true);
  const [factError, setFactError] = useState<string | null>(null);
  const [movieError, setMovieError] = useState<string | null>(null);
  const activeMovieRef = useRef(initialMovie);

  useEffect(() => {
    let active = true;
    const cached = readFactCache(userId, initialMovie);

    if (cached) {
      queueMicrotask(() => {
        if (!active) return;
        setFact(cached);
        setFactLoading(false);
      });
    } else {
      loadFactOnce(
        userId,
        initialMovie,
        async () => (await getMovieFact()).fact,
      )
        .then((nextFact) => {
          if (!active || activeMovieRef.current !== initialMovie) return;
          writeFactCache(userId, initialMovie, nextFact);
          setFact(nextFact);
          setFacts((current) => [
            nextFact,
            ...current.filter((item) => item.id !== nextFact.id),
          ]);
        })
        .catch((caught) => {
          if (!active || activeMovieRef.current !== initialMovie) return;
          setFactError(
            caught instanceof ApiError
              ? caught.message
              : "Could not load a movie fact.",
          );
        })
        .finally(() => {
          if (active && activeMovieRef.current === initialMovie) {
            setFactLoading(false);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [initialMovie, userId]);

  async function loadFreshFact(forMovie = movie) {
    const previousFact = fact;
    setFactError(null);
    setFactLoading(true);
    clearFactCache(userId, forMovie);

    try {
      const { fact: nextFact } = await getMovieFact({ refresh: true });
      writeFactCache(userId, forMovie, nextFact);
      if (activeMovieRef.current !== forMovie) return;
      setFact(nextFact);
      setFacts((current) => [
        nextFact,
        ...current.filter((item) => item.id !== nextFact.id),
      ]);
    } catch (caught) {
      if (activeMovieRef.current !== forMovie) return;
      if (previousFact) {
        writeFactCache(userId, forMovie, previousFact);
      }
      setFactError(
        caught instanceof ApiError
          ? caught.message
          : "Could not refresh the fact.",
      );
    } finally {
      if (activeMovieRef.current === forMovie) setFactLoading(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMovie = draft.trim();
    if (!nextMovie || nextMovie === movie) {
      setEditing(false);
      setDraft(movie);
      return;
    }

    const previousMovie = movie;
    const previousFact = fact;
    const previousFacts = facts;
    setMovieError(null);
    setFactError(null);
    setSaving(true);
    activeMovieRef.current = nextMovie;
    setMovie(nextMovie);
    setFact(null);
    setFacts([]);
    setEditing(false);
    clearFactCache(userId, previousMovie);
    clearFactCache(userId, nextMovie);

    try {
      const response = await updateFavoriteMovie({ favoriteMovie: nextMovie });
      const savedMovie = response.user.favoriteMovie ?? nextMovie;
      activeMovieRef.current = savedMovie;
      setMovie(savedMovie);
      setDraft(savedMovie);
      await loadFreshFact(savedMovie);
    } catch (caught) {
      setMovie(previousMovie);
      setDraft(previousMovie);
      setFact(previousFact);
      setFacts(previousFacts);
      setEditing(true);
      activeMovieRef.current = previousMovie;
      if (previousFact) {
        writeFactCache(userId, previousMovie, previousFact);
      }
      setMovieError(
        caught instanceof ApiError
          ? caught.message
          : "Could not save the movie. Your change was rolled back.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-12 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-14">
      <section className="min-w-0">
        {editing ? (
          <form onSubmit={handleSave} className="max-w-2xl" aria-busy={saving}>
            <label
              htmlFor="favorite-movie"
              className="block text-sm font-medium text-[var(--muted)]"
            >
              Favorite movie
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="favorite-movie"
                autoFocus
                required
                maxLength={120}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-describedby={movieError ? "movie-save-error" : undefined}
                className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-base text-white outline-none transition placeholder:text-[var(--muted)] hover:border-[var(--border-strong)] focus:border-[var(--accent)]"
              />
              <div className="flex gap-2">
                <button
                  disabled={saving}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--accent)] px-5 font-semibold text-[#06140c] transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-55 sm:flex-none"
                >
                  {saving ? "Saving…" : "Save movie"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setDraft(movie);
                    setEditing(false);
                    setMovieError(null);
                  }}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-[var(--border)] px-4 font-medium text-[var(--muted-light)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-white disabled:cursor-not-allowed disabled:opacity-55 sm:flex-none"
                >
                  Cancel
                </button>
              </div>
            </div>
            {movieError ? (
              <p
                id="movie-save-error"
                role="alert"
                className="mt-3 flex items-start gap-2 text-sm leading-6 text-[var(--danger)]"
              >
                <AlertCircle aria-hidden="true" className="mt-1 size-4 shrink-0" />
                <span>{movieError} Your previous movie and fact were restored.</span>
              </p>
            ) : null}
          </form>
        ) : (
          <div>
            <p className="text-sm font-medium text-[var(--muted)]">Favorite movie</p>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
              <h1 className="max-w-full [overflow-wrap:anywhere] text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-6xl">
                {movie}
              </h1>
              <button
                onClick={() => {
                  setMovieError(null);
                  setEditing(true);
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 text-sm font-medium text-[var(--muted-light)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-white"
              >
                <PencilLine aria-hidden="true" className="size-4" />
                Edit
              </button>
              {saving ? (
                <span role="status" className="text-sm text-[var(--muted)]">
                  Saving change…
                </span>
              ) : null}
            </div>
          </div>
        )}

        <div className="mt-10 overflow-hidden rounded-2xl bg-[var(--panel)] shadow-[0_14px_38px_rgba(0,0,0,0.22)] sm:mt-12">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-7">
            <div className="flex items-center gap-2.5">
              <Sparkles aria-hidden="true" className="size-4 text-[var(--fact-accent)]" />
              <h2 className="font-semibold">Today’s fact</h2>
              {factLoading && fact ? (
                <span role="status" className="text-xs text-[var(--muted)]">
                  Refreshing…
                </span>
              ) : null}
            </div>
            <button
              onClick={() => void loadFreshFact()}
              disabled={factLoading || saving}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[#06140c] transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-4 ${factLoading ? "animate-spin motion-reduce:animate-none" : ""}`}
              />
              {fact ? "Generate another" : "Generate fact"}
            </button>
          </div>
          <div className="min-h-48 px-5 py-6 sm:px-7 sm:py-8">
            {fact ? (
              <blockquote
                className={`max-w-[68ch] text-lg leading-8 text-[var(--foreground)] transition-opacity sm:text-xl sm:leading-9 ${factLoading ? "opacity-55" : "opacity-100"}`}
              >
                {fact.content}
              </blockquote>
            ) : factLoading ? (
              <div role="status" aria-label="Finding a movie fact" className="space-y-3 py-1">
                <div className="h-4 w-full max-w-xl animate-pulse rounded bg-[var(--skeleton)] motion-reduce:animate-none" />
                <div className="h-4 w-[92%] max-w-2xl animate-pulse rounded bg-[var(--skeleton)] motion-reduce:animate-none" />
                <div className="h-4 w-[68%] max-w-lg animate-pulse rounded bg-[var(--skeleton)] motion-reduce:animate-none" />
                <span className="sr-only">Finding something memorable…</span>
              </div>
            ) : factError ? (
              <div role="alert" className="max-w-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle aria-hidden="true" className="mt-1 size-5 shrink-0 text-[var(--danger)]" />
                  <div>
                    <p className="font-medium text-white">We couldn’t load a fact.</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted-light)]">
                      {factError} Check your connection, then try again.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => void loadFreshFact()}
                  className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-strong)] px-4 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
                >
                  <RefreshCw aria-hidden="true" className="size-4" />
                  Try again
                </button>
              </div>
            ) : (
              <div className="max-w-lg">
                <p className="font-medium text-white">No fact yet</p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted-light)]">
                  Generate one to start a fact history for {movie}.
                </p>
              </div>
            )}
            {fact && factError ? (
              <div role="alert" className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border)] pt-4 text-sm text-[var(--danger)]">
                <span>{factError} The previous fact is still here.</span>
                <button
                  onClick={() => void loadFreshFact()}
                  className="font-semibold text-white underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-white"
                >
                  Try again
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <aside className="min-w-0 border-t border-[var(--border)] pt-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">Recent facts</h2>
          {facts.length ? (
            <span className="text-xs tabular-nums text-[var(--muted)]">
              {Math.min(facts.length, 3)} shown
            </span>
          ) : null}
        </div>
        {facts.length ? (
          <ol className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {facts.slice(0, 3).map((item) => (
              <li key={item.id} className="py-5 first:pt-4">
                <time
                  dateTime={item.createdAt}
                  className="block text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]"
                >
                  {formatFactDate(item.createdAt)}
                </time>
                <p className="mt-2 [overflow-wrap:anywhere] text-sm leading-6 text-[var(--muted-light)]">
                  {item.content}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">
            New facts about {movie} will collect here.
          </p>
        )}
      </aside>
    </div>
  );
}

function formatFactDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
