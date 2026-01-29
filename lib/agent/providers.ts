import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LLMConfig } from "@/lib/config-store";

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
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL,
      });

      const apiMode = config.apiMode ?? "responses";
      return apiMode === "chat"
        ? openai.chat(config.modelName)
        : openai.responses(config.modelName);
    }
    case "custom": {
      const openai = createOpenAI({
        name: config.name,
        apiKey: config.apiKey,
        baseURL,
      });

      // Most OpenAI-compatible gateways support Chat Completions. Some also support
      // the Responses API. Allow selecting the mode per provider config.
      const apiMode = config.apiMode ?? "chat";
      return apiMode === "responses"
        ? openai.responses(config.modelName)
        : openai.chat(config.modelName);
    }
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
