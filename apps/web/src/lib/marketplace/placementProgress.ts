/**
 * How far along a placement is, said in a way that cannot contradict itself.
 *
 * The percentage was rounded to an integer, so on a 5000 token asset the first
 * 24 tokens placed all read as `0%` — the same as none. And the line underneath
 * showed how many were *available*, right below a bar measuring how many were
 * *placed*: a bar at 0% next to the number 4998 tells two opposite stories, and
 * the reader is left deciding which one is broken.
 *
 * Rounding also lies at the other end: with one token left, 4999 of 5000 rounds
 * to `100%`, which is the one number that has to mean sold out.
 */
export type PlacementProgress = {
  /** Width for the bar, nudged so a real placement is never invisible. */
  percent: number;
  /** What to print next to the label. */
  label: string;
  placedTokens: number;
};

export function placementProgress(input: {
  availableTokens: number;
  totalTokens: number;
}): PlacementProgress {
  const total = Math.max(0, Math.floor(input.totalTokens));
  const available = Math.min(Math.max(0, Math.floor(input.availableTokens)), total);
  const placed = total - available;

  if (total <= 0 || placed <= 0) {
    return { percent: 0, label: '0%', placedTokens: 0 };
  }

  if (placed >= total) {
    return { percent: 100, label: '100%', placedTokens: total };
  }

  const exact = (placed / total) * 100;
  const label = exact < 1 ? '<1%' : exact > 99 ? '>99%' : `${Math.round(exact)}%`;

  return {
    // A sliver, so something placed always looks different from nothing placed.
    percent: Math.min(99, Math.max(1, exact)),
    label,
    placedTokens: placed
  };
}
