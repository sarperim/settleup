/**
 * TC-GRP-008 — Join-info with an unknown or malformed code
 * (groups-membership.md §2; FR-GRP-004, UC-GRP-002 E1, 03-api-design.md §4
 * `CODE_NOT_FOUND`).
 *
 * A non-matching code is indistinguishable whatever its shape: a well-formed
 * unknown code, a wrong-length code, and a wrong-alphabet (lowercase) code all
 * yield the identical 404 envelope.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIntegrationApp,
  type IntegrationApp,
} from './support/app';
import { truncateAllTables } from './support/truncate';
import { registerUser, TEST_PASSWORD } from './support/factories';

let ctx: IntegrationApp;

beforeAll(async () => {
  ctx = await createIntegrationApp();
});

afterAll(async () => {
  if (ctx) {
    await ctx.app.close();
  }
});

beforeEach(async () => {
  await truncateAllTables(ctx.prisma);
});

describe('TC-GRP-008 — join-info rejects unknown and malformed codes identically', () => {
  it('returns 404 CODE_NOT_FOUND for well-formed-unknown, wrong-length and lowercase codes', async () => {
    const carol = await registerUser(
      ctx.server,
      'carol@test.local',
      TEST_PASSWORD,
      'Carol',
    );

    const codes = ['ZZZZ9999', 'short', 'abcdefgh'];
    const responses = [];
    for (const code of codes) {
      responses.push(
        await api(ctx.server)
          .get('/api/join-info')
          .query({ code })
          .set('Cookie', carol.cookie),
      );
    }

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(Object.keys(response.body)).toEqual(['error']);
      expect(response.body.error.code).toBe('CODE_NOT_FOUND');
      expect(typeof response.body.error.message).toBe('string');
    }

    // Indistinguishable: every malformed/unknown shape yields the same body.
    expect(responses[1].body).toEqual(responses[0].body);
    expect(responses[2].body).toEqual(responses[0].body);
  });
});
