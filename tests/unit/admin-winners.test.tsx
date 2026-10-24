import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type WinnerDoc = { id: string; data: () => Record<string, unknown> };

const WINNERS: WinnerDoc[] = [
  {
    id: "ps5-42",
    data: () => ({
      winnerName: "Ada Obi",
      winnerHandle: "ada_obi",
      competitionTitle: "PlayStation 5 Giveaway",
      ticketNumber: "42",
      createdAt: "2026-03-01T10:00:00Z",
      drawDate: "2026-03-01T10:00:00Z",
      fulfillmentStatus: "RECEIVED",
      receivedAt: "2026-03-08T15:30:00Z",
      receivedBy: "adm_old",
      receivedByName: "Aisha Olamide",
      deliveryMethod: "PICKUP",
      fulfillmentNote: "Collected at the office",
    }),
  },
  {
    id: "mac-7",
    data: () => ({
      winnerName: "Tola James",
      competitionTitle: "MacBook Air M4",
      ticketNumber: "7",
      createdAt: "2026-02-10T10:00:00Z",
      drawDate: "2026-02-10T10:00:00Z",
    }),
  },
];

const getDocsMock = vi.fn(async (..._args: unknown[]) => ({ docs: WINNERS }));
const setDocMock = vi.fn(async (..._args: unknown[]) => undefined);

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn((_db: unknown, _col: string, id: string) => ({ id })),
  query: vi.fn((...args: unknown[]) => args),
  limit: vi.fn(() => ({})),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("@/hooks/useAuthSession", () => ({
  useAuthSession: () => ({
    user: {
      id: "firebase_admin1",
      firstName: "Admin",
      lastName: "Aisha",
      email: "admin@raffila.com",
    },
    role: "admin",
    isAuthenticated: true,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/components/raffila/admin/admin-shell", () => ({
  AdminShell: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { AdminWinnersPage } from "@/components/raffila/admin/winners";

/**
 * The winners showcase documents carried no handover tracking, so there was no
 * way to record that a prize had actually been delivered — or when and by whom
 * it was confirmed. The admin winners view must read the `winners` collection
 * and write the fulfillment payload (status + receipt date/time + confirmer).
 */
describe("admin winners — prize handover tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDocsMock.mockImplementation(async () => ({ docs: WINNERS }));
    setDocMock.mockImplementation(async () => undefined);
  });

  it("shows both fulfillment states with the receipt date and time", async () => {
    render(<AdminWinnersPage />);

    await waitFor(() => expect(screen.getByText("Ada Obi")).toBeInTheDocument());
    expect(screen.getByText("Tola James")).toBeInTheDocument();
    expect(screen.getAllByText("Received by winner").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Awaiting handover").length).toBeGreaterThan(0);
    // Year-carrying Lagos stamp for the confirmed receipt.
    expect(screen.getByText(/08 Mar 2026/)).toBeInTheDocument();
    expect(screen.getByText(/confirmed by Aisha Olamide/)).toBeInTheDocument();
    // Outstanding prize has no receipt stamp.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("writes the receipt confirmation with date, time and confirmer", async () => {
    const user = userEvent.setup();
    render(<AdminWinnersPage />);
    await waitFor(() => expect(screen.getByText("Tola James")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /handover actions for tola james/i }));
    await user.click(await screen.findByText("Confirm received…"));
    await user.click(await screen.findByRole("button", { name: /confirm received/i }));

    await waitFor(() => expect(setDocMock).toHaveBeenCalledTimes(1));
    const [, payload, options] = setDocMock.mock.calls[0]! as [
      unknown,
      Record<string, unknown>,
      unknown,
    ];
    expect(payload).toMatchObject({
      fulfillmentStatus: "RECEIVED",
      receivedBy: "admin1",
      receivedByName: "Admin Aisha",
      deliveryMethod: "COURIER",
      fulfillmentUpdatedBy: "admin1",
    });
    expect(String(payload["receivedAt"])).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(options).toEqual({ merge: true });
  });

  it("surfaces a friendly message when Firestore denies the read", async () => {
    getDocsMock.mockImplementation(async () => {
      const err = new Error("missing or insufficient permissions");
      (err as { code?: string }).code = "permission-denied";
      throw err;
    });
    render(<AdminWinnersPage />);
    await waitFor(() =>
      expect(screen.getByText(/Publish the latest firestore\.rules/i)).toBeInTheDocument(),
    );
  });
});
