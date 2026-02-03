import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { FetchFunction } from "@ai-sdk/provider-utils";
import type { LLMConfig } from "@/lib/config-store";
import { logger } from "@/lib/logger/server";

const ENABLE_LLM_HTTP_DEBUG =
  process.env.NODE_ENV !== "production" && process.env.LOG_LLM_HTTP === "true";

function truncate(value: string, max = 3000) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…(truncated)`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function summarizeArray(value: unknown) {
  if (value == null) return value;
  if (Array.isArray(value)) return { type: "array", length: value.length };
  return { type: typeof value };
}

function summarizeString(value: unknown) {
  if (typeof value !== "string") return { type: typeof value };
  return { type: "string", length: value.length };
}

function summarizeId(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}(${value.length})`;
}

function summarizeContentItemType(value: unknown) {
  if (!isRecord(value)) return typeof value;
  const type = value.type;
  return typeof type === "string" ? type : "object";
}

function summarizeArrayItemTypes(value: unknown, limit = 20) {
  if (!Array.isArray(value)) return { type: typeof value };

  const slice = value.slice(0, limit);
  return {
    type: "array",
    length: value.length,
    itemTypes: slice.map(summarizeContentItemType),
    truncated: value.length > limit,
  };
}

function summarizeResponsesInputItem(value: unknown, index: number) {
  if (!isRecord(value)) {
    return { index, kind: typeof value };
  }

  const keys = Object.keys(value).sort();
  const role = typeof value.role === "string" ? value.role : undefined;
  const type = typeof value.type === "string" ? value.type : undefined;

  if (role) {
    const content = value.content;

    const contentSummary =
      typeof content === "string"
        ? { kind: "string", length: content.length }
        : Array.isArray(content)
          ? { kind: "array", ...summarizeArrayItemTypes(content) }
          : { kind: content == null ? "null" : typeof content };

    return {
      index,
      kind: "message",
      role,
      keys,
      ...(typeof value.id === "string" ? { id: summarizeId(value.id) } : {}),
      content: contentSummary,
    };
  }

  if (type) {
    switch (type) {
      case "function_call": {
        return {
          index,
          kind: "item",
          type,
          keys,
          call_id: summarizeId(value.call_id),
          ...(typeof value.name === "string" ? { name: value.name } : {}),
          arguments: summarizeString(value.arguments),
        };
      }
      case "function_call_output": {
        const output = value.output;
        const outputSummary =
          typeof output === "string"
            ? { kind: "string", length: output.length }
            : Array.isArray(output)
              ? { kind: "array", ...summarizeArrayItemTypes(output) }
              : { kind: output == null ? "null" : typeof output };

        return {
          index,
          kind: "item",
          type,
          keys,
          call_id: summarizeId(value.call_id),
          output: outputSummary,
        };
      }
      case "item_reference": {
        return {
          index,
          kind: "item",
          type,
          keys,
          id: summarizeId(value.id),
        };
      }
      default: {
        return { index, kind: "item", type, keys };
      }
    }
  }

  return { index, kind: "object", keys };
}

function summarizeResponsesInput(value: unknown) {
  if (!Array.isArray(value)) return summarizeArray(value);

  const limit = 20;
  const items = value.slice(0, limit).map((item, index) => {
    return summarizeResponsesInputItem(item, index);
  });

  return {
    type: "array",
    length: value.length,
    items,
    truncated: value.length > limit,
  };
}

function stripReasoningEncryptedContentFromResponsesInput(value: unknown) {
  if (!Array.isArray(value)) {
    return { changed: false as const };
  }

  let changed = false;

  for (const item of value) {
    if (
      isRecord(item) &&
      item.type === "reasoning" &&
      Object.prototype.hasOwnProperty.call(item, "encrypted_content")
    ) {
      delete item.encrypted_content;
      changed = true;
    }
  }

  return { changed };
}

function createLLMHttpDebugFetch(bindings: {
  provider: string;
  apiMode?: string;
  modelName: string;
  baseURL?: string;
}): FetchFunction | undefined {
  const enableCompat =
    bindings.apiMode === "responses" && bindings.provider !== "openai";
  const enableLog = ENABLE_LLM_HTTP_DEBUG;

  if (!enableCompat && !enableLog) {
    return undefined;
  }

  const upstreamFetch = globalThis.fetch.bind(globalThis) as FetchFunction;

  return async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");

    const rawBody = typeof init?.body === "string" ? init.body : undefined;
    const parsedBody = rawBody ? safeJsonParse(rawBody) : undefined;

    let effectiveInit = init;
    const effectiveParsedBody = parsedBody;
    let compatInfo: Record<string, unknown> | undefined;

    if (
      enableCompat &&
      typeof rawBody === "string" &&
      isRecord(effectiveParsedBody) &&
      Array.isArray(effectiveParsedBody.input)
    ) {
      const { changed } = stripReasoningEncryptedContentFromResponsesInput(
        effectiveParsedBody.input,
      );

      if (changed) {
        compatInfo = { strippedReasoningEncryptedContent: true };
        effectiveInit = {
          ...init,
          body: JSON.stringify(effectiveParsedBody),
        };
      }
    }

    const response = await upstreamFetch(input, effectiveInit);

    if (enableLog && !response.ok) {
      const responseText = await response
        .clone()
        .text()
        .catch(() => undefined);

      const requestBodySummary = isRecord(effectiveParsedBody)
        ? {
            compat: compatInfo,
            keys: Object.keys(effectiveParsedBody).sort(),
            model: effectiveParsedBody.model,
            input: summarizeResponsesInput(effectiveParsedBody.input),
            messages: summarizeArray(effectiveParsedBody.messages),
            tools: summarizeArray(effectiveParsedBody.tools),
            tool_choice: isRecord(effectiveParsedBody.tool_choice)
              ? {
                  keys: Object.keys(effectiveParsedBody.tool_choice).sort(),
                  type: effectiveParsedBody.tool_choice.type,
                }
              : effectiveParsedBody.tool_choice,
            stream: effectiveParsedBody.stream,
          }
        : effectiveParsedBody;

      logger.error(
        {
          llmUpstream: {
            ...bindings,
            url,
            method,
            status: response.status,
            requestBodySummary,
            responseBody: responseText ? truncate(responseText) : undefined,
          },
        },
        "LLM upstream request failed",
      );
    }

    return response;
  };
}

function normalizeBaseUrl(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeOpenAICompatibleBaseUrl(value?: string) {
  const trimmed = normalizeBaseUrl(value);
  if (!trimmed) return undefined;

  try {
    const url = new URL(trimmed);
    if (url.pathname === "" || url.pathname === "/") {
      url.pathname = "/v1";
      return url.toString();
    }
  } catch {
    // If the URL can't be parsed (e.g. missing scheme), keep it as-is.
  }

  return trimmed;
}

export function createModel(config: LLMConfig) {
  const baseURL =
    config.provider === "anthropic"
      ? normalizeBaseUrl(config.baseUrl)
      : normalizeOpenAICompatibleBaseUrl(config.baseUrl);

  switch (config.provider) {
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        baseURL,
      });
      return anthropic(config.modelName);
    }
    case "openai": {
      const apiMode = config.apiMode ?? "responses";
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL,
        fetch: createLLMHttpDebugFetch({
          provider: "openai",
          apiMode,
          modelName: config.modelName,
          baseURL,
        }),
      });

      return apiMode === "chat"
        ? openai.chat(config.modelName)
        : openai.responses(config.modelName);
    }
    case "custom": {
      // Most OpenAI-compatible gateways support Chat Completions. Some also support
      // the Responses API. Allow selecting the mode per provider config.
      const apiMode = config.apiMode ?? "chat";

      const openai = createOpenAI({
        name: config.name,
        apiKey: config.apiKey,
        baseURL,
        fetch: createLLMHttpDebugFetch({
          provider: config.name,
          apiMode,
          modelName: config.modelName,
          baseURL,
        }),
      });

      return apiMode === "responses"
        ? openai.responses(config.modelName)
        : openai.chat(config.modelName);
    }
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
