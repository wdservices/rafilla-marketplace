import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const qrValues: string[] = [];
let snapCb: ((snap: { docs: unknown[] }) => void) | null = null;
let ensureImpl: (input: {
  data: { uid: string };
}) => Promise<{ ok: boolean; code: string }> = async () => ({ ok: true, code: "ALICE" });

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => {
    qrValues.push(value);
    return <svg data-testid="qr-code" aria-label={value} />;
  },
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  getDocs: vi.fn(),
  onSnapshot: vi.fn((_a: unknown, next: (s: { docs: unknown[] }) => void) => {
    snapCb = next;
    return () => {};
  }),
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/referral-server", () => ({
  ensureReferralCode: (input: { data: { uid: string } }) => ensureImpl(input),
}));
vi.mock("@/hooks/useAuthSession", () => ({
  useAuthSession: () => ({ user: { id: "firebase_alice" } }),
}));
vi.mock("@/hooks/useCompetitions", () => ({
  useCompetitions: () => ({ competitions: [], activeCompetitions: [], loading: false, live: true }),
  findCompetition: () => undefined,
  isCompetitionConcluded: () => false,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <a href="#">{children}</a>,
}));
vi.mock("@/components/raffila/dashboard/app-shell", () => ({
  DashboardAppShell: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...rest }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button {...rest}>{children}</button>
  ),
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { DashboardEntriesPage } from "@/components/raffila/dashboard/entries";

const entryDoc = (entryId: string) => ({
  id: entryId,
  ref: { path: `users/alice/entries/${entryId}` },
  data: () => ({
    entryId,
    competitionSlug: "wireless-hair-clipper",
    competitionTitle: "Wireless hair clipper",
    quantity: 1,
    amountKobo: 10000,
    status: "CONFIRMED",
    ticketNumbers: ["943402"],
    createdAt: { toDate: () => new Date("2026-10-08T12:00:00Z") },
  }),
});

describe("entry ticket QR code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    qrValues.length = 0;
    snapCb = null;
    ensureImpl = async () => ({ ok: true, code: "ALICE" });
  });

  it("renders a scannable invite URL with the code, competition and entry", async () => {
    render(<DashboardEntriesPage />);
    act(() => snapCb?.({ docs: [entryDoc("RF-2026-AAA")] }));

    const viewBtn = await screen.findByRole("button", { name: /view ticket/i });
    fireEvent.click(viewBtn);

    await waitFor(() => expect(screen.getByTestId("qr-code")).toBeInTheDocument());
    expect(qrValues).toHaveLength(1);
    const origin = window.location.origin;
    expect(qrValues[0]).toBe(`${origin}/invite/ALICE?comp=wireless-hair-clipper&e=RF-2026-AAA`);
    // Must be a real URL a phone camera can open — never the old pipe payload.
    expect(qrValues[0]).not.toContain("|");
    expect(() => new URL(qrValues[0]!)).not.toThrow();
  });

  it("keeps each purchase unique via the entry id in the URL", async () => {
    render(<DashboardEntriesPage />);
    act(() => snapCb?.({ docs: [entryDoc("RF-2026-AAA")] }));
    fireEvent.click(await screen.findByRole("button", { name: /view ticket/i }));
    await waitFor(() => expect(qrValues).toHaveLength(1));
    const first = qrValues[0]!;

    // Same user, a different purchase → same invite code, different URL.
    const second = `${window.location.origin}/invite/ALICE?comp=wireless-hair-clipper&e=RF-2026-BBB`;
    expect(first).not.toBe(second);
    expect(first).toContain("/invite/ALICE");
    expect(first).toContain("e=RF-2026-AAA");
    expect(second).toContain("e=RF-2026-BBB");
  });

  it("falls back to the competition URL when no referral code is available", async () => {
    ensureImpl = async () => {
      throw new Error("backend not ready");
    };
    render(<DashboardEntriesPage />);
    act(() => snapCb?.({ docs: [entryDoc("RF-2026-AAA")] }));
    fireEvent.click(await screen.findByRole("button", { name: /view ticket/i }));
    await waitFor(() => expect(screen.getByTestId("qr-code")).toBeInTheDocument());
    expect(qrValues[0]).toBe(`${window.location.origin}/competitions/wireless-hair-clipper`);
  });

  it("does not render any QR before a ticket is opened", () => {
    render(<DashboardEntriesPage />);
    act(() => snapCb?.({ docs: [] }));
    expect(screen.queryByTestId("qr-code")).not.toBeInTheDocument();
    expect(qrValues).toHaveLength(0);
  });
});
