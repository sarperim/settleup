/**
 * Seeded deterministic PRNG for unit-level randomness tests
 * (00-test-strategy.md §3 T5: "Unit: inject a seeded deterministic PRNG as the
 * CSPRNG source"). This is the one sanctioned test double (§4).
 *
 * `mulberry32`: a small, fast 32-bit generator with a 2^32 period — ample for
 * the 10,000-code (80,000-draw) uniqueness sample of TC-GRP-002, and fully
 * deterministic from its seed (a failure is reproducible from the seed
 * reported in the test, §7 rule 2).
 */
import type { RandomSource } from '../../../src/groups/random-source';

export class SeededRandomSource implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Next 32-bit unsigned integer (mulberry32). */
  nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
}
