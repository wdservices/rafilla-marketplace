import { describe, expect, it } from "vitest";
import {
  WHEEL_REST_ROTATION_DEG,
  wheelAngleUnderPointer,
  wheelLandRotationDeg,
  wheelTargetRotationDeg,
} from "@/lib/wheel-geometry";

/** Which segment index sits under the 12 o'clock pointer after `rot`. */
function segmentUnderPointer(rot: number, segmentCount: number): number {
  const seg = 360 / segmentCount;
  return Math.floor(wheelAngleUnderPointer(rot) / seg) % segmentCount;
}

/** The buggy pre-fix formula, kept here as an explicit regression guard. */
function legacyBuggyLandDeg(index: number, segmentCount: number): number {
  const midAngle = (index + 0.5) * (360 / segmentCount);
  return (360 - midAngle + 360) % 360;
}

/**
 * Regression: the wheel aimed the winning segment at 3 o'clock instead of the
 * 12 o'clock pointer — a 270° error — because the code assumed SVG segment
 * angles start at 12 o'clock when they actually start at 3 o'clock
 * (cx + R·cos θ, cy + R·sin θ with y pointing down).
 *
 * Reported symptom: with 5 tickets the winner was #715691 (manager) but the
 * pointer stopped on #676485 (Gospel).
 */
describe("wheel of fortune — landing geometry", () => {
  it("reproduces the reported bug with the legacy formula", () => {
    // 5 segments, winner #715691 sits at display index 1 (verified on screen).
    const n = 5;
    const winnerIndex = 1;
    const buggy = legacyBuggyLandDeg(winnerIndex, n);
    // The pointer landed on segment 0 — Gospel — not the winner.
    expect(segmentUnderPointer(buggy, n)).toBe(0);
    expect(buggy).toBe(252);
  });

  it("parks the winning segment's centre under the pointer", () => {
    const land = wheelLandRotationDeg(1, 5);
    expect(land).toBe(162);
    expect(segmentUnderPointer(land, 5)).toBe(1);
  });

  it("centres the segment, not its edge", () => {
    const n = 5;
    const land = wheelLandRotationDeg(1, n);
    const under = wheelAngleUnderPointer(land);
    const seg = 360 / n;
    // Exactly at the segment midpoint (108° for index 1 of 5).
    expect(under).toBeCloseTo(1.5 * seg, 6);
  });

  it("lands every index correctly for many segment counts", () => {
    for (const n of [3, 4, 5, 6, 7, 12, 24, 28]) {
      for (let i = 0; i < n; i++) {
        expect(segmentUnderPointer(wheelLandRotationDeg(i, n), n), `segment ${i} of ${n}`).toBe(i);
      }
    }
  });

  it("rests on a segment boundary line, never mid-ticket", () => {
    for (const n of [3, 4, 5, 6, 7, 12, 24, 28]) {
      const under = wheelAngleUnderPointer(WHEEL_REST_ROTATION_DEG);
      // A boundary is any multiple of the segment angle.
      expect(under % (360 / n), `rest angle for ${n} segments`).toBeCloseTo(0, 6);
    }
  });

  it("targets a rotation congruent to the landing offset modulo 360", () => {
    for (const n of [5, 12, 28]) {
      for (let i = 0; i < n; i++) {
        const land = wheelLandRotationDeg(i, n);
        const target = wheelTargetRotationDeg(land);
        expect(target % 360).toBeCloseTo(land % 360, 6);
        // Still does the suspense revolutions.
        expect(target).toBeGreaterThan(360 * 7);
      }
    }
  });

  /**
   * Replaying a completed draw starts with the wheel already parked on the
   * winner, so the target must be derived from that parked rotation — otherwise
   * the target equals the current rotation and the wheel never moves.
   */
  it("always travels forward when replayed from the parked landing rotation", () => {
    const land = wheelLandRotationDeg(1, 5);
    const target = wheelTargetRotationDeg(land, 7, land);
    expect(target).toBe(land + 360 * 7);
    expect(target % 360).toBeCloseTo(land % 360, 6);
    expect(segmentUnderPointer(target, 5)).toBe(1);
  });

  it("replays correctly from any starting rotation", () => {
    for (const base of [0, 90, 162, 270, 450, 1234.5]) {
      for (const n of [5, 12, 28]) {
        for (let i = 0; i < n; i++) {
          const land = wheelLandRotationDeg(i, n);
          const target = wheelTargetRotationDeg(land, 7, base);
          expect(target, `base ${base} segment ${i}/${n}`).toBeGreaterThan(base);
          expect(segmentUnderPointer(target, n)).toBe(i);
        }
      }
    }
  });

  it("keeps the landing offset within [0, 360)", () => {
    for (const n of [3, 5, 28]) {
      for (let i = 0; i < n; i++) {
        const land = wheelLandRotationDeg(i, n);
        expect(land).toBeGreaterThanOrEqual(0);
        expect(land).toBeLessThan(360);
      }
    }
  });
});
