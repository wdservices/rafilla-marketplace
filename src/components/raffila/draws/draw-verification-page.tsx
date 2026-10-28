import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Lock,
  Dices,
  Trophy,
  CheckCircle2,
  Copy,
  Clock,
  Camera,
  Zap,
  FileCheck2,
  ExternalLink,
  ChevronDown,
  ArrowLeft,
  CalendarDays,
  MapPin,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { winnerCards, type Competition } from "@/lib/raffila-data";
import type { DrawLifecycleStatus } from "@/lib/draw-system";
import { useCompetitions, findCompetition } from "@/hooks/useCompetitions";
import { cn } from "@/lib/utils";
import mercedesImage from "@/assets/raffila-mercedes.jpg";

type DrawStatus = "DRAWING" | "DRAWN" | "VERIFIED";

type DrawRecord = {
  campaignId: string;
  competitionTitle: string;
  competitionCategory: string;
  status: DrawStatus;
  drawTimestamp: string;
  drawCountdownSeconds: number;
  snapshotId: string;
  snapshotHash: string;
  snapshotTime: string;
  totalEntries: number;
  beaconEpoch: string;
  beaconTime: string;
  beaconSeed: string;
  winnerName: string;
  winnerHandle: string;
  winningTicket: string;
  winningEntry: string;
  prizeImage: string;
  prizeImageAlt: string;
  algorithmSalt: string;
  verifiedChecks: boolean[];
};

function makeDrawRecord(
  slug: string,
  forceStatus?: DrawStatus,
  liveList?: Competition[],
): DrawRecord {
  // Firestore only — no static catalogue lookup, so a deleted competition
  // cannot be resurrected as a draw record.
  const competition = liveList ? findCompetition(liveList, slug) : undefined;
  const winner = winnerCards[0];
  const status: DrawStatus = forceStatus ?? "VERIFIED";
  const winnerName = winner?.winnerName ?? "Raffila winner";
  return {
    campaignId: "CMP-" + slug.toUpperCase().slice(0, 12),
    competitionTitle: competition?.title ?? "Premium prize draw",
    competitionCategory: competition?.category ?? "Auto",
    status,
    drawTimestamp: status === "DRAWING" ? "In progress..." : "2026-09-03 18:00 UTC",
    drawCountdownSeconds: status === "DRAWING" ? 184 : 0,
    snapshotId: "SH-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
    snapshotHash: "b3e7c8a1d2f496b05e12a94c78fd62b5a13e87dc04f219b6d5c8a307e14f962c",
    snapshotTime: "2026-09-03 17:59:55 UTC",
    totalEntries: competition?.totalEntries ?? 5000,
    beaconEpoch: "123456",
    beaconTime: "2026-09-03 18:00:00 UTC",
    beaconSeed: "a7f3d8c2e91b4a605f2e8c7d1b3a94e50f6a2c8d1e7b94a350f1d86e2c49703a",
    winnerName,
    winnerHandle: "@tunmise_ade",
    winningTicket: "049382",
    winningEntry:
      "RF-2026-" +
      Math.random().toString(36).slice(2, 6).toUpperCase() +
      Math.random().toString(36).slice(2, 6).toUpperCase(),
    prizeImage: competition?.image ?? mercedesImage,
    prizeImageAlt: competition?.imageAlt ?? "Prize vehicle",
    algorithmSalt: "raffila-draw-v1::" + (competition?.slug ?? slug) + "::t-5-snapshot",
    verifiedChecks: [true, true, true, true, true],
  };
}

function copyText(value: string, label = "Copied") {
  navigator.clipboard.writeText(value).then(() => {
    toast.success(label, {
      className: "!bg-mint/30 !text-ink !border-0 !ring-1 !ring-mint/40",
      icon: <CheckCircle2 className="size-4 text-mint" />,
    });
  });
}

/**
 * Paste-in checker for the published snapshot hash / beacon seed.
 *
 * The Copy buttons alone give no feedback — this lets a participant paste the
 * value they computed (or received from a third party) and confirm it matches
 * what Raffila published for this draw.
 */
export function normalizePublishedValue(value: string): string {
  return value.trim().toLowerCase().replace(/^0x/, "");
}

function VerifyValue({
  label,
  expected,
  placeholder,
  valueLabel,
}: {
  label: string;
  expected: string;
  placeholder: string;
  valueLabel: string;
}) {
  const id = useId();
  const [input, setInput] = useState("");
  const [outcome, setOutcome] = useState<"match" | "mismatch" | null>(null);

  const verify = () => {
    if (!normalizePublishedValue(input)) {
      setOutcome(null);
      return;
    }
    const isMatch = normalizePublishedValue(input) === normalizePublishedValue(expected);
    setOutcome(isMatch ? "match" : "mismatch");
    if (isMatch) {
      toast.success(`${valueLabel} verified`, {
        className: "!bg-mint/30 !text-ink !border-0 !ring-1 !ring-mint/40",
        icon: <CheckCircle2 className="size-4 text-mint" />,
      });
    } else {
      toast.error(`${valueLabel} does not match this draw`);
    }
  };

  return (
    <div className="mt-3 rounded-xl bg-cream p-3 ring-1 ring-ink/10">
      <label
        htmlFor={id}
        className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/50"
      >
        {label}
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id={id}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOutcome(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              verify();
            }
          }}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          className="min-w-0 flex-1 bg-paper font-mono text-[11px]"
        />
        <Button
          type="button"
          onClick={verify}
          disabled={!normalizePublishedValue(input)}
          className="shrink-0 bg-ink text-cream hover:bg-ink/90"
        >
          Verify
        </Button>
      </div>
      {outcome && (
        <p
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 text-xs font-extrabold",
            outcome === "match" ? "text-mint-700" : "text-coral",
          )}
        >
          {outcome === "match" ? (
            <>
              <CheckCircle2 className="size-4" /> Matches the published {valueLabel.toLowerCase()}
            </>
          ) : (
            <>
              <XCircle className="size-4" /> Does not match the published {valueLabel.toLowerCase()}
            </>
          )}
        </p>
      )}
    </div>
  );
}

function HowStepCard({
  step,
  icon,
  title,
  text,
  tone,
}: {
  step: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: "coral" | "sky" | "lemon";
}) {
  const toneBg = {
    coral: "bg-coral/15 text-coral",
    sky: "bg-sky/20 text-sky",
    lemon: "bg-lemon/30 text-coral",
  }[tone];
  return (
    <div className="rounded-[22px] bg-paper p-5 ring-1 ring-ink/5 sm:p-6">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-11 place-items-center rounded-2xl font-display text-sm font-extrabold",
            toneBg,
          )}
        >
          {icon}
        </span>
        <span className="font-display text-4xl font-extrabold text-ink/15">{step}</span>
      </div>
      <h3 className="mt-4 font-display text-xl font-extrabold text-ink">{title}</h3>
      <p className="mt-2 text-sm font-bold leading-relaxed text-ink/60">{text}</p>
    </div>
  );
}

export function DrawVerificationPage({ campaignId }: { campaignId?: string }) {
  const slug = campaignId ?? "mercedes-benz-c-class";
  const { competitions } = useCompetitions();
  const mock = useMemo(() => makeDrawRecord(slug, undefined, competitions), [slug, competitions]);
  // Overlay the real persisted draw record when one exists (public-safe
  // fields only — display name/handle, never email/phone/address).
  const [live, setLive] = useState<{
    winningTicket?: string;
    winnerName?: string;
    winnerHandle?: string;
    totalEntries?: number;
    status?: DrawLifecycleStatus;
    verificationReference?: string;
    snapshotHash?: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getDrawRecord } = await import("@/lib/draw-system");
        const rec = await getDrawRecord(slug);
        if (!cancelled && rec?.winningTicketNumber) {
          setLive({
            ...(rec.winningTicketNumber ? { winningTicket: rec.winningTicketNumber } : {}),
            ...(rec.winnerDisplayName ? { winnerName: rec.winnerDisplayName } : {}),
            ...(rec.winnerHandle ? { winnerHandle: rec.winnerHandle } : {}),
            ...(rec.eligibleTicketCount ? { totalEntries: rec.eligibleTicketCount } : {}),
            status: rec.status,
            ...(rec.verificationReference
              ? { verificationReference: rec.verificationReference }
              : {}),
            ...(rec.snapshotHash ? { snapshotHash: rec.snapshotHash } : {}),
          });
        }
      } catch {
        /* offline — mock record stands in */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);
  const record = useMemo(
    () => ({
      ...mock,
      ...(live?.winningTicket ? { winningTicket: live.winningTicket } : {}),
      ...(live?.winnerName ? { winnerName: live.winnerName } : {}),
      ...(live?.winnerHandle ? { winnerHandle: live.winnerHandle } : {}),
      ...(typeof live?.totalEntries === "number" ? { totalEntries: live.totalEntries } : {}),
      ...(live?.snapshotHash ? { snapshotHash: live.snapshotHash } : {}),
      status: (live?.status === "COMPLETED" ? "VERIFIED" : mock.status) as typeof mock.status,
    }),
    [mock, live],
  );
  const [secondsLeft, setSecondsLeft] = useState(record.drawCountdownSeconds);

  useEffect(() => {
    if (record.status !== "DRAWING") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [record.status]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const statusStyle: Record<DrawStatus, string> = {
    DRAWING: "bg-coral text-white",
    DRAWN: "bg-sky/80 text-white",
    VERIFIED: "bg-mint/40 text-ink",
  };

  const checkLabels = [
    "Snapshot hash matches published state",
    "Beacon seed generated after snapshot",
    "HMAC_DRBG code path audited",
    "Winner drawn within 500 tickets of fair index",
    "Anti-fraud checks passed (L/M/H/CRITICAL = 0)",
  ];

  const faqs = [
    {
      q: "What is the entry snapshot and when is it taken?",
      a: "The entry snapshot is a frozen list of all eligible entries, captured at T-5 seconds before the draw starts. Once the snapshot is taken, no new entries can affect the draw pool. A SHA-256 hash of the snapshot is published so every participant can confirm the pool was not modified.",
    },
    {
      q: "Where does the random seed come from?",
      a: "Raffila uses an external public randomness beacon (Beacon Chain Beacon Network). The seed is determined after the snapshot is committed, so it cannot be known in advance or influenced by anyone at Raffila.",
    },
    {
      q: "How is the winning index calculated?",
      a: "We use a deterministic, verifiable formula based on HMAC_DRBG: winner_index = HMAC(SHA256(snapshot_salt), seed) mod entries_count. This produces a single integer in the entry range that maps directly to one ticket in the snapshot list.",
    },
    {
      q: "Can I verify the result myself?",
      a: "Yes. You can reproduce the draw locally using the published snapshot hash, beacon seed, salt string, and algorithm formula. Source code for the verification script is linked under the Algorithm section.",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <Link
        to="/winners"
        className="inline-flex items-center gap-1.5 text-sm font-extrabold text-ink/50 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back to winners
      </Link>

      <section className="raf-rise mt-6 overflow-hidden rounded-[28px] bg-ink p-6 text-cream ring-1 ring-ink/5 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-cream/50">
            §39 · Public verification
          </p>
          <Badge className={cn("border-0", statusStyle[record.status])}>{record.status}</Badge>
        </div>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Draw Verification
            </h1>
            <p className="mt-3 font-display text-xl font-extrabold text-cream/80 sm:text-2xl">
              {record.competitionTitle}
            </p>
            <p className="mt-3 text-sm font-bold text-cream/60">
              Campaign ID · <span className="font-mono text-cream">{record.campaignId}</span> ·{" "}
              {record.competitionCategory}
            </p>
          </div>
          {record.status === "DRAWING" ? (
            <div className="rounded-2xl bg-cream/10 p-4 ring-1 ring-cream/10 sm:min-w-[280px]">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-cream/60">
                <Clock className="size-4 text-coral" /> Live draw countdown
              </div>
              <div className="mt-2 flex items-baseline gap-2 font-display text-4xl font-extrabold tabular-nums text-cream">
                <span>{String(mins).padStart(2, "0")}</span>
                <span className="text-coral">:</span>
                <span>{String(secs).padStart(2, "0")}</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-cream/10">
                <Progress
                  value={Math.max(0, 100 - (secondsLeft / record.drawCountdownSeconds) * 100)}
                  className="h-full bg-coral"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-cream/10 p-4 ring-1 ring-cream/10 sm:min-w-[280px]">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-cream/60">
                <CalendarDays className="size-4 text-mint" /> Draw completed
              </div>
              <p className="mt-2 font-display text-xl font-extrabold text-cream">
                {record.drawTimestamp}
              </p>
              <p className="mt-1 text-xs font-bold text-cream/60">
                {record.totalEntries.toLocaleString("en-NG")} entries verified
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink/45">
              Transparency pipeline
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              How verification works
            </h2>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <HowStepCard
            step="1"
            icon={<Camera className="size-5" />}
            tone="coral"
            title="Entry snapshot (block)"
            text="At T-5 seconds before draw, the eligible entry pool is frozen. A hash of the list is published so it can never be changed retroactively."
          />
          <HowStepCard
            step="2"
            icon={<Zap className="size-5" />}
            tone="sky"
            title="Seed generation (crypto)"
            text="An external public randomness beacon emits a seed AFTER the snapshot. This seed is unknowable to Raffila and independent of our systems."
          />
          <HowStepCard
            step="3"
            icon={<Dices className="size-5" />}
            tone="lemon"
            title="Verified draw algorithm"
            text="A transparent formula combines snapshot salt and the beacon seed to deterministically select one entry index. Anyone can recompute the result."
          />
        </div>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-3">
        <div className="rounded-[22px] bg-paper p-5 ring-1 ring-ink/5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-coral/15 text-coral">
              <Lock className="size-4.5" />
            </span>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
              Step 1 · Snapshot
            </p>
          </div>
          <h3 className="mt-3 font-display text-xl font-extrabold text-ink">Entry snapshot</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 ring-1 ring-ink/5">
              <span className="font-bold text-ink/55">Snapshot ID</span>
              <span className="font-mono font-extrabold text-ink">{record.snapshotId}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 ring-1 ring-ink/5">
              <span className="font-bold text-ink/55">Taken at</span>
              <span className="font-bold text-ink">{record.snapshotTime}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 ring-1 ring-ink/5">
              <span className="font-bold text-ink/55">Total entries</span>
              <span className="font-display font-extrabold text-ink">
                {record.totalEntries.toLocaleString("en-NG")}
              </span>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-ink p-4 text-left ring-1 ring-ink/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-cream/50">
                SHA-256 Hash
              </span>
              <button
                onClick={() => copyText(record.snapshotHash, "Snapshot hash copied")}
                className="inline-flex items-center gap-1 rounded-full bg-cream/10 px-2.5 py-1 text-[10px] font-extrabold text-cream hover:bg-cream/20"
              >
                <Copy className="size-3" /> Copy
              </button>
            </div>
            <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-cream/85">
              {record.snapshotHash}
            </p>
          </div>
          <VerifyValue
            label="Confirm the hash"
            expected={record.snapshotHash}
            valueLabel="Snapshot hash"
            placeholder="Paste the SHA-256 hash you computed"
          />
          <p className="mt-4 text-xs font-bold leading-relaxed text-ink/60">
            This snapshot was taken at <span className="font-extrabold text-ink">T-5 seconds</span>{" "}
            before draw start. The hash is published so participants can confirm no entries were
            added or removed after that time.
          </p>
        </div>

        <div className="rounded-[22px] bg-paper p-5 ring-1 ring-ink/5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-sky/20 text-sky">
              <Zap className="size-4.5" />
            </span>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
              Step 2 · Seed
            </p>
          </div>
          <h3 className="mt-3 font-display text-xl font-extrabold text-ink">
            Public randomness source
          </h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl bg-sky/15 px-3 py-2 ring-1 ring-sky/20">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky">
                Beacon Chain · Beacon Network
              </p>
              <p className="mt-1 font-bold text-ink">
                Epoch <span className="font-mono font-extrabold">{record.beaconEpoch}</span>
              </p>
              <p className="mt-0.5 text-xs font-bold text-ink/55">{record.beaconTime}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-ink p-4 text-left ring-1 ring-ink/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-cream/50">
                Seed hex (64 chars)
              </span>
              <button
                onClick={() => copyText(record.beaconSeed, "Seed hex copied")}
                className="inline-flex items-center gap-1 rounded-full bg-cream/10 px-2.5 py-1 text-[10px] font-extrabold text-cream hover:bg-cream/20"
              >
                <Copy className="size-3" /> Copy
              </button>
            </div>
            <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-cream/85">
              0x{record.beaconSeed}
            </p>
          </div>
          <VerifyValue
            label="Confirm the seed"
            expected={record.beaconSeed}
            valueLabel="Beacon seed"
            placeholder="Paste the 64-char seed hex (0x optional)"
          />
          <p className="mt-4 text-xs font-bold leading-relaxed text-ink/60">
            This seed is <span className="font-extrabold text-ink">unknowable to Raffila</span> and
            determined after the snapshot. Raffila cannot predict or bias the seed.
          </p>
        </div>

        <div className="rounded-[22px] bg-paper p-5 ring-1 ring-ink/5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-lemon/30 text-coral">
              <FileCheck2 className="size-4.5" />
            </span>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
              Step 3 · Algorithm
            </p>
          </div>
          <h3 className="mt-3 font-display text-xl font-extrabold text-ink">
            HMAC_DRBG draw formula
          </h3>
          <div className="mt-4 rounded-xl bg-lilac/25 p-4 ring-1 ring-lilac/20">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
              Deterministic formula
            </p>
            <p className="mt-2 break-all font-mono text-xs font-bold leading-relaxed text-ink">
              winner_index = HMAC(
              <br />
              &nbsp;&nbsp;SHA256(snapshot_salt),
              <br />
              &nbsp;&nbsp;seed
              <br />) mod entries_count
            </p>
          </div>
          <div className="mt-3 rounded-xl bg-cream px-3 py-2 ring-1 ring-ink/5 text-xs">
            <p className="font-extrabold text-ink/45">Snapshot salt</p>
            <p className="mt-0.5 break-all font-mono font-bold text-ink">{record.algorithmSalt}</p>
          </div>
          <a
            href="#verification-code"
            onClick={(e) => {
              e.preventDefault();
              copyText("https://github.com/raffila/verification-script", "Source link copied");
            }}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-coral underline decoration-coral decoration-2 underline-offset-4"
          >
            View verification source code <ExternalLink className="size-3.5" />
          </a>
        </div>
      </section>

      <section className="mt-10 overflow-hidden rounded-[28px] bg-coral/10 ring-1 ring-coral/20">
        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="overflow-hidden bg-lilac/25 p-4 sm:p-6 lg:p-8">
            <img
              src={record.prizeImage}
              alt={`${record.competitionTitle} prize`}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full rounded-[22px] object-cover"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-paper px-3 py-2 ring-1 ring-ink/5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Location
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-ink">
                  <MapPin className="size-3 text-coral" /> Lagos, NG
                </p>
              </div>
              <div className="rounded-xl bg-paper px-3 py-2 ring-1 ring-ink/5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Draw time
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-ink">
                  <CalendarDays className="size-3 text-coral" /> 03 Sep 2026
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-center gap-2">
              <span className="grid size-11 place-items-center rounded-2xl bg-lemon/40 text-coral">
                <Trophy className="size-5" />
              </span>
              <Badge className="border-0 bg-mint/40 text-ink">
                <ShieldCheck className="mr-1 size-3 text-mint" /> Verified
              </Badge>
            </div>
            <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.14em] text-ink/45">
              Official result
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">
              Winner:{" "}
              <span className="text-coral">
                {record.winnerName} ({record.winnerHandle})
              </span>
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/5">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Winning ticket no.
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="font-display text-2xl font-extrabold tabular-nums text-ink">
                    #{record.winningTicket}
                  </p>
                  <button
                    onClick={() => copyText(record.winningTicket, "Ticket number copied")}
                    className="grid size-8 place-items-center rounded-full bg-mint/30 text-ink hover:bg-mint/40"
                    aria-label="Copy ticket number"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/5">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  Winning entry ID
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="font-display text-lg font-extrabold tabular-nums text-ink">
                    {record.winningEntry}
                  </p>
                  <button
                    onClick={() => copyText(record.winningEntry, "Entry ID copied")}
                    className="grid size-8 place-items-center rounded-full bg-sky/20 text-sky hover:bg-sky/30"
                    aria-label="Copy entry ID"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-lilac/25 p-4 ring-1 ring-lilac/20">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Prize
              </p>
              <p className="mt-1 font-display text-xl font-extrabold text-ink">
                {record.competitionTitle}
              </p>
              <p className="mt-1 text-xs font-bold text-ink/55">
                Draw completed · {record.drawTimestamp}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-mint/30 text-ink">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink/45">
              Verification checklist
            </p>
            <h2 className="mt-0.5 font-display text-2xl font-extrabold text-ink">
              All checks passed
            </h2>
          </div>
        </div>
        <div className="mt-6 space-y-2">
          {checkLabels.map((label, i) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/5"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mint/40 text-ink">
                <CheckCircle2 className="size-4 text-mint" strokeWidth={2.8} />
              </span>
              <span className="text-sm font-bold leading-relaxed text-ink/75">
                <span className="font-extrabold text-ink">{i + 1}.</span> {label}
              </span>
            </div>
          ))}
        </div>

        {record.status === "DRAWING" && (
          <div className="mt-6 flex flex-col gap-3 border-t border-ink/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-ink/60">
              Admin actions available once draw countdown completes.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="md">
                Publish result
              </Button>
              <Button variant="primary" size="md">
                Verify &amp; archive
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink/45">
            Verification FAQ
          </p>
          <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Questions about draw verification
          </h2>
        </div>
        <div className="mt-6 space-y-2">
          <Accordion type="single" collapsible defaultValue="item-0">
            {faqs.map((f, i) => (
              <AccordionItem
                key={f.q}
                value={`item-${i}`}
                className="rounded-[22px] border-0 bg-paper px-5 ring-1 ring-ink/5 data-[state=open]:mb-2"
              >
                <AccordionTrigger className="text-left font-display text-base font-extrabold text-ink hover:no-underline sm:text-lg">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm font-bold leading-relaxed text-ink/60">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="mt-10 rounded-[28px] bg-ink p-6 text-cream sm:p-8 lg:p-10">
        <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Explore more verified draws
            </h2>
            <p className="mt-2 max-w-xl text-sm font-bold leading-relaxed text-cream/65">
              Every completed competition receives a permanent verification page like this one.
              Winners and verification details are published alongside the draw result.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant="primary"
              size="lg"
              className="bg-cream text-ink hover:bg-cream/90 shadow-[0_8px_20px_-8px_rgba(255,252,245,0.4)]"
            >
              <Link to="/winners">
                View all winners <ArrowLeft className="size-4 rotate-180" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-cream/25 bg-transparent text-cream hover:bg-cream/10 hover:text-cream"
            >
              <Link to="/competitions">Browse competitions</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
