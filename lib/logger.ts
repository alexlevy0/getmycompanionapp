// ============================================
// Structured Logger
// ============================================

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogMeta {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  msg: string;
  timestamp: string;
  [key: string]: unknown;
}

function createLogEntry(level: LogLevel, msg: string, meta?: LogMeta): LogEntry {
  return {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...meta,
  };
}

function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }
  
  // Pretty format for development
  const metaStr = Object.keys(entry)
    .filter((k) => !["level", "msg", "timestamp"].includes(k))
    .map((k) => `${k}=${JSON.stringify(entry[k])}`)
    .join(" ");
  
  return `[${entry.level.toUpperCase()}] ${entry.msg}${metaStr ? ` | ${metaStr}` : ""}`;
}

export const log = {
  debug: (msg: string, meta?: LogMeta) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatLog(createLogEntry("debug", msg, meta)));
    }
  },
  
  info: (msg: string, meta?: LogMeta) => {
    console.log(formatLog(createLogEntry("info", msg, meta)));
  },
  
  warn: (msg: string, meta?: LogMeta) => {
    console.warn(formatLog(createLogEntry("warn", msg, meta)));
  },
  
  error: (msg: string, meta?: LogMeta) => {
    console.error(formatLog(createLogEntry("error", msg, meta)));
  },
};

// ============================================
// Scoped Logger (for specific modules)
// ============================================

export function createScopedLogger(scope: string) {
  return {
    debug: (msg: string, meta?: LogMeta) => log.debug(msg, { scope, ...meta }),
    info: (msg: string, meta?: LogMeta) => log.info(msg, { scope, ...meta }),
    warn: (msg: string, meta?: LogMeta) => log.warn(msg, { scope, ...meta }),
    error: (msg: string, meta?: LogMeta) => log.error(msg, { scope, ...meta }),
  };
}
