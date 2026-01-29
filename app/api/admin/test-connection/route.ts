import { NextResponse } from "next/server";
import { testDatabaseConnection } from "@/lib/database";
import type { DatabaseConfig } from "@/lib/config-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const { type, host, port, username, password, database, ssl } = body;

    if (!type || !database) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: type and database" },
        { status: 400 }
      );
    }

    // For non-SQLite databases, validate additional fields
    if (type !== "sqlite" && (!host || !username)) {
      return NextResponse.json(
        { success: false, message: "Missing required fields for this database type" },
        { status: 400 }
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
    console.error("Connection test error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
