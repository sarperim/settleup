/**
 * Design-token contract spec (TKT-ui-010).
 *
 * Automated translation of the ticket's explicit acceptance items that are
 * testable at the stylesheet level:
 *
 *   - item 2 — the reference palette is pinned in `tokens.css` and it is the
 *     single source of colour/font values (nothing hard-coded elsewhere).
 *   - item 3 — the shared component classes are present in `base.css`.
 *   - item 5 — `fonts.css` references only self-hosted `@fontsource` imports
 *     (same-origin CSP, arch 01 §8.2), never a remote asset/font URL.
 *   - item 6 — no third *supporting* colour is invented: the only non-accent
 *     colours are the semantic status set (success/warning/danger).
 *
 * Values are the ones extracted from `get_design_context` on the iteration-3
 * reference frames (file `XzY4HLCoW70yfI9NgeLXqC`; boards 01/04/05/06/08
 * desktop layouts) and recorded in `00-ux-pages.md` § Design contract.
 *
 * The spec is DOM-free and reads the CSS as text, so it runs in the root
 * `web-unit` Vitest project (mirrors the other `apps/web/src` mechanism specs).
 */

/// <reference types="vite/client" />

// The spec runs in Vitest's plain `node` environment, so it reads the CSS
// files from disk. `@types/node` is intentionally not a web dependency (the
// SPA never ships Node code), hence the two suppressions below; the spec still
// typechecks cleanly. Vitest's default CSS stub empties `?raw` CSS imports, so
// reading the source text is the only faithful route.
// @ts-expect-error node builtin, resolved only at runtime under Vitest.
import { readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error node builtin, resolved only at runtime under Vitest.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readStyle(file: string): string {
  return readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), 'utf8');
}

/** Strip `/* … *\/` comments so a prose mention of `#hex` or `url()` never matches. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const tokens = readStyle('tokens.css');
const base = withoutComments(readStyle('base.css'));
const fonts = withoutComments(readStyle('fonts.css'));

/** Every consumer stylesheet in `layout/` + `pages/` (all but `styles/`). */
function readCssDir(dir: string, label: string): { name: string; css: string }[] {
  return readdirSync(dir)
    .filter((name: string) => name.endsWith('.css'))
    .map((name: string) => ({
      name: `${label}/${name}`,
      css: withoutComments(readFileSync(`${dir}/${name}`, 'utf8')),
    }));
}

const singleSourceStyles: { name: string; css: string }[] = [
  { name: 'styles/base.css', css: base },
  ...readCssDir(fileURLToPath(new URL('../layout', import.meta.url)), 'layout'),
  ...readCssDir(fileURLToPath(new URL('../pages', import.meta.url)), 'pages'),
];

function tokenValue(name: string): string {
  const match = tokens.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  const value = match?.[1];
  if (value === undefined) throw new Error(`Design token --${name} is not defined in tokens.css`);
  return value.trim();
}

describe('TKT-ui-010 · reference palette is pinned in tokens.css (acceptance 2)', () => {
  it('pins the warm-cream surfaces and borders from the references', () => {
    expect(tokenValue('color-surface')).toBe('#fcf8f2');
    expect(tokenValue('color-surface-raised')).toBe('#fffdfc');
    expect(tokenValue('color-surface-sunken')).toBe('#f7eee5');
    expect(tokenValue('color-border')).toBe('#ddd0c5');
    expect(tokenValue('color-border-strong')).toBe('#c9b7aa');
  });

  it('pins the warm-brown text colours', () => {
    expect(tokenValue('color-text')).toBe('#3d302b');
    expect(tokenValue('color-text-muted')).toBe('#786a62');
  });

  it('pins the pastel-red accent family (nav + primary action + soft chips)', () => {
    expect(tokenValue('color-accent')).toBe('#efa6a0');
    expect(tokenValue('color-accent-strong')).toBe('#9d493f');
    expect(tokenValue('color-accent-soft')).toBe('#f6d7d2');
    expect(tokenValue('color-nav-bg')).toBe('#efa6a0');
    expect(tokenValue('color-nav-text')).toBe('#6b3832');
  });

  it('pins the semantic status colours shown across the boards', () => {
    expect(tokenValue('color-success')).toBe('#31705a');
    expect(tokenValue('color-danger')).toBe('#b23e3e');
    // Amber warning is a status colour present in the references (rate-limit
    // and pending/rejected states) — a semantic status, not a supporting brand colour.
    expect(tokenValue('color-warning')).toBe('#99611c');
    expect(tokenValue('color-warning-soft')).toBe('#fff0d2');
  });

  it('pins the reference radii and card shadow', () => {
    expect(tokenValue('radius-lg')).toBe('18px');
    expect(tokenValue('radius-md')).toBe('12px');
    expect(tokenValue('shadow-md')).toBe('0 8px 24px rgb(107 56 50 / 8%)');
  });

  it.each(
    singleSourceStyles,
  )('$name consumes the tokens and hard-codes no colour value', ({ css }) => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?)\s*\(/);
  });
});

describe('TKT-ui-010 · shared classes restyled in base.css (acceptance 3)', () => {
  const sharedClasses = [
    '.card',
    '.alert',
    '.alert--success',
    '.alert--warning',
    '.alert--info',
    '.list',
    '.btn',
    '.btn--secondary',
    '.btn--danger',
    '.muted',
    '.stack',
    '.row',
  ];

  it.each(sharedClasses)('defines %s', (selector) => {
    // Boundary check: `.alert` must be a class of its own, not a substring of
    // `.alert--success` — otherwise deleting the base rule would still pass.
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(base).toMatch(new RegExp(`${escaped}(?![\\w-])`));
  });

  it('consumes the token palette for the shared classes', () => {
    expect(base).toMatch(/\.card\s*\{[^}]*var\(--color-surface-raised\)/s);
    expect(base).toMatch(/\.alert[^{}]*\{[^}]*var\(--color-danger/);
    expect(base).toMatch(/button,\s*\.btn\s*\{[^}]*var\(--color-accent-strong\)/s);
  });
});

describe('TKT-ui-010 · fonts are self-hosted (acceptance 5)', () => {
  it('imports only the fontsource packages — no remote URL, no runtime JS', () => {
    expect(fonts).not.toMatch(/https?:\/\//);
    expect(fonts).not.toMatch(/url\s*\(/);
    expect(fonts).toMatch(/@import\s+'@fontsource-variable\//);
  });
});

describe('TKT-ui-010 · no third supporting colour invented (acceptance 6)', () => {
  // The exact --color-* set shipped: cream/brown surfaces+text, the pastel-red
  // accent family, the nav pair, and semantic status (success/warning/danger).
  // An exact-set equality catches both an invented third colour (any new name)
  // and an accidental removal, without depending on an English name spelling.
  const expectedColorTokens = [
    'color-accent',
    'color-accent-contrast',
    'color-accent-soft',
    'color-accent-strong',
    'color-accent-strong-hover',
    'color-border',
    'color-border-strong',
    'color-danger',
    'color-danger-soft',
    'color-danger-strong',
    'color-focus',
    'color-nav-active-bg',
    'color-nav-active-text',
    'color-nav-bg',
    'color-nav-text',
    'color-on-accent',
    'color-on-danger',
    'color-surface',
    'color-surface-raised',
    'color-surface-sunken',
    'color-success',
    'color-success-soft',
    'color-success-strong',
    'color-text',
    'color-text-muted',
    'color-warning',
    'color-warning-soft',
  ];

  it('defines exactly the accent + semantic status colour set, nothing invented', () => {
    const actual = [
      ...new Set([...tokens.matchAll(/--(color-[a-z0-9-]+)\s*:/g)].map((m) => m[1] ?? '')),
    ].sort();
    expect(actual).toEqual([...expectedColorTokens].sort());
  });
});
