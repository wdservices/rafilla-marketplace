import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type PayoutDoc = { id: string; data: () => Record<string, unknown> };

const PAYOUTS: PayoutDoc[] = [
  {
    id: "po_ref_1",
    data: () => ({
      type: "REFERRAL",
      status: "PENDING",
      amountKobo: 125_000,
      userName: "Gospel Alpha",
      bank: "GTBank",
      accountNumber: "0123456789",
      accountName: "Gospel Alpha",
      userId: "u1",
      createdAt: { toDate: () => new Date("2026-10-08T12:00:00Z") },
    }),
  },
  {
    id: "po_win_1",
    data: () => ({
      type: "WINNER",
      status: "PAID",
      amountKobo: 500_000,
      userName: "Winner Person",
      bank: "Zenith",
      accountNumber: "9999999999",
      accountName: "Winner Person",
      userId: "u2",
      createdAt: { toDate: () => new Date("2026-10-09T12:00:00Z") },
    }),
  },
];

const getDocsMock = vi.fn(async (..._args: unknown[]) => ({ docs: PAYOUTS }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  query: vi.fn((...args: unknown[]) => args),
  limit: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("@/hooks/useAuthSession", () => ({
  useAuthSession: () => ({
    user: { id: "firebase_admin1", firstName: "Admin" },
    role: "admin",
    isAuthenticated: true,
  }),
}));

const setStatusMock = vi.fn(async (_input: unknown) => ({ ok: true }));
vi.mock("@/lib/referral-server", () => ({
  adminSetPayoutStatus: (input: unknown) => setStatusMock(input),
}));

vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn(async () => {}) }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/components/raffila/admin/admin-shell", () => ({
  AdminShell: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { AdminPayoutsPage } from "@/components/raffila/admin/payouts";
import { formatNaira } from "@/lib/utils";

/**
 * Regression: the admin payouts page rendered a hardcoded empty mock array, so
 * real referral cash-outs (created by requestReferralPayout) were invisible to
 * admins and the Process/Mark paid/Reverse actions only wrote an activity log.
 * The list must come from the Firestore `payouts` collection and the actions
 * must call adminSetPayoutStatus.
 */
describe("admin payouts — real Firestore data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDocsMock.mockImplementation(async () => ({ docs: PAYOUTS }));
    setStatusMock.mockImplementation(async () => ({ ok: true }));
  });

  it("shows the WINNER payout on the default tab", async () => {
    render(<AdminPayoutsPage />);
    await waitFor(() => expect(screen.getByText("Winner Person")).toBeInTheDocument());
    expect(screen.getAllByText(formatNaira(500_000)).length).toBeGreaterThanOrEqual(1);
  });

  it("lists real REFERRAL payouts on the referral tab", async () => {
    const user = userEvent.setup();
    render(<AdminPayoutsPage />);
    await waitFor(() => expect(screen.getByText("Winner Person")).toBeInTheDocument());

    await user.click(screen.getByRole("tab", { name: /referral cash-outs/i }));

    await waitFor(() => expect(screen.getByText("Gospel Alpha")).toBeInTheDocument());
    expect(screen.getAllByText(formatNaira(125_000)).length).toBeGreaterThanOrEqual(1);
    // Winner payout must not leak into the referral tab.
    expect(screen.queryByText("Winner Person")).not.toBeInTheDocument();
    // Destination shows the masked account number + name.
    expect(screen.getByText(/6789 · Gospel Alpha/)).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("calls adminSetPayoutStatus with the stripped admin uid when processing", async () => {
    const user = userEvent.setup();
    render(<AdminPayoutsPage />);
    await waitFor(() => expect(screen.getByText("Winner Person")).toBeInTheDocument());
    await user.click(screen.getByRole("tab", { name: /referral cash-outs/i }));
    await waitFor(() => expect(screen.getByText("Gospel Alpha")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /payout actions for po_ref_1/i }));
    await user.click(await screen.findByText("Process"));

    await waitFor(() =>
      expect(setStatusMock).toHaveBeenCalledWith({
        data: { adminUid: "admin1", payoutId: "po_ref_1", status: "PROCESSING" },
      }),
    );
  });

  it("surfaces a friendly message when Firestore denies the read", async () => {
    getDocsMock.mockImplementation(async () => {
      const err = new Error("missing or insufficient permissions");
      (err as { code?: string }).code = "permission-denied";
      throw err;
    });
    render(<AdminPayoutsPage />);
    await waitFor(() =>
      expect(screen.getByText(/Publish the latest firestore\.rules/i)).toBeInTheDocument(),
    );
  });
});
