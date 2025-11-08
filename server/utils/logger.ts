// Minimal structured logger wrapper
// Avoids leaking secrets; encourages consistent, JSON-like logs

type Meta = Record<string, any> | undefined;

function ts() {
  return new Date().toISOString();
}

export const logger = {
  info(message: string, meta?: Meta) {
    try {
      // eslint-disable-next-line no-console
      console.info(`[INFO] ${ts()} ${message}`, meta ? JSON.stringify(sanitize(meta)) : '');
    } catch { /* noop */ }
  },
  warn(message: string, meta?: Meta) {
    try {
      // eslint-disable-next-line no-console
      console.warn(`[WARN] ${ts()} ${message}`, meta ? JSON.stringify(sanitize(meta)) : '');
    } catch { /* noop */ }
  },
  error(message: string, meta?: Meta) {
    try {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${ts()} ${message}`, meta ? JSON.stringify(sanitize(meta)) : '');
    } catch { /* noop */ }
  }
};

function sanitize(meta: Record<string, any>) {
  const clone: Record<string, any> = {};
  for (const k of Object.keys(meta)) {
    if (/key|seed|secret|password|private/i.test(k)) {
      clone[k] = '***';
    } else {
      clone[k] = meta[k];
    }
  }
  return clone;
}

export default logger;
