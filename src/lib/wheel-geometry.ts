/**
 * Pure angle math for the prize wheel ("Wheel of Fortune").
 *
 * Kept out of the component file so it can be unit-tested without rendering,
 * and so React Fast Refresh keeps working for the component.
 *
 * WHEEL ANGLE CONVENTION
 * ---------------------------------------------------------------------------
 * The SVG draws each segment with (cx + R·cos θ, cy + R·sin θ), so θ is
 * measured clockwise from 3 o'clock (SVG's y-axis points down):
 *     θ =   0° → 3 o'clock      θ =  90° → 6 o'clock
 *     θ = 180° → 9 o'clock      θ = 270° → 12 o'clock
 *
 * Segment i therefore spans [i·seg, (i+1)·seg] measured from 3 o'clock, and
 * its centre sits at (i + 0.5)·seg — NOT from 12 o'clock.
 *
 * The gold pointer is fixed at 12 o'clock (θ = 270°) outside the wheel, and a
 * CSS `rotate(rot)` adds `rot` to every point's θ. Parking segment i's centre
 * under the pointer requires:
 *     (i + 0.5)·seg + rot ≡ 270 (mod 360)
 *  ⇒  rot = 270 − (i + 0.5)·seg
 */

/** Resting rotation: puts the last/first segment boundary line under the pointer. */
export const WHEEL_REST_ROTATION_DEG = 270;

/** Rotation that parks segment `index`'s CENTRE under the 12 o'clock pointer. */
export function wheelLandRotationDeg(index: number, segmentCount: number): number {
  const segmentAngle = 360 / segmentCount;
  const midAngle = (index + 0.5) * segmentAngle;
  return (270 - midAngle + 360) % 360;
}

/**
 * Total spin target: `fullSpins` revolutions forward from `fromDeg`, ending on
 * a rotation congruent to `landDeg` (mod 360).
 *
 * `fromDeg` defaults to the rest position, but replaying a finished draw starts
 * from the rotation the wheel is already parked at — passing it in guarantees
 * the wheel always travels forward instead of sitting still.
 */
export function wheelTargetRotationDeg(
  landDeg: number,
  fullSpins = 7,
  fromDeg = WHEEL_REST_ROTATION_DEG,
): number {
  const extra = (landDeg - fromDeg + 360) % 360;
  return fromDeg + 360 * fullSpins + extra;
}

/** Unrotated screen angle (clockwise from 3 o'clock) sitting at 12 o'clock after `rot`. */
export function wheelAngleUnderPointer(rot: number): number {
  return (((270 - rot) % 360) + 360) % 360;
}
