import { NextResponse } from "next/server";
import type { LLMConfig } from "@/lib/config-store";
import { logger } from "@/lib/logger/server";
import {
  deleteLLMConfig,
  listLLMConfigs,
  setActiveLLMConfig,
  upsertLLMConfig,
} from "@/lib/server/llm-config-store";

function hasRequiredCreateFields(
  body: Partial<LLMConfig>,
): body is Partial<LLMConfig> &
  Pick<LLMConfig, "name" | "provider" | "apiKey" | "modelName"> {
  return Boolean(body.name && body.provider && body.apiKey && body.modelName);
}

export async function GET() {
  try {
    const configs = await listLLMConfigs();
    return NextResponse.json({ configs });
  } catch (error) {
    logger.error({ err: error }, "Failed to load LLM configs");
    const message =
      error instanceof Error ? error.message : "Failed to load configs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LLMConfig>;

    if (!hasRequiredCreateFields(body)) {
      return NextResponse.json(
        { error: "Missing required fields: name, provider, apiKey, modelName" },
        { status: 400 },
      );
    }

    const config = await upsertLLMConfig({
      name: body.name,
      provider: body.provider,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl ?? "",
      modelName: body.modelName,
      apiMode: body.apiMode,
      isActive: body.isActive ?? false,
    });

    return NextResponse.json({ config });
  } catch (error) {
    logger.error({ err: error }, "Failed to create LLM config");
    const message =
      error instanceof Error ? error.message : "Failed to create config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Partial<LLMConfig> & {
      id?: string;
      setActive?: boolean;
    };

    if (!body.id) {
      return NextResponse.json({ error: "Missing config id" }, { status: 400 });
    }

    if (body.setActive) {
      const config = await setActiveLLMConfig(body.id);
      if (!config) {
        return NextResponse.json(
          { error: "Config not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({ config });
    }

    const config = await upsertLLMConfig({
      ...body,
      id: body.id,
    });

    return NextResponse.json({ config });
  } catch (error) {
    logger.error({ err: error }, "Failed to update LLM config");
    const message =
      error instanceof Error ? error.message : "Failed to update config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };

    if (!body.id) {
      return NextResponse.json({ error: "Missing config id" }, { status: 400 });
    }

    const deleted = await deleteLLMConfig(body.id);
    if (!deleted) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete LLM config");
    const message =
      error instanceof Error ? error.message : "Failed to delete config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
