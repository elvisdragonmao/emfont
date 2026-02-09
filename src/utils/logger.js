// logger.js
import { AsyncLocalStorage } from 'node:async_hooks';

export const loggerStorage = new AsyncLocalStorage();

let baseLogger = console;

export function setBaseLogger(logger) {
  baseLogger = logger;
}

function getLogger() {
  return loggerStorage.getStore() || baseLogger;
}

export const logger = {
  info: (...args) => getLogger().info(...args),
  warn: (...args) => getLogger().warn(...args),
  error: (...args) => getLogger().error(...args),
  debug: (...args) => getLogger().debug(...args),
};
