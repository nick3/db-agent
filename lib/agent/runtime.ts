import { ToolLoopAgent, createAgentUIStreamResponse, type UIMessage } from "ai";
import type { DatabaseConfig, LLMConfig } from "@/lib/config-store";
import { createModel } from "@/lib/agent/providers";
import { createDbTools } from "@/lib/agent/tools/db";

const OPENAI_RESPONSES_PROVIDER_OPTIONS = {
  reasoningEffort: "high",
  reasoningSummary: "auto",
} as const;

const OPENAI_CHAT_PROVIDER_OPTIONS = {
  reasoningEffort: "high",
} as const;

const DB_AGENT_INSTRUCTIONS = `你是一个数据库查询助手，负责基于真实数据库内容回答问题。

规则：
- 只要问题涉及“数据库里的真实数据/统计结果/列表”，必须先调用 execute_sql 获取结果；如果工具失败或没有配置数据库，请明确说明原因，不要编造结果。
- 需要理解表结构、字段类型、索引或约束时，先调用 get_db_schema。
- execute_sql 仅允许只读语句（SELECT/WITH/EXPLAIN/SHOW/DESCRIBE/PRAGMA 等）；不要尝试 INSERT/UPDATE/DELETE/CREATE/ALTER/DROP 等写入或 DDL。
- 输出要简洁、结构化，必要时附上你执行的只读 SQL（或关键片段）与结果解读。`;

function getAgentProviderOptions(llmConfig: LLMConfig) {
  if (llmConfig.provider !== "openai") {
    return undefined;
  }

  const apiMode = llmConfig.apiMode ?? "responses";
  return apiMode === "chat"
    ? { openai: OPENAI_CHAT_PROVIDER_OPTIONS }
    : { openai: OPENAI_RESPONSES_PROVIDER_OPTIONS };
}

function createAgent(llmConfig: LLMConfig, dbConfig: DatabaseConfig) {
  const model = createModel(llmConfig);

  return new ToolLoopAgent({
    model,
    instructions: DB_AGENT_INSTRUCTIONS,
    tools: createDbTools(dbConfig),
    providerOptions: getAgentProviderOptions(llmConfig),
  });
}

export async function runAgent({
  messages,
  llmConfig,
  dbConfig,
  abortSignal,
}: {
  messages: UIMessage[];
  llmConfig: LLMConfig;
  dbConfig: DatabaseConfig;
  abortSignal?: AbortSignal;
}) {
  const agent = createAgent(llmConfig, dbConfig);

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    abortSignal,
    sendReasoning: true,
  });
}
