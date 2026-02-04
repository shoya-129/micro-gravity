/**
 * Vitest Setup File
 * 
 * Usage in vitest.config.ts:
 * ```typescript
 * export default defineConfig({
 *     test: {
 *         setupFiles: ['@titanpl/micro-gravity/setup'],
 *     }
 * });
 * ```
 */

import { bootstrap } from './index.js';

// Bootstrap with verbose logging in test environment
bootstrap({
    verbose: process.env.DEBUG === 'true' || process.env.TITAN_DEBUG === 'true',
});