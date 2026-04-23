/**
 * logger.js
 * Environment-aware logging utility.
 *
 * Replaces 177 raw console.log/warn/error calls across the codebase.
 * - debug/log: only fires in development (import.meta.env.DEV)
 * - warn/error: always fire (these are real signals worth keeping)
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.debug('Graph loaded', data);
 *   logger.warn('Connection unstable');
 *   logger.error('API call failed', error);
 */

const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args) => isDev && console.log('[DEBUG]', ...args),
  log:   (...args) => isDev && console.log('[LOG]',   ...args),
  info:  (...args) => isDev && console.info('[INFO]', ...args),
  warn:  (...args) => console.warn('[WARN]',  ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

export default logger;
