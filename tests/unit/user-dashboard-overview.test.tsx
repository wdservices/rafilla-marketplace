import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

type SnapCb = (snap: { docs: unknown[]; empty: boolean }) => void;
const snapshotHandler: { fn: null | SnapCb } = { fn: null };

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  onSnapshot: vi.fn((_a: unknown, next: unknown, err?: unknown) => {
    snapshotHandler.fn = next as typeof snapshotHandler.fn;
    if (typeof err === "function") return () => {};
    return () => {};
  }),
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("@/hooks/useAuthSession", () => ({
  useAuthSession: () => ({ user: { id: "firebase_abc123", firstName: "Gospel" } }),
}));

vi.mock("@/hooks/useCompetitions", () => ({
  useCompetitions: () => ({ competitions: [], activeCompetitions: [], loading: false, live: true }),
  findCompetition: () => undefined,
  isCompetitionConcluded: () => false,
}));

vi.mock("@/lib/platform-config", () => ({
  fetchFeatureFlags: () => Promise.resolve({ wallet: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <a href="#">{children}</a>,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/dashboard" }),
  useParams: () => ({}),
}));

vi.mock("@/components/raffila/dashboard/app-shell", () => ({
  DashboardAppShell: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { DashboardOverviewPage } from "@/components/raffila/dashboard/overview";

const entryDoc = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  data: () => ({
    entryId: id,
    competitionSlug: "wireless-hair-clipper",
    competitionTitle: "Wireless hair clipper",
    quantity: 1,
    amountKobo: 10000,
    status: "CONFIRMED",
    createdAt: { toDate: () => new Date("2026-10-08T12:00:00Z") },
    ...o,
  }),
});

/**
 * Regression: the "Total entries" KPI rendered hardcoded strings —
 * value="0" and sub="Across 0 competitions" — so a user with real paid
 * entries always saw zero. The card must be driven by users/{uid}/entries.
 */
describe("user dashboard overview — total entries KPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshotHandler.fn = null;
  });

  // React requires act for state updates driven by external listeners.
  const push = (docs: unknown[]) => {
    render(<DashboardOverviewPage />);
    act(() => snapshotHandler.fn?.({ docs, empty: docs.length === 0 }));
  };

  it("shows the real ticket total and competition count", async () => {
    push([
      entryDoc("RF-2026-A"),
      entryDoc("RF-2026-B", {
        entryId: "RF-2026-B",
        competitionSlug: "lexus-rx-350",
        competitionTitle: "Lexus RX 350",
      }),
    ]);

    await waitFor(() => expect(screen.getByText("Total entries")).toBeInTheDocument());
    // 1 + 1 tickets across 2 distinct competitions.
    expect(screen.getByText("Across 2 competitions")).toBeInTheDocument();
  });

  it("sums quantity when a single entry holds several tickets", async () => {
    push([entryDoc("RF-2026-Q", { quantity: 5 })]);
    await waitFor(() => expect(screen.getByText("Across 1 competition")).toBeInTheDocument());
    // "5" shows in both the KPI and the recent-entries table.
    expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
  });

  it("does not show zero once entries exist", async () => {
    push([entryDoc("RF-2026-A")]);
    await waitFor(() => expect(screen.getByText("Across 1 competition")).toBeInTheDocument());
  });

  it("keeps the empty state honest when the user has no entries", async () => {
    push([]);
    await waitFor(() => expect(screen.getByText("Across 0 competitions")).toBeInTheDocument());
    expect(screen.getByText("No entries yet")).toBeInTheDocument();
  });
});
