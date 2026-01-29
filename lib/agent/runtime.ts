import { ToolLoopAgent, createAgentUIStreamResponse, type UIMessage } from "ai";
import type { LLMConfig } from "@/lib/config-store";
import { createModel } from "@/lib/agent/providers";

const OPENAI_RESPONSES_PROVIDER_OPTIONS = {
  reasoningEffort: "low",
  reasoningSummary: "auto",
} as const;

const OPENAI_CHAT_PROVIDER_OPTIONS = {
  reasoningEffort: "low",
} as const;

function getAgentProviderOptions(llmConfig: LLMConfig) {
  if (llmConfig.provider !== "openai") {
    return undefined;
  }

  const apiMode = llmConfig.apiMode ?? "responses";
  return apiMode === "chat"
    ? { openai: OPENAI_CHAT_PROVIDER_OPTIONS }
    : { openai: OPENAI_RESPONSES_PROVIDER_OPTIONS };
}

function createAgent(llmConfig: LLMConfig) {
  const model = createModel(llmConfig);

  return new ToolLoopAgent({
    model,
    providerOptions: getAgentProviderOptions(llmConfig),
  });
}

export async function runAgent({
  messages,
  llmConfig,
  abortSignal,
}: {
  messages: UIMessage[];
  llmConfig: LLMConfig;
  abortSignal?: AbortSignal;
}) {
  const agent = createAgent(llmConfig);

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    abortSignal,
    sendReasoning: true,
  });
}
