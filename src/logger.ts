type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(data ? { data } : {})
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info(message: string, data?: Record<string, unknown>): void {
    write("info", message, data);
  },
  warn(message: string, data?: Record<string, unknown>): void {
    write("warn", message, data);
  },
  error(message: string, data?: Record<string, unknown>): void {
    write("error", message, data);
  }
};
