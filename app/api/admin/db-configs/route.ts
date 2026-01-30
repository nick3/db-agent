import { NextResponse } from "next/server";
import type { DatabaseConfig } from "@/lib/config-store";
import { logger } from "@/lib/logger/server";
import {
  deleteDBConfig,
  listDBConfigs,
  setActiveDBConfig,
  upsertDBConfig,
} from "@/lib/server/db-config-store";

function stripPassword(config: DatabaseConfig): DatabaseConfig {
  return { ...config, password: "" };
}

function hasRequiredCreateFields(
  body: Partial<DatabaseConfig>,
): body is Partial<DatabaseConfig> &
  Pick<DatabaseConfig, "name" | "type" | "database"> {
  return Boolean(body.name && body.type && body.database);
}

function requiresNetworkFields(type: DatabaseConfig["type"]) {
  return type !== "sqlite";
}

export async function GET() {
  try {
    const configs = await listDBConfigs();
    return NextResponse.json({ configs: configs.map(stripPassword) });
  } catch (error) {
    logger.error({ err: error }, "Failed to load DB configs");
    const message =
      error instanceof Error ? error.message : "Failed to load configs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<DatabaseConfig>;

    if (!hasRequiredCreateFields(body)) {
      return NextResponse.json(
        { error: "Missing required fields: name, type, database" },
        { status: 400 },
      );
    }

    if (requiresNetworkFields(body.type) && (!body.host || !body.username)) {
      return NextResponse.json(
        {
          error:
            "Missing required fields for this database type: host, username",
        },
        { status: 400 },
      );
    }

    const config = await upsertDBConfig({
      name: body.name,
      type: body.type,
      host: body.host ?? "",
      port: body.port ?? 5432,
      username: body.username ?? "",
      password: body.password ?? "",
      database: body.database,
      ssl: body.ssl ?? false,
      isActive: body.isActive ?? false,
    });

    return NextResponse.json({ config: stripPassword(config) });
  } catch (error) {
    logger.error({ err: error }, "Failed to create DB config");
    const message =
      error instanceof Error ? error.message : "Failed to create config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Partial<DatabaseConfig> & {
      id?: string;
      setActive?: boolean;
    };

    if (!body.id) {
      return NextResponse.json({ error: "Missing config id" }, { status: 400 });
    }

    if (body.setActive) {
      const config = await setActiveDBConfig(body.id);
      if (!config) {
        return NextResponse.json(
          { error: "Config not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({ config: stripPassword(config) });
    }

    // Do not pass setActive through to the store.
    const { setActive: _setActive, ...rest } = body;

    const config = await upsertDBConfig({
      ...rest,
      id: body.id,
    });

    return NextResponse.json({ config: stripPassword(config) });
  } catch (error) {
    logger.error({ err: error }, "Failed to update DB config");
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

    const deleted = await deleteDBConfig(body.id);
    if (!deleted) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete DB config");
    const message =
      error instanceof Error ? error.message : "Failed to delete config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
