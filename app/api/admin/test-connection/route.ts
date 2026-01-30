import { NextResponse } from "next/server";
import { testDatabaseConnection } from "@/lib/database";
import type { DatabaseConfig } from "@/lib/config-store";
import { logger } from "@/lib/logger/server";
import { getDBConfig } from "@/lib/server/db-config-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Server-stored config test: { id }
    if (typeof body.id === "string" && body.id.length > 0) {
      const config = await getDBConfig(body.id);

      if (!config) {
        return NextResponse.json(
          { success: false, message: "Config not found" },
          { status: 404 },
        );
      }

      const result = await testDatabaseConnection(config);
      return NextResponse.json(result);
    }

    // Ad-hoc test (form): validate required fields
    const { type, host, port, username, password, database, ssl } = body as {
      type?: DatabaseConfig["type"];
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
      ssl?: boolean;
    };

    if (!type || !database) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields: type and database",
        },
        { status: 400 },
      );
    }

    // For non-SQLite databases, validate additional fields
    if (type !== "sqlite" && (!host || !username)) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields for this database type",
        },
        { status: 400 },
      );
    }

    // Create a config object for testing
    const config: DatabaseConfig = {
      id: "test",
      name: "Test Connection",
      type,
      host: host || "",
      port: port || 5432,
      username: username || "",
      password: password || "",
      database,
      ssl: ssl || false,
      isActive: false,
      createdAt: Date.now(),
    };

    // Test the connection
    const result = await testDatabaseConnection(config);

    return NextResponse.json(result);
  } catch (error) {
    logger.error({ err: error }, "Connection test error");
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 },
    );
  }
}
