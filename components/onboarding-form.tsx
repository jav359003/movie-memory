"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, updateFavoriteMovie } from "@/lib/api";

export function OnboardingForm() {
  const router = useRouter();
  const [movie, setMovie] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await updateFavoriteMovie({ favoriteMovie: movie });
      router.push("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not save the movie.",
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium">Favorite movie</span>
        <input
          autoFocus
          required
          maxLength={120}
          value={movie}
          onChange={(event) => setMovie(event.target.value)}
          placeholder="e.g. Arrival"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-3 outline-none transition focus:border-[var(--accent)]"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <button
        disabled={saving}
        className="rounded-md bg-[var(--accent)] px-5 py-3 font-semibold text-[#07110b] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}
