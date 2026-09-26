/**
 * The application configuration injection token (TKT-foundation-004).
 *
 * `APP_CONFIG` resolves to the validated {@link AppConfig} of
 * `config/env.ts`. Domain modules inject it instead of touching
 * `process.env` (single validated source of truth).
 */
import type { AppConfig } from './env';

export const APP_CONFIG = Symbol('APP_CONFIG');

export type { AppConfig };
