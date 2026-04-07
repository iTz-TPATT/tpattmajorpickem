// Masters 2026: April 10-13
// Reveal times = first tee time each day (picks hidden until then)
// All times in UTC. ET = UTC-4 during April.
// R1/R2 first tee ~8:00 AM ET = 12:00 UTC
// R3/R4 first tee ~9:30 AM ET = 13:30 UTC

export const ROUND_REVEAL_TIMES: Record<number, string> = {
  1: "2026-04-10T12:00:00Z",
  2: "2026-04-11T12:00:00Z",
  3: "2026-04-12T13:30:00Z",
  4: "2026-04-13T13:30:00Z",
};

export const ROUND_LABELS: Record<number, string> = {
  1: "Round 1 — Thursday, April 10",
  2: "Round 2 — Friday, April 11",
  3: "Round 3 — Saturday, April 12",
  4: "Round 4 — Sunday, April 13",
};

export function getCurrentRound(): number {
  const now = new Date();
  // The active picking round is the first one whose reveal time hasn't passed
  for (let r = 1; r <= 4; r++) {
    if (now < new Date(ROUND_REVEAL_TIMES[r])) return r;
  }
  return 4; // Tournament complete
}

export function isRoundRevealed(round: number): boolean {
  return new Date() >= new Date(ROUND_REVEAL_TIMES[round]);
}

export function isTournamentOver(): boolean {
  return new Date() >= new Date(ROUND_REVEAL_TIMES[4]);
}

export function getRevealDate(round: number): Date {
  return new Date(ROUND_REVEAL_TIMES[round]);
}
