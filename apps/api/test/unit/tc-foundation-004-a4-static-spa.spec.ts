/**
 * TKT-foundation-004 acceptance criterion 4 (static SPA serving, history
 * fallback, asset cache headers).
 *
 * Uses a temporary web root that mimics the Vite build output, so the test is
 * deterministic and does not depend on `apps/web/dist` existing at test time
 * (the CI job builds the real SPA in a later step).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as nodePath from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createHttpApp } from '../../src/app.factory';
import { applyTestEnv } from './support/test-env';

const INDEX_MARKER = 'settle-up-spa-index';
const ASSET_NAME = 'index-abcdef12.js';

let restore: () => void;
let app: NestExpressApplication;
let webRoot: string;

beforeAll(async () => {
  restore = applyTestEnv();
  webRoot = mkdtempSync(nodePath.join(tmpdir(), 'settleup-spa-'));
  writeFileSync(
    nodePath.join(webRoot, 'index.html'),
    `<!doctype html><html><body><div id="root">${INDEX_MARKER}</div></body></html>`,
  );
  mkdirSync(nodePath.join(webRoot, 'assets'));
  writeFileSync(
    nodePath.join(webRoot, 'assets', ASSET_NAME),
    'export const chunk = 1;\n',
  );

  app = await createHttpApp({ webRoot });
});

afterAll(async () => {
  await app.close();
  rmSync(webRoot, { recursive: true, force: true });
  restore();
});

describe('SPA static serving (arch. §7 NFR-ACC-003)', () => {
  it('serves index.html at / and marks it to revalidate', async () => {
    const response = await request(app.getHttpServer()).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain(INDEX_MARKER);
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('serves index.html for deep links (history fallback)', async () => {
    const response = await request(app.getHttpServer()).get('/groups/some-id');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain(INDEX_MARKER);
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('serves hashed assets with immutable cache headers', async () => {
    const response = await request(app.getHttpServer()).get(
      `/assets/${ASSET_NAME}`,
    );

    expect(response.status).toBe(200);
    expect(response.text).toContain('chunk');
    expect(response.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('does not hijack unknown /api routes (they stay JSON 404)', async () => {
    const response = await request(app.getHttpServer()).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('does not hijack /api routes regardless of URL casing (round 2, F-S-5)', async () => {
    const response = await request(app.getHttpServer())
      .get('/API/unknown')
      .set('Accept', 'text/html');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.text).not.toContain(INDEX_MARKER);
  });
});
