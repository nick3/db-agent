import "server-only";

import pino from "pino";

type LoggerLevel = "debug" | "info" | "warn" | "error";

const isProduction = process.env.NODE_ENV === "production";
const level =
  (process.env.LOG_LEVEL as LoggerLevel | undefined) ??
  (isProduction ? "warn" : "debug");
const enablePretty = !isProduction && process.env.LOG_PRETTY !== "false";

const redact = {
  paths: ["apiKey", "password", "authorization", "token"],
  censor: "[REDACTED]",
};

const transport = enablePretty
  ? pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    })
  : undefined;

export const logger = pino(
  {
    level,
    redact,
  },
  transport,
);

export const createServerLogger = (bindings?: Record<string, unknown>) =>
  bindings ? logger.child(bindings) : logger;
