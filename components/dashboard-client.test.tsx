import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardClient } from "@/components/dashboard-client";
import { ApiError, getMovieFact, updateFavoriteMovie } from "@/lib/api";
import { readFactCache, writeFactCache } from "@/lib/fact-cache";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMovieFact: vi.fn(),
    updateFavoriteMovie: vi.fn(),
  };
});

const fact = {
  id: "fact-1",
  movieTitle: "Arrival",
  content: "A test fact about Arrival.",
  createdAt: "2026-11-12T00:00:00.000Z",
};

describe("dashboard movie editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(getMovieFact).mockResolvedValue({ fact });
    vi.mocked(updateFavoriteMovie).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Javin",
        email: "javin@example.com",
        image: null,
        favoriteMovie: "Arrival",
      },
    });
  });

  it("optimistically shows the new title and keeps it after a successful save", async () => {
    const user = userEvent.setup();
    let resolveUpdate!: (value: Awaited<ReturnType<typeof updateFavoriteMovie>>) => void;
    vi.mocked(updateFavoriteMovie).mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    render(
      <DashboardClient
        userId="user-1"
        initialMovie="Interstellar"
        initialFacts={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox", { name: "Favorite movie" });
    await user.clear(input);
    await user.type(input, "Arrival");
    await user.click(screen.getByRole("button", { name: "Save movie" }));

    expect(screen.getByRole("heading", { name: "Arrival" })).toBeTruthy();

    resolveUpdate({
      user: {
        id: "user-1",
        name: "Javin",
        email: "javin@example.com",
        image: null,
        favoriteMovie: "Arrival",
      },
    });

    await waitFor(() =>
      expect(updateFavoriteMovie).toHaveBeenCalledWith({
        favoriteMovie: "Arrival",
      }),
    );
    expect(screen.getByRole("heading", { name: "Arrival" })).toBeTruthy();
  });

  it("rolls the title back and restores edit mode when saving fails", async () => {
    const user = userEvent.setup();
    writeFactCache("user-1", "Interstellar", fact);
    vi.mocked(updateFavoriteMovie).mockRejectedValue(
      new ApiError("Could not save.", 500, "SAVE_FAILED"),
    );

    render(
      <DashboardClient
        userId="user-1"
        initialMovie="Interstellar"
        initialFacts={[fact]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox", { name: "Favorite movie" });
    await user.clear(input);
    await user.type(input, "Arrival");
    await user.click(screen.getByRole("button", { name: "Save movie" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("textbox", { name: "Favorite movie" })).toHaveProperty(
      "value",
      "Interstellar",
    );
    expect(screen.getAllByText("A test fact about Arrival.")).toHaveLength(2);
    expect(readFactCache("user-1", "Interstellar")).toEqual(fact);
    expect(screen.getByText(/previous movie and fact were restored/i)).toBeTruthy();
  });

  it("uses a fresh cached fact without making another API request", async () => {
    writeFactCache("user-1", "Arrival", fact);

    render(
      <DashboardClient
        userId="user-1"
        initialMovie="Arrival"
        initialFacts={[fact]}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "Finding a movie fact" })).toBeNull(),
    );
    expect(screen.getAllByText("A test fact about Arrival.")).toHaveLength(2);
    expect(getMovieFact).not.toHaveBeenCalled();
  });

  it("shows a recoverable error when the initial fact request fails", async () => {
    const user = userEvent.setup();
    vi.mocked(getMovieFact)
      .mockRejectedValueOnce(
        new ApiError("The service is unavailable.", 500, "FACT_UNAVAILABLE"),
      )
      .mockResolvedValueOnce({ fact });

    render(
      <DashboardClient
        userId="user-1"
        initialMovie="Arrival"
        initialFacts={[]}
      />,
    );

    expect(screen.getByRole("status", { name: "Finding a movie fact" })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText("We couldn’t load a fact.")).toBeTruthy(),
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(screen.getAllByText("A test fact about Arrival.")).toHaveLength(2),
    );
    expect(getMovieFact).toHaveBeenLastCalledWith({ refresh: true });
  });
});
