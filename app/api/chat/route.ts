import { NextResponse } from "next/server";
import type { UIMessage } from "ai";
import { runAgent } from "@/lib/agent/runtime";
import { logger } from "@/lib/logger/server";
import { getActiveLLMConfig } from "@/lib/server/llm-config-store";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { messages?: UIMessage[] };

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }

    const activeConfig = await getActiveLLMConfig();

    if (!activeConfig) {
      return NextResponse.json(
        {
          error: "No active LLM configuration found. Configure one in /admin.",
        },
        { status: 400 },
      );
    }

    return await runAgent({
      messages: body.messages,
      llmConfig: activeConfig,
      abortSignal: req.signal,
    });
  } catch (error) {
    logger.error({ err: error }, "Chat API error");
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 },
    );
  }
}
