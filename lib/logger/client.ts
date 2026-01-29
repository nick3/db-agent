"use client";

import pino from "pino";

type LoggerLevel = "debug" | "info" | "warn" | "error";

const isProduction = process.env.NODE_ENV === "production";
const level =
  (process.env.NEXT_PUBLIC_LOG_LEVEL as LoggerLevel | undefined) ??
  (isProduction ? "error" : "debug");

const redact = {
  paths: ["apiKey", "password", "authorization", "token"],
  censor: "[REDACTED]",
};

export const logger = pino({
  level,
  redact,
  browser: {
    asObject: true,
  },
});

export const createClientLogger = (bindings?: Record<string, unknown>) =>
  bindings ? logger.child(bindings) : logger;
