import type { Page } from '@playwright/test';

/**
 * Page-load timing per 00-test-strategy.md §3 (T4): median of 3 measurements,
 * one retry of the whole median on breach; the hard gate is the SC budget
 * (2.0 s for NFR-ACC-003).
 */

export const PAGE_LOAD_BUDGET_MS = 2_000;

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

async function medianOfThree(page: Page, route: string): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const started = Date.now();
    await page.goto(route, { waitUntil: 'load' });
    samples.push(Date.now() - started);
  }
  return median(samples);
}

/**
 * Median page-load time for `route`, measured three times; on a breach of the
 * budget the median-of-three is taken once more (T4) and returned.
 */
export async function measureMedianPageLoad(page: Page, route: string): Promise<number> {
  let measured = await medianOfThree(page, route);
  if (measured > PAGE_LOAD_BUDGET_MS) {
    measured = await medianOfThree(page, route);
  }
  return measured;
}
