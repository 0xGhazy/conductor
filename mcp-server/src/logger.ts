import type { LogLevel } from "./config.js";

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  constructor(private readonly minimumLevel: LogLevel) {}

  debug(event: string, fields: Record<string, unknown> = {}): void {
    this.write("debug", event, fields);
  }

  info(event: string, fields: Record<string, unknown> = {}): void {
    this.write("info", event, fields);
  }

  warn(event: string, fields: Record<string, unknown> = {}): void {
    this.write("warn", event, fields);
  }

  error(event: string, fields: Record<string, unknown> = {}): void {
    this.write("error", event, fields);
  }

  private write(
    level: LogLevel,
    event: string,
    fields: Record<string, unknown>,
  ): void {
    if (priorities[level] < priorities[this.minimumLevel]) return;
    const record = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...fields,
    });
    if (level === "error") {
      process.stderr.write(`${record}\n`);
    } else {
      process.stdout.write(`${record}\n`);
    }
  }
}
